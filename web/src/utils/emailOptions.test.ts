import { describe, expect, it } from 'vitest';
import { emailOptions, isEmail } from './emailOptions';

describe('lista de e-mails para conceder acesso', () => {
  it('só e-mails únicos, em ordem alfabética, sem diferença de maiúsculas', () => {
    const known = ['zeca@sebratel.com.br', 'Ana@Sebratel.com.br', 'bruno@sebratel.com.br', 'ana@sebratel.com.br ', ''];
    expect(emailOptions(known, [], '').map((o) => o.email)).toEqual(['ana@sebratel.com.br', 'bruno@sebratel.com.br', 'zeca@sebratel.com.br']);
  });

  it('sem limite: traz todos; o texto digitado filtra por trecho do e-mail', () => {
    const known = Array.from({ length: 400 }, (_, i) => `pessoa${String(i).padStart(3, '0')}@sebratel.com.br`);
    expect(emailOptions(known, [], '')).toHaveLength(400);
    expect(emailOptions(known, [], 'PESSOA39').map((o) => o.email)).toEqual(
      Array.from({ length: 10 }, (_, i) => `pessoa39${i}@sebratel.com.br`),
    );
  });

  it('tira quem já foi escolhido', () => {
    expect(emailOptions(['ana@sebratel.com.br', 'bia@sebratel.com.br'], ['ANA@sebratel.com.br'], '').map((o) => o.email)).toEqual(['bia@sebratel.com.br']);
  });

  it('e-mail completo digitado que não está na lista entra no topo como novo — uma vez só', () => {
    expect(emailOptions(['ana@sebratel.com.br'], [], ' Novo@Sebratel.com.br ')[0]).toEqual({ email: 'novo@sebratel.com.br', isNew: true });
    expect(emailOptions(['ana@sebratel.com.br'], [], 'ana@sebratel.com.br').filter((o) => o.isNew)).toEqual([]);
    expect(emailOptions([], ['novo@sebratel.com.br'], 'novo@sebratel.com.br')).toEqual([]);
    expect(emailOptions([], [], 'novo@')).toEqual([]);
  });

  it('reconhece e-mail', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('sem arroba')).toBe(false);
  });
});
