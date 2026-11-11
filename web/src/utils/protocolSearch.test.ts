import { describe, expect, it } from 'vitest';
import type { Protocol } from '../services/types';
import { searchProtocols } from './protocolSearch';

const protocol = (over: Partial<Protocol>): Protocol => ({
  assignmentId: 1, protocolNumber: '1', title: '', statusLabel: '', state: 'OPEN', requestType: 'INCLUSION',
  platformSlug: null, suggestedPlatformSlug: null, category2: null, category3: null, solution: null, team: null,
  requesterName: null, requesterEmail: null, targetEmail: null, informedEmail: null, isInformedEmailValid: false,
  requestedItems: [], descriptionText: '', responsibleName: null, createdAt: null, deadline: null,
  deliveryDeadline: null, closedAt: null, linkedProtocols: [], totalDays: null, isLate: false, daysLate: null,
  note: '', isHandled: false,
  ...over,
} as Protocol);

const LIST = [
  protocol({ protocolNumber: '1880001', state: 'CLOSED', platformSlug: 'hub-bi', requesterName: 'Ana Souza', createdAt: '2026-11-01T10:00:00Z' }),
  protocol({ protocolNumber: '1886260', state: 'OPEN', platformSlug: 'hub-bi', requesterName: 'Fábio Teste', targetEmail: 'fabio.teste@sebratel.com.br', requestedItems: ['dash Suporte'], createdAt: '2026-11-11T10:00:00Z' }),
  protocol({ protocolNumber: '1886300', state: 'OPEN', suggestedPlatformSlug: 'upvalue', requesterName: 'Bia Lima', createdAt: '2026-11-11T12:00:00Z' }),
  protocol({ protocolNumber: '1870000', state: 'CANCELED', platformSlug: 'hub-bi', requesterName: 'Ana Souza', createdAt: '2026-10-01T10:00:00Z' }),
];

describe('busca de protocolo para vincular', () => {
  it('sem busca: abertos primeiro, os da plataforma atual na frente, depois os mais novos', () => {
    expect(searchProtocols(LIST, '', 'hub-bi').map((p) => p.protocolNumber)).toEqual(['1886260', '1886300', '1880001', '1870000']);
    expect(searchProtocols(LIST, '', 'upvalue').map((p) => p.protocolNumber)).toEqual(['1886300', '1886260', '1880001', '1870000']);
  });

  it('número casa por trecho e o exato vem primeiro', () => {
    expect(searchProtocols(LIST, '18862', null).map((p) => p.protocolNumber)).toEqual(['1886260']);
    expect(searchProtocols(LIST, '1880001', null)[0]!.protocolNumber).toBe('1880001');
  });

  it('texto casa todas as palavras, sem acento, em nome, e-mail e pedido', () => {
    expect(searchProtocols(LIST, 'fabio suporte', null).map((p) => p.protocolNumber)).toEqual(['1886260']);
    expect(searchProtocols(LIST, 'ANA', null).map((p) => p.protocolNumber)).toEqual(['1880001', '1870000']);
    expect(searchProtocols(LIST, 'ninguém', null)).toEqual([]);
  });

  it('respeita o limite', () => {
    expect(searchProtocols(LIST, '', null, 2)).toHaveLength(2);
  });
});
