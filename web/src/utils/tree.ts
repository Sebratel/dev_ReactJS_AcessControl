/**
 * Árvore de recursos: a API manda a lista achatada (id + parentId) e a tela
 * monta a hierarquia aqui. Funções puras — testadas em `tree.test.ts`.
 */
import { normalizeText } from './format';

export interface FlatNode {
  id: number;
  parentId: number | null;
  name: string;
}

export interface TreeNode<T extends FlatNode> {
  node: T;
  depth: number;
  children: TreeNode<T>[];
}

export function buildTree<T extends FlatNode>(nodes: T[]): TreeNode<T>[] {
  const byId = new Map<number, TreeNode<T>>();
  nodes.forEach((node) => byId.set(node.id, { node, depth: 0, children: [] }));
  const roots: TreeNode<T>[] = [];
  nodes.forEach((node) => {
    const item = byId.get(node.id)!;
    const parent = node.parentId !== null ? byId.get(node.parentId) : undefined;
    // pai removido/ausente: o nó sobe para a raiz em vez de sumir da tela
    if (parent) parent.children.push(item);
    else roots.push(item);
  });
  const setDepth = (items: TreeNode<T>[], depth: number) => {
    items.forEach((item) => {
      item.depth = depth;
      setDepth(item.children, depth + 1);
    });
  };
  setDepth(roots, 0);
  return roots;
}

/** Ids dos ancestrais de um nó (do pai até a raiz). */
export function ancestorIds<T extends FlatNode>(nodes: T[], id: number): number[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result: number[] = [];
  let current = byId.get(id);
  const guard = new Set<number>();
  while (current && current.parentId !== null && !guard.has(current.parentId)) {
    guard.add(current.parentId);
    result.push(current.parentId);
    current = byId.get(current.parentId);
  }
  return result;
}

/** Ids do nó e de todos abaixo dele. */
export function subtreeIds<T extends FlatNode>(nodes: T[], id: number): Set<number> {
  const children = new Map<number, number[]>();
  nodes.forEach((n) => {
    if (n.parentId === null) return;
    const list = children.get(n.parentId) ?? [];
    list.push(n.id);
    children.set(n.parentId, list);
  });
  const result = new Set<number>([id]);
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    (children.get(current) ?? []).forEach((child) => {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    });
  }
  return result;
}

/** Caminho legível de um nó ("Dashboard X › Aba Y"), sem a raiz da plataforma. */
export function nodePath<T extends FlatNode>(nodes: T[], id: number, includeRoot = false): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain = [id, ...ancestorIds(nodes, id)].reverse().map((nid) => byId.get(nid)).filter((n): n is T => Boolean(n));
  return (includeRoot ? chain : chain.filter((n) => n.parentId !== null)).map((n) => n.name).join(' › ');
}

const normalize = normalizeText;

/**
 * Busca na árvore: devolve os ids que devem aparecer — quem bate na busca e
 * todos os ancestrais (para o caminho até ele continuar visível).
 */
export function matchingIds<T extends FlatNode>(nodes: T[], query: string): Set<number> | null {
  const q = normalize(query.trim());
  if (!q) return null;
  const visible = new Set<number>();
  nodes.forEach((n) => {
    if (normalize(n.name).includes(q)) {
      visible.add(n.id);
      ancestorIds(nodes, n.id).forEach((a) => visible.add(a));
    }
  });
  return visible;
}
