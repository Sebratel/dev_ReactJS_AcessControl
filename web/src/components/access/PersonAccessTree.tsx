import { ChevronRight, FileText, UserMinus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Grant } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDate, formatDateTime, pluralize } from '../../utils/format';
import { buildGrantTree, type GrantNode } from '../../utils/grantTree';
import { platformIcon, RESOURCE_TYPE_ICON } from '../../utils/labels';
import type { TreeNode } from '../../utils/tree';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/Button';

const SOURCE_LABEL: Record<Grant['source'], string> = { MANUAL: 'Manual', PROTOCOL: 'Protocolo', IMPORT: 'Importado' };

/**
 * Tudo o que uma pessoa tem, numa árvore única: cada plataforma abre e fecha
 * como um dropdown, com hub › dashboard/aplicação › aba por dentro. Quem edita
 * remove um item direto da árvore.
 */
export function PersonAccessTree({ grants, canEdit, onRevoke }: {
  grants: Grant[];
  canEdit: boolean;
  onRevoke?: (grant: Grant) => void;
}) {
  const tree = useMemo(() => buildGrantTree(grants), [grants]);
  // uma plataforma só já vem aberta; várias vêm fechadas, com a contagem
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.length === 1 ? [tree[0]!.slug] : []));
  const [closedNodes, setClosedNodes] = useState<Set<number>>(new Set());

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  if (!tree.length) return <p className="py-3 text-sm text-on-surface-variant">Nenhum acesso ativo.</p>;

  const renderNode = (item: TreeNode<GrantNode>) => {
    const g = item.node.grant;
    const Icon = RESOURCE_TYPE_ICON[g.resourceType];
    const hasChildren = item.children.length > 0;
    const isOpen = !closedNodes.has(g.resourceId);
    return (
      <li key={g.id}>
        <div className="group flex min-h-9 items-center gap-1.5 rounded-lg pr-1 hover:bg-surface-hover" style={{ paddingLeft: `${item.depth * 18 + 22}px` }}>
          <button
            type="button"
            onClick={() => setClosedNodes((s) => toggle(s, g.resourceId))}
            className={cn('grid size-6 shrink-0 place-items-center rounded-md text-on-surface-variant', !hasChildren && 'invisible')}
            aria-label={isOpen ? `Recolher ${g.resourceName}` : `Abrir ${g.resourceName}`}
            aria-expanded={hasChildren ? isOpen : undefined}
          >
            <ChevronRight size={14} className={cn('transition', isOpen && 'rotate-90')} />
          </button>
          <Icon size={14} aria-hidden className="shrink-0 text-primary-text" />
          <div className="min-w-0 flex-1 py-1">
            <p className={cn('truncate text-[13px] text-on-surface', item.node.parentId === null && 'font-semibold')} title={g.notes || undefined}>
              {g.resourceName}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-on-surface-variant">
              <span title={formatDateTime(g.grantedAt)}>desde {formatDate(g.grantedAt)}</span>
              {g.protocolNumber && <span className="inline-flex items-center gap-0.5 font-mono"><FileText size={11} aria-hidden />{g.protocolNumber}</span>}
              <span>{SOURCE_LABEL[g.source]}</span>
              {g.accessLevel && <Badge tone="accent">{g.accessLevel}</Badge>}
            </p>
          </div>
          {canEdit && onRevoke && (
            <IconButton label={`Remover acesso a ${g.resourceName}`} onClick={() => onRevoke(g)} className="text-rose-700 dark:text-rose-300">
              <UserMinus size={15} />
            </IconButton>
          )}
        </div>
        {hasChildren && isOpen && <ul>{item.children.map(renderNode)}</ul>}
      </li>
    );
  };

  const allOpen = tree.every((p) => open.has(p.slug));
  return (
    <div className="grid grid-cols-1 gap-1">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setOpen(allOpen ? new Set() : new Set(tree.map((p) => p.slug)));
            setClosedNodes(new Set());
          }}
          className="text-[12px] font-semibold text-primary-text hover:underline"
        >
          {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-1">
        {tree.map((platform) => {
          const PlatformIcon = platformIcon(platform.slug);
          const isOpen = open.has(platform.slug);
          return (
            <li key={platform.slug} className="rounded-lg border border-outline bg-surface-container-lowest">
              <button
                type="button"
                onClick={() => setOpen((s) => toggle(s, platform.slug))}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-on-surface hover:bg-surface-hover"
              >
                <ChevronRight size={15} aria-hidden className={cn('shrink-0 text-on-surface-variant transition', isOpen && 'rotate-90')} />
                <PlatformIcon size={15} aria-hidden className="shrink-0 text-primary-text" />
                <span className="flex-1">{platform.name}</span>
                <span className="text-xs font-normal text-on-surface-variant">{pluralize(platform.count, 'item', 'itens')}</span>
              </button>
              {isOpen && <ul className="border-t border-outline px-1 py-1">{platform.roots.map(renderNode)}</ul>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
