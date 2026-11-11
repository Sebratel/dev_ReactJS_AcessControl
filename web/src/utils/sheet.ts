import type { ImportCell, ImportTable } from '../services/types';

/** Valor de célula como a biblioteca de leitura devolve. */
export type RawCell = string | number | boolean | Date | null | undefined;

export const MAX_IMPORT_ROWS = 20_000;

/**
 * Planilha lida (linhas de células) -> tabela para a API: primeira linha não
 * vazia é o cabeçalho, datas viram ISO 8601, linhas vazias saem, texto longo
 * é cortado. Função pura — testada em `sheet.test.ts`.
 */
export function toImportTable(rows: RawCell[][]): ImportTable {
  const toCell = (value: RawCell): ImportCell => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value === 'string') return value.slice(0, 2000);
    return value;
  };
  const isEmpty = (row: RawCell[]) => row.every((v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === ''));

  const clean = rows.filter((row) => !isEmpty(row));
  const [header, ...body] = clean;
  if (!header) throw new Error('A planilha está vazia.');
  if (body.length > MAX_IMPORT_ROWS) throw new Error(`A planilha tem ${body.length} linhas; o máximo por importação é ${MAX_IMPORT_ROWS}.`);
  const width = header.length;
  return {
    header: header.map(toCell),
    rows: body.map((row) => Array.from({ length: width }, (_, i) => toCell(row[i]))),
  };
}
