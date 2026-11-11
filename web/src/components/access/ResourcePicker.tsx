import { ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ResourceNode } from '../../services/types';
import { cn } from '../../utils/cn';
import { RESOURCE_TYPE_ICON } from '../../utils/labels';
import { buildTree, matchingIds, type TreeNode } from '../../utils/tree';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Field';

/**
 * Escolha de recursos na árvore (com caixas de seleção). Mostra o que é
 * sugestão (casou com o pedido do protocolo); o que a pessoa já tem fica
 * marcado e travado.
 */
export function ResourcePicker({ nodes, selected, onChange, suggestedIds, ownedIds }: {
  nodes: ResourceNode[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  suggestedIds?: Set<number>;
  ownedIds?: Set<number>;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const visible = useMemo(() => matchingIds(nodes, query), [nodes, query]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (item: TreeNode<ResourceNode>) => {
    const { node } = item;
    if (visible && !visible.has(node.id)) return null;
    const Icon = RESOURCE_TYPE_ICON[node.resourceType];
    const hasChildren = item.children.length > 0;
    const isCollapsed = !visible && collapsed.has(node.id);
    const owned = ownedIds?.has(node.id) ?? false;
    return (
      <li key={node.id}>
        <div
          className={cn(
            'flex min-h-10 items-center gap-1.5 rounded-xl pr-2 transition hover:bg-surface-hover',
            selected.has(node.id) && !owned && 'bg-primary-soft',
          )}
          style={{ paddingLeft: `${item.depth * 18 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => toggleCollapse(node.id)}
            className={cn('grid size-6 place-items-center rounded-md text-on-surface-variant', !hasChildren && 'invisible')}
            aria-label={isCollapsed ? `Abrir ${node.name}` : `Recolher ${node.name}`}
          >
            <ChevronRight size={14} className={cn('transition', !isCollapsed && 'rotate-90')} />
          </button>
          <label
            className={cn('flex min-w-0 flex-1 items-center gap-2 py-1.5 text-[13px]', owned || !node.isAccessControlled ? 'cursor-not-allowed' : 'cursor-pointer')}
            title={owned ? 'A pessoa já tem este acesso' : undefined}
          >
            <input
              type="checkbox"
              checked={owned || selected.has(node.id)}
              onChange={() => toggle(node.id)}
              disabled={owned || !node.isAccessControlled}
              className="size-4 shrink-0 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
            />
            <Icon size={14} aria-hidden className="shrink-0 text-primary-text" />
            <span className={cn('min-w-0 truncate', node.parentId === null ? 'font-semibold' : 'text-on-surface', owned && 'text-on-surface-variant')}>{node.name}</span>
          </label>
          {suggestedIds?.has(node.id) && <Badge tone="accent">Sugerido</Badge>}
          {owned && <Badge tone="success">Já tem</Badge>}
          {!node.isAccessControlled && <Badge title="Sem controle de acesso próprio: herda do nível acima">Herdado</Badge>}
        </div>
        {hasChildren && !isCollapsed && <ul>{item.children.map(renderNode)}</ul>}
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      {nodes.length > 8 && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar dashboard, aplicação, aba…" className="pl-9" aria-label="Buscar recurso" />
        </div>
      )}
      <ul className="grid max-h-80 grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-lg border border-outline bg-surface-container-lowest p-1.5">{tree.map(renderNode)}</ul>
    </div>
  );
}
