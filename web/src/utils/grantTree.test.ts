import { describe, expect, it } from 'vitest';
import type { Grant } from '../services/types';
import { buildGrantTree } from './grantTree';

let nextId = 1;
const grant = (over: Partial<Grant>): Grant => ({
  id: nextId++, status: 'ACTIVE', accessLevel: '', source: 'MANUAL', protocolNumber: null, notes: '',
  grantedBy: 'x', grantedAt: '2026-11-11T10:00:00Z', revokedBy: null, revokedAt: null, revokeProtocolNumber: null,
  revokeNotes: '', resourceId: 0, resourceName: '', resourceType: 'DASHBOARD', resourceParentId: null,
  platformId: 1, platformSlug: 'hub-bi', platformName: 'HUB BI', personId: 1, personEmail: 'ana@sebratel.com.br', personName: '',
  ...over,
} as Grant);

describe('árvore única dos acessos de uma pessoa', () => {
  it('agrupa por plataforma e monta hub › dashboard › aba; só os ativos', () => {
    const tree = buildGrantTree([
      grant({ resourceId: 12, resourceParentId: 10, resourceName: 'Vendas', resourceType: 'DASHBOARD' }),
      grant({ resourceId: 10, resourceParentId: null, resourceName: 'Acesso ao HUB BI', resourceType: 'PLATFORM' }),
      grant({ resourceId: 11, resourceParentId: 10, resourceName: 'Atendimento', resourceType: 'DASHBOARD' }),
      grant({ resourceId: 13, resourceParentId: 11, resourceName: 'Aba HSM', resourceType: 'TAB' }),
      grant({ resourceId: 20, resourceParentId: null, resourceName: 'Acesso ao UpValue', resourceType: 'PLATFORM', platformSlug: 'upvalue', platformName: 'UpValue' }),
      grant({ resourceId: 14, resourceParentId: 10, resourceName: 'Removido', status: 'REVOKED' }),
    ]);
    expect(tree.map((p) => [p.name, p.count])).toEqual([['HUB BI', 4], ['UpValue', 1]]);
    const hub = tree[0]!.roots;
    expect(hub.map((n) => n.node.name)).toEqual(['Acesso ao HUB BI']);
    expect(hub[0]!.children.map((n) => n.node.name)).toEqual(['Atendimento', 'Vendas']);
    expect(hub[0]!.children[0]!.children.map((n) => n.node.name)).toEqual(['Aba HSM']);
  });

  it('item sem o nível de cima concedido sobe para a raiz da plataforma, depois do hub', () => {
    const tree = buildGrantTree([
      grant({ resourceId: 33, resourceParentId: 31, resourceName: 'Aba solta', resourceType: 'TAB' }),
      grant({ resourceId: 30, resourceParentId: null, resourceName: 'Acesso ao HUB BI', resourceType: 'PLATFORM' }),
    ]);
    expect(tree[0]!.roots.map((n) => n.node.name)).toEqual(['Acesso ao HUB BI', 'Aba solta']);
  });

  it('sem acessos ativos não há plataforma', () => {
    expect(buildGrantTree([grant({ status: 'REVOKED' })])).toEqual([]);
  });
});
