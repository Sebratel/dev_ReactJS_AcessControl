import { AppException } from '../../common/errors/app.exception.js';
import { normalizeText } from '../protocols/protocol-parser.js';
import type { AccessImportRecord, IgnoredRow, ImportItem, ImportMember, ParsedImport } from './access-import.service.js';
import type { Cell, ImportTable } from './hub-bi-permissions.parser.js';

/**
 * Leitura dos exports do HUB APPS (MySQL `DB_Hub_Apps`). Chegam várias tabelas
 * de uma vez e cada uma é reconhecida pelas colunas:
 *
 *   usuários  — id; name; email; perfil; equipe; is_admin; ativo; cadastrado_em; ultimo_acesso
 *   aplicações — id; name; url; ativo; cadastrado_em   (+ livre: aberta a todos do hub)
 *   acessos   — usuario; email; perfil; equipe; app; url; motivo_acesso   (obrigatória;
 *               + app_id: casa pelo id em vez do nome — a sincronização direta manda)
 *   por app   — app; url; total_usuarios; usuarios   (só nomes: ignorada, é derivada dos acessos)
 *
 * Nada é gravado aqui.
 */
type Kind = 'users' | 'apps' | 'accesses' | 'byApp';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const headerKey = (value: Cell): string => normalizeText(String(value ?? '')).replace(/ /g, '_');
const text = (value: Cell | undefined): string => (value === null || value === undefined ? '' : String(value).trim());
const isTrue = (value: Cell | undefined): boolean => ['1', 'true', 'sim', 's', 'yes', 'ativo'].includes(text(value).toLowerCase());

/** Nome "‎ ‎" (só caracteres invisíveis) ou "-.-" não é nome. */
function cleanName(value: Cell | undefined): string | null {
  const name = text(value).replace(/[​-‏‪-‮⁠﻿ ]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\p{L}/u.test(name) ? name.slice(0, 200) : null;
}

/** "07/02/2026" -> ISO (meia-noite de Brasília). */
function brDate(value: Cell | undefined): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text(value));
  if (!match) return null;
  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const PROFILE_LABEL: Record<string, string> = { tecnica: 'Técnica', comercial: 'Comercial', users: 'Usuários' };

function kindOf(keys: string[]): Kind | null {
  const has = (...names: string[]) => names.every((n) => keys.includes(n));
  if (has('email', 'app')) return 'accesses';
  if (has('app', 'usuarios')) return 'byApp';
  if (has('email', 'is_admin') || has('email', 'ativo', 'perfil')) return 'users';
  if (has('name', 'url') && !keys.includes('email')) return 'apps';
  return null;
}

export function parseHubAppsExport(tables: ImportTable[]): ParsedImport {
  const byKind = new Map<Kind, { keys: string[]; rows: Cell[][] }>();
  const notices: string[] = [];
  tables.forEach((table, i) => {
    const keys = table.header.map(headerKey);
    const kind = kindOf(keys);
    if (!kind) {
      throw new AppException(422, 'IMPORT_TABLE_UNKNOWN', `O arquivo ${i + 1} não parece um export do HUB APPS (colunas: ${table.header.filter(Boolean).join(', ')}).`);
    }
    if (byKind.has(kind)) throw new AppException(422, 'IMPORT_TABLE_DUPLICATED', 'Veio mais de um arquivo do mesmo tipo — envie cada export uma vez só.');
    byKind.set(kind, { keys, rows: table.rows });
  });

  const accesses = byKind.get('accesses');
  if (!accesses) {
    throw new AppException(422, 'IMPORT_COLUMNS_MISSING', 'Falta o export de acessos por usuário (colunas usuario, email, app, url, motivo_acesso).');
  }
  if (byKind.has('byApp')) notices.push('“Usuários por app” reconhecido e deixado de fora: traz só nomes e repete o que já está nos acessos por usuário.');

  // ---------------------------------------------------------------- usuários
  const members: ImportMember[] = [];
  const inactive = new Set<string>();
  const users = byKind.get('users');
  if (users) {
    const col = (name: string) => users.keys.indexOf(name);
    let active = 0;
    users.rows.forEach((row) => {
      const email = text(row[col('email')]).toLowerCase();
      if (!EMAIL.test(email)) return;
      if (col('ativo') >= 0 && !isTrue(row[col('ativo')])) {
        inactive.add(email);
        return;
      }
      active += 1;
      const profile = text(row[col('perfil')]).toLowerCase();
      members.push({
        email,
        userName: cleanName(row[col('name')]),
        rootLevel: isTrue(row[col('is_admin')]) ? 'Admin' : (PROFILE_LABEL[profile] ?? (profile || null)),
        department: text(row[col('equipe')]).slice(0, 200) || null,
        since: brDate(row[col('cadastrado_em')]),
      });
    });
    notices.push(`Usuários: ${active} ativo(s) com acesso ao hub${inactive.size ? `; ${inactive.size} inativo(s) no HUB APPS ficam de fora` : ''}.`);
  } else {
    notices.push('Sem o export de usuários: o acesso ao hub vale só para quem aparece nos acessos, e quem sumir do hub não é detectado.');
  }

  // ------------------------------------------------------------- aplicações
  const items: ImportItem[] = [];
  const keyByName = new Map<string, string>();
  const apps = byKind.get('apps');
  if (apps) {
    const col = (name: string) => apps.keys.indexOf(name);
    apps.rows.forEach((row) => {
      const name = text(row[col('name')]);
      if (!name) return;
      const key = text(row[col('id')]) || name;
      const disabled = col('ativo') >= 0 && !isTrue(row[col('ativo')]);
      // sem nenhuma regra de acesso no hub = aberta a todo mundo que entra no hub
      const open = col('livre') >= 0 ? isTrue(row[col('livre')]) : undefined;
      keyByName.set(normalizeText(name), key);
      items.push({
        key: key.slice(0, 200),
        name: name.slice(0, 200),
        url: /^https?:\/\/\S+$/i.test(text(row[col('url')])) ? text(row[col('url')]).slice(0, 2000) : null,
        description: disabled ? 'Desativada no HUB APPS' : open ? 'Aberta a todos do HUB APPS' : 'Importado do HUB APPS',
        accessControlled: open === undefined ? undefined : !open,
      });
    });
    const off = items.filter((i) => i.description === 'Desativada no HUB APPS').map((i) => i.name);
    notices.push(`Aplicações: ${items.length}${off.length ? ` (desativada(s) no HUB: ${off.join(', ')})` : ''}.`);
  }

  // ---------------------------------------------------------------- acessos
  const records: AccessImportRecord[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();
  const col = (name: string) => accesses.keys.indexOf(name);
  let rowsRead = 0;
  accesses.rows.forEach((row, i) => {
    const rowNumber = i + 2;
    if (row.every((cell) => text(cell) === '')) return;
    rowsRead += 1;
    const email = text(row[col('email')]).toLowerCase();
    const app = text(row[col('app')]);
    if (!EMAIL.test(email)) {
      ignored.push({ rowNumber, reason: `e-mail inválido (${email || 'vazio'})` });
      return;
    }
    if (!app) {
      ignored.push({ rowNumber, reason: 'sem aplicação' });
      return;
    }
    if (inactive.has(email)) {
      ignored.push({ rowNumber, reason: `${email} está inativo no HUB APPS` });
      return;
    }
    // o id da aplicação, quando vem, vence o nome (dois apps com o mesmo nome não se confundem)
    const appId = col('app_id') >= 0 ? text(row[col('app_id')]) : '';
    const key = appId || (apps ? keyByName.get(normalizeText(app)) : app);
    if (!key) {
      ignored.push({ rowNumber, reason: `aplicação “${app}” não está no export de aplicações` });
      return;
    }
    const pair = `${email}\u0000${key}`;
    if (seen.has(pair)) {
      ignored.push({ rowNumber, reason: `repetida (${email} já tem ${app})` });
      return;
    }
    seen.add(pair);
    const motive = text(row[col('motivo_acesso')]).toLowerCase();
    records.push({
      rowNumber,
      resourceKey: key.slice(0, 200),
      resourceName: app.slice(0, 200),
      email,
      userName: cleanName(row[col('usuario')]),
      rootLevel: null,
      grantedAt: null,
      sourceRef: null,
      note: motive ? `via ${motive.replace(/_/g, ' ').replace(/usuario/g, 'usuário').split('+').join(' + ')}` : null,
    });
  });

  return { records, ignored, rowsRead, items, members: users ? members : undefined, notices };
}
