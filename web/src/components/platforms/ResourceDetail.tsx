import { ExternalLink, Pencil, ShieldPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { useResourceGrants } from '../../hooks/useAccessQueries';
import type { Grant, Platform, ResourceNode } from '../../services/types';
import { formatDate, pluralize } from '../../utils/format';
import { RESOURCE_TYPE_ICON, RESOURCE_TYPE_LABEL } from '../../utils/labels';
import { nodePath } from '../../utils/tree';
import { GrantList } from '../access/GrantList';
import { GrantPeopleForm } from '../access/GrantPeopleForm';
import { RevokeDialog } from '../access/RevokeDialog';
import { personPath } from '../layout/pages';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Field';
import { EmptyState, LoadingState } from '../ui/States';

/** Painel do nó selecionado: dados, quem tem acesso e o formulário para conceder. */
export function ResourceDetail({ node, nodes, platform, onEdit, onRemove }: {
  node: ResourceNode;
  nodes: ResourceNode[];
  platform: Platform;
  onEdit: (node: ResourceNode) => void;
  onRemove: (node: ResourceNode) => void;
}) {
  const { canEdit } = useSession();
  const [showRevoked, setShowRevoked] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const grants = useResourceGrants(node.id, showRevoked ? undefined : 'ACTIVE');
  const Icon = RESOURCE_TYPE_ICON[node.resourceType];
  const isRoot = node.parentId === null;
  // caminho até o PAI (o nome do próprio item já é o título)
  const path = node.parentId !== null ? nodePath(nodes, node.parentId) : '';

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text ring-1 ring-inset ring-primary-text/15">
            <Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-on-surface-variant">
              {RESOURCE_TYPE_LABEL[node.resourceType]}{!isRoot ? ` · ${[platform.name, path].filter(Boolean).join(' › ')}` : ''}
            </p>
            <h2 className="break-words text-lg font-bold tracking-tight text-on-surface">{node.name}</h2>
            {node.description && <p className="mt-1 text-sm text-on-surface-variant">{node.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
              <Badge tone="brand">{pluralize(node.activeGrants, 'pessoa com acesso', 'pessoas com acesso')}</Badge>
              {!node.isAccessControlled && <Badge>Herda do nível acima</Badge>}
              {node.owner && <Badge tone="accent">Dono: {node.owner}</Badge>}
              <span>cadastrado em {formatDate(node.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {node.url && (
              <a href={node.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-outline px-3 text-[13px] font-semibold text-primary-text hover:bg-surface-hover">
                <ExternalLink size={14} aria-hidden />Abrir
              </a>
            )}
            {canEdit && <Button size="sm" icon={<Pencil size={14} aria-hidden />} onClick={() => onEdit(node)}>Editar</Button>}
            {canEdit && !isRoot && <Button size="sm" variant="danger" icon={<Trash2 size={14} aria-hidden />} onClick={() => onRemove(node)}>Remover</Button>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Quem tem acesso"
          subtitle={isRoot ? `Acesso à ferramenta ${platform.name} em si.` : 'Pessoas liberadas neste item.'}
          actions={(
            <>
              <Checkbox label="Mostrar removidos" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} />
              {canEdit && (
                <Button size="sm" variant="primary" icon={<ShieldPlus size={14} aria-hidden />} onClick={() => setGranting((v) => !v)}>
                  {granting ? 'Fechar' : 'Conceder acesso'}
                </Button>
              )}
            </>
          )}
        />
        {granting && canEdit && (
          <div className="border-b border-outline bg-surface-container-low p-4 sm:p-5">
            <GrantPeopleForm key={node.id} resource={node} platformSlug={platform.slug} onDone={() => setGranting(false)} />
          </div>
        )}
        <div className="px-4 sm:px-5">
          {grants.isLoading && <LoadingState className="py-6" />}
          {grants.data && grants.data.length === 0 && (
            <EmptyState className="my-4" title="Ninguém com acesso registrado" description="Use “Conceder acesso” ou atenda um protocolo na fila." />
          )}
          {grants.data && grants.data.length > 0 && (
            <GrantList grants={grants.data} mode="people" canEdit={canEdit} onRevoke={setRevoking} personHref={personPath} />
          )}
        </div>
      </Card>
      <RevokeDialog grant={revoking} onClose={() => setRevoking(null)} />
    </div>
  );
}
