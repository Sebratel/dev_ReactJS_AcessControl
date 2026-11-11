import { ChevronRight, Plus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ResourceNode } from '../../services/types';
import { cn } from '../../utils/cn';
import { RESOURCE_TYPE_ICON } from '../../utils/labels';
import { buildTree, matchingIds, type TreeNode } from '../../utils/tree';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';

/**
 * A árvore da plataforma (hub › dashboard/aplicação › aba/funcionalidade),
 * com quantas pessoas têm acesso em cada nó. Clicar seleciona o nó.
 */
export function ResourceTree({ nodes, selectedId, onSelect, onAddChild, canEdit }: {
  nodes: ResourceNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAddChild: (parent: ResourceNode) => void;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const visible = useMemo(() => matchingIds(nodes, query), [nodes, query]);
  const root = nodes.find((n) => n.parentId === null);

  const toggle = (id: number) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderNode = (item: TreeNode<ResourceNode>) => {
    const { node } = item;
    if (visible && !visible.has(node.id)) return null;
    const Icon = RESOURCE_TYPE_ICON[node.resourceType];
    const hasChildren = item.children.length > 0;
    const isCollapsed = !visible && collapsed.has(node.id);
    const active = node.id === selectedId;
    return (
      <li key={node.id}>
        <div
          className={cn('group flex min-h-10 items-center gap-1 rounded-xl pr-1.5 transition', active ? 'bg-primary-soft ring-1 ring-primary-text/25' : 'hover:bg-surface-hover')}
          style={{ paddingLeft: `${item.depth * 16 + 2}px` }}
        >
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low', !hasChildren && 'invisible')}
            aria-label={isCollapsed ? `Abrir ${node.name}` : `Recolher ${node.name}`}
            aria-expanded={!isCollapsed}
          >
            <ChevronRight size={14} className={cn('transition', !isCollapsed && 'rotate-90')} />
          </button>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-[13.5px] focus-visible:outline-none"
            aria-current={active ? 'true' : undefined}
          >
            <Icon size={15} aria-hidden className={cn('shrink-0', active ? 'text-primary-text' : 'text-on-surface-variant')} />
            <span className={cn('min-w-0 truncate', node.parentId === null ? 'font-bold' : 'font-medium', active ? 'text-primary-text' : 'text-on-surface')}>{node.name}</span>
          </button>
          <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-on-surface-variant" title={`${node.activeGrants} pessoa(s) com acesso`}>
            <Users size={11} aria-hidden />{node.activeGrants}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onAddChild(node)}
              className="grid size-7 place-items-center rounded-lg text-on-surface-variant opacity-0 transition hover:bg-surface-container-low hover:text-primary-text focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
              aria-label={`Adicionar item dentro de ${node.name}`}
              title="Adicionar item dentro deste"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        {hasChildren && !isCollapsed && <ul>{item.children.map(renderNode)}</ul>}
      </li>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar na árvore…" className="pl-9" aria-label="Buscar na árvore" />
        </div>
        {canEdit && root && (
          <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => onAddChild(root)} className="shrink-0 max-sm:px-3" aria-label="Adicionar item na raiz">
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        )}
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">{tree.map(renderNode)}</ul>
      {visible && visible.size === 0 && <p className="px-2 text-sm text-on-surface-variant">Nada encontrado.</p>}
    </div>
  );
}
