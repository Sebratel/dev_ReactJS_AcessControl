import { AppException } from '../../common/errors/app.exception.js';
import { normalizeText } from '../protocols/protocol-parser.js';
import type { AccessImportRecord, IgnoredRow, ParsedImport } from './access-import.service.js';
import type { Cell, ImportTable } from './hub-bi-permissions.parser.js';

/**
 * Leitura do "Controle UpValue" (aba Export): colunas Usuário | email |
 * Relatório, AGRUPADAS — o nome e o e-mail aparecem só na primeira linha de
 * cada pessoa e os relatórios dela seguem nas linhas de baixo:
 *
 *   Carla | carla.teste@sebratel.com.br | [Up] Análise Executiva
 *          |                              | [Up] Atendimento
 *
 * Aqui as linhas de baixo herdam a pessoa de cima. Nada é gravado.
 */
const COLUMNS = {
  userName: ['usuario', 'nome', 'name', 'pessoa'],
  email: ['email', 'e_mail', 'e-mail'],
  report: ['relatorio', 'dashboard', 'relatorios', 'painel'],
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const headerKey = (value: Cell): string => normalizeText(String(value ?? '')).replace(/ /g, '_');
const text = (value: Cell | undefined): string => (value === null || value === undefined ? '' : String(value).trim());

export function parseUpvalueReports(table: ImportTable): ParsedImport {
  const keys = table.header.map(headerKey);
  const index = (column: keyof typeof COLUMNS) => keys.findIndex((k) => (COLUMNS[column] as readonly string[]).includes(k));
  const col = { userName: index('userName'), email: index('email'), report: index('report') };
  const missing = (['email', 'report'] as const).filter((c) => col[c] < 0);
  if (missing.length) {
    throw new AppException(
      422,
      'IMPORT_COLUMNS_MISSING',
      `A planilha não tem as colunas obrigatórias: ${missing.map((c) => COLUMNS[c][0]).join(', ')} (esperado: Usuário, email, Relatório).`,
      missing.map((c) => ({ column: COLUMNS[c][0] })),
    );
  }

  const records: AccessImportRecord[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();
  let current: { email: string; userName: string | null } | null = null;
  let rowsRead = 0;

  table.rows.forEach((row, i) => {
    const rowNumber = i + 2;
    if (row.every((cell) => text(cell) === '')) return;
    rowsRead += 1;
    const name = col.userName >= 0 ? text(row[col.userName]) : '';
    const email = text(row[col.email]).toLowerCase();
    const report = text(row[col.report]);

    // linha que começa uma pessoa (tem nome ou e-mail)
    if (name || email) {
      if (!EMAIL.test(email) || email.length > 254) {
        current = null;
        ignored.push({ rowNumber, reason: `e-mail inválido (${email || 'vazio'}) — os relatórios desta pessoa ficam de fora` });
        return;
      }
      current = { email, userName: name.slice(0, 200) || null };
    }
    if (!report) return;
    if (!current) {
      ignored.push({ rowNumber, reason: 'relatório sem pessoa acima' });
      return;
    }
    const key = `${current.email}\u0000${normalizeText(report)}`;
    if (seen.has(key)) {
      ignored.push({ rowNumber, reason: `repetida (${current.email} já tem ${report})` });
      return;
    }
    seen.add(key);
    records.push({
      rowNumber,
      resourceKey: report.slice(0, 200),
      resourceName: report.slice(0, 200),
      email: current.email,
      userName: current.userName,
      rootLevel: null,
      grantedAt: null,
      sourceRef: null,
    });
  });

  return { records, ignored, rowsRead };
}
