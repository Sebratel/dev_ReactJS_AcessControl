import { describe, expect, it } from 'vitest';
import { ancestorIds, buildTree, matchingIds, nodePath, subtreeIds } from './tree';

const nodes = [
  { id: 1, parentId: null, name: 'Acesso ao HUB BI' },
  { id: 2, parentId: 1, name: 'Relatórios de Atendimento' },
  { id: 3, parentId: 2, name: 'Aba Tags Matrix' },
  { id: 4, parentId: 2, name: 'Aba HSM' },
  { id: 5, parentId: 1, name: 'Financeiro' },
  { id: 6, parentId: 99, name: 'Órfão' },
];

describe('árvore de recursos', () => {
  it('monta a hierarquia com profundidade e sobe órfãos para a raiz', () => {
    const roots = buildTree(nodes);
    expect(roots.map((r) => r.node.id)).toEqual([1, 6]);
    expect(roots[0]!.children.map((c) => c.node.id)).toEqual([2, 5]);
    expect(roots[0]!.children[0]!.children[1]!.depth).toBe(2);
  });

  it('lista ancestrais do pai até a raiz', () => {
    expect(ancestorIds(nodes, 3)).toEqual([2, 1]);
    expect(ancestorIds(nodes, 1)).toEqual([]);
  });

  it('pega a sub-árvore inteira', () => {
    expect([...subtreeIds(nodes, 2)].sort()).toEqual([2, 3, 4]);
  });

  it('monta o caminho sem a raiz', () => {
    expect(nodePath(nodes, 3)).toBe('Relatórios de Atendimento › Aba Tags Matrix');
    expect(nodePath(nodes, 3, true)).toBe('Acesso ao HUB BI › Relatórios de Atendimento › Aba Tags Matrix');
  });

  it('busca sem acento e mantém o caminho até o nó encontrado', () => {
    const visible = matchingIds(nodes, 'relatorios');
    expect(visible && [...visible].sort()).toEqual([1, 2]);
    expect(matchingIds(nodes, '   ')).toBeNull();
    expect(matchingIds(nodes, 'hsm')).toEqual(new Set([4, 2, 1]));
  });
});
