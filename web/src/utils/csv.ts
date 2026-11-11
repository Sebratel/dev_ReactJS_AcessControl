/**
 * Leitor de CSV para os exports (ponto e vírgula do Excel/MySQL em pt-BR,
 * vírgula ou tab). Aceita aspas com aspas duplicadas dentro, quebra de linha
 * dentro de aspas, CRLF e BOM. Devolve as linhas como texto — a interpretação
 * fica no servidor. Função pura, testada em `csv.test.ts`.
 */
export function detectDelimiter(firstLine: string): string {
  const candidates = [';', ',', '\t'];
  const counts = candidates.map((d) => firstLine.split(d).length - 1);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best]! > 0 ? candidates[best]! : ';';
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
