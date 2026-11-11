import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_ROWS, toImportTable } from './sheet';

describe('planilha -> tabela de importação', () => {
  it('usa a primeira linha não vazia como cabeçalho e descarta linhas vazias', () => {
    const table = toImportTable([
      [null, null],
      ['id_dashboard', 'email'],
      ['abc', 'ana@sebratel.com.br'],
      ['', '  '],
      ['def', 'bia@sebratel.com.br'],
    ]);
    expect(table.header).toEqual(['id_dashboard', 'email']);
    expect(table.rows).toEqual([['abc', 'ana@sebratel.com.br'], ['def', 'bia@sebratel.com.br']]);
  });

  it('converte datas para ISO, completa linhas curtas com null e corta colunas extras', () => {
    const table = toImportTable([
      ['a', 'b', 'c'],
      [new Date('2026-08-18T12:02:48.647Z'), true],
      [1, 2, 3, 4],
    ]);
    expect(table.rows).toEqual([['2026-08-18T12:02:48.647Z', true, null], [1, 2, 3]]);
  });

  it('recusa planilha vazia e planilha grande demais', () => {
    expect(() => toImportTable([[null], []])).toThrow(/vazia/);
    const huge = [['x'], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ['y'])];
    expect(() => toImportTable(huge)).toThrow(/máximo/);
  });
});
