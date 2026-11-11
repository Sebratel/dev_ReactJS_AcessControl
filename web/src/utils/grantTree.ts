import type { Grant } from '../services/types';
import { normalizeText } from './format';
import { buildTree, type FlatNode, type TreeNode } from './tree';

export interface GrantNode extends FlatNode {
  grant: Grant;
}

export interface PlatformGrants {
  slug: string;
  name: string;
  /** quantos itens a pessoa tem nesta plataforma */
  count: number;
  roots: TreeNode<GrantNode>[];
}

const byName = (a: TreeNode<GrantNode>, b: TreeNode<GrantNode>) =>
  Number(b.node.parentId === null) - Number(a.node.parentId === null)
  || normalizeText(a.node.name).localeCompare(normalizeText(b.node.name), 'pt-BR');

const sortDeep = (items: TreeNode<GrantNode>[]): TreeNode<GrantNode>[] =>
  items.sort(byName).map((item) => ({ ...item, children: sortDeep(item.children) }));

/**
 * Os acessos ativos de uma pessoa numa árvore única: plataforma › hub ›
 * dashboard/aplicação › aba. Item cujo nível de cima não foi concedido sobe
 * para a raiz da plataforma (não some). Hub primeiro, o resto por nome.
 * Função pura — testada em `grantTree.test.ts`.
 */
export function buildGrantTree(grants: Grant[]): PlatformGrants[] {
  const byPlatform = new Map<string, Grant[]>();
  grants.filter((g) => g.status === 'ACTIVE').forEach((g) => {
    byPlatform.set(g.platformSlug, [...(byPlatform.get(g.platformSlug) ?? []), g]);
  });
  return [...byPlatform.entries()]
    .map(([slug, list]) => ({
      slug,
      name: list[0]!.platformName,
      count: list.length,
      roots: sortDeep(buildTree(list.map((g) => ({ id: g.resourceId, parentId: g.resourceParentId, name: g.resourceName, grant: g })))),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
