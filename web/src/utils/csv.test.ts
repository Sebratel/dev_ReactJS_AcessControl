import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from './csv';

describe('leitor de CSV dos exports', () => {
  it('lê ponto e vírgula com BOM e CRLF', () => {
    const rows = parseCsv('﻿id;name;email\r\nu1;Ana;ana@sebratel.com.br\r\nu2;Bia;bia@sebratel.com.br');
    expect(rows).toEqual([['id', 'name', 'email'], ['u1', 'Ana', 'ana@sebratel.com.br'], ['u2', 'Bia', 'bia@sebratel.com.br']]);
  });

  it('respeita aspas com delimitador, aspas duplicadas e quebra de linha dentro', () => {
    const rows = parseCsv('app;usuarios\n"Relatórios; Gerais";"Ana | Bia ""B"""\n"Multi\nlinha";x\n');
    expect(rows).toEqual([['app', 'usuarios'], ['Relatórios; Gerais', 'Ana | Bia "B"'], ['Multi\nlinha', 'x']]);
  });

  it('mantém campos vazios e detecta vírgula ou tab', () => {
    expect(parseCsv('a;b;c\n1;;3')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a\tb')).toBe('\t');
    expect(detectDelimiter('sozinha')).toBe(';');
  });
});
