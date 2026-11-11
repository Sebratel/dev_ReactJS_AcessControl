import { AppException } from '../../common/errors/app.exception.js';
import { normalizeText } from '../protocols/protocol-parser.js';

/**
 * Leitura do export "permissões ativas por dashboard" do HUB BI
 * (Firestore `DHO_dashboard_access_email` + `DHO_dashboards` + `DHO_users`).
 *
 * Chega como tabela crua (cabeçalho + linhas) — a planilha é lida no navegador.
 * Aqui só se interpreta e valida; nada é gravado.
 */
export type Cell = string | number | boolean | null;

export interface ImportTable {
  header: Cell[];
  rows: Cell[][];
}

export interface HubBiPermissionRecord {
  rowNumber: number;
  permissionId: string | null;
  dashboardId: string;
  dashboardName: string;
  email: string;
  userName: string | null;
  /** nível no HUB (DHO_users.accessLevel): presente só para quem tem cadastro no hub */
  hubRole: string | null;
  grantedAt: string | null;
}

export interface IgnoredRow {
  rowNumber: number;
  reason: string;
}

export interface ParsedHubBiPermissions {
  records: HubBiPermissionRecord[];
  ignored: IgnoredRow[];
  rowsRead: number;
}

/** Nomes aceitos para cada coluna (o export do Firestore e variações à mão). */
const COLUMNS = {
  dashboardId: ['id_dashboard', 'dashboard_id', 'dashboardid', 'id do dashboard'],
  dashboardName: ['dashboard', 'nome_dashboard', 'titulo', 'title'],
  email: ['email', 'e-mail', 'e_mail'],
  userName: ['usuario', 'nome', 'name', 'nome_usuario'],
  hubRole: ['nivel_usuario', 'nivel', 'accesslevel', 'access_level'],
  active: ['ativa', 'ativo', 'isactive', 'is_active'],
  grantedAt: ['criado_em', 'createdat', 'created_at', 'data'],
  permissionId: ['id_permissao', 'permission_id', 'id'],
} as const;

const REQUIRED: (keyof typeof COLUMNS)[] = ['dashboardId', 'dashboardName', 'email'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const headerKey = (value: Cell): string => normalizeText(String(value ?? '')).replace(/ /g, '_');

function cellText(value: Cell | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isFalse(value: Cell | undefined): boolean {
  if (value === false || value === 0) return true;
  return ['false', 'falso', 'nao', 'não', 'n', '0', 'inativa', 'inativo'].includes(cellText(value).toLowerCase());
}

function toIso(value: Cell | undefined): string | null {
  const text = cellText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRole(value: Cell | undefined): string | null {
  const text = cellText(value);
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function parseHubBiPermissions(table: ImportTable): ParsedHubBiPermissions {
  const keys = table.header.map(headerKey);
  const index = {} as Record<keyof typeof COLUMNS, number>;
  (Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).forEach((column) => {
    index[column] = keys.findIndex((key) => (COLUMNS[column] as readonly string[]).includes(key));
  });
  const missing = REQUIRED.filter((column) => index[column] < 0);
  if (missing.length) {
    throw new AppException(
      422,
      'IMPORT_COLUMNS_MISSING',
      `A planilha não tem as colunas obrigatórias: ${missing.map((c) => COLUMNS[c][0]).join(', ')}.`,
      missing.map((c) => ({ column: COLUMNS[c][0] })),
    );
  }

  const get = (row: Cell[], column: keyof typeof COLUMNS): Cell | undefined => (index[column] >= 0 ? row[index[column]] : undefined);
  const records: HubBiPermissionRecord[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();
  let rowsRead = 0;

  table.rows.forEach((row, i) => {
    const rowNumber = i + 2; // linha 1 é o cabeçalho
    if (row.every((cell) => cellText(cell) === '')) return;
    rowsRead += 1;

    const dashboardId = cellText(get(row, 'dashboardId'));
    const dashboardName = cellText(get(row, 'dashboardName'));
    const email = cellText(get(row, 'email')).toLowerCase();

    if (index.active >= 0 && isFalse(get(row, 'active'))) {
      ignored.push({ rowNumber, reason: 'permissão inativa' });
      return;
    }
    if (!dashboardId || !dashboardName) {
      ignored.push({ rowNumber, reason: 'sem id ou nome do dashboard' });
      return;
    }
    if (!EMAIL.test(email) || email.length > 254) {
      ignored.push({ rowNumber, reason: `e-mail inválido (${email || 'vazio'})` });
      return;
    }
    const key = `${dashboardId}\u0000${email}`;
    if (seen.has(key)) {
      ignored.push({ rowNumber, reason: `repetida (${email} já aparece neste dashboard)` });
      return;
    }
    seen.add(key);

    records.push({
      rowNumber,
      permissionId: cellText(get(row, 'permissionId')) || null,
      dashboardId: dashboardId.slice(0, 200),
      dashboardName: dashboardName.slice(0, 200),
      email,
      userName: cellText(get(row, 'userName')).slice(0, 200) || null,
      hubRole: normalizeRole(get(row, 'hubRole'))?.slice(0, 100) ?? null,
      grantedAt: toIso(get(row, 'grantedAt')),
    });
  });

  return { records, ignored, rowsRead };
}
