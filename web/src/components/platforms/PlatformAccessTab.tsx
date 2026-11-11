import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { usePlatformResources } from '../../hooks/usePlatforms';
import type { Platform, ResourceNode } from '../../services/types';
import { DEFAULT_TOP_TYPE, CHILD_TYPES } from '../../utils/labels';
import { Card } from '../ui/Card';
import { ErrorState, LoadingState } from '../ui/States';
import { RemoveResourceDialog } from './RemoveResourceDialog';
import { ResourceDetail } from './ResourceDetail';
import { ResourceFormDialog, type ResourceDialogState } from './ResourceFormDialog';
import { ResourceTree } from './ResourceTree';

/** Árvore à esquerda, detalhe do item à direita (empilhados no celular). */
export function PlatformAccessTab({ platform }: { platform: Platform }) {
  const { canEdit } = useSession();
  const resources = usePlatformResources(platform.slug);
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<ResourceDialogState>(null);
  const [removing, setRemoving] = useState<ResourceNode | null>(null);
  const nodes = useMemo(() => resources.data ?? [], [resources.data]);

  const selectedParam = Number(params.get('item'));
  const selected = nodes.find((n) => n.id === selectedParam) ?? nodes.find((n) => n.parentId === null) ?? null;

  const select = (id: number) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('item', String(id));
    return next;
  }, { replace: true });

  // item removido/inexistente na URL: volta para a raiz sem deixar lixo no endereço
  useEffect(() => {
    if (params.get('item') && nodes.length && !nodes.some((n) => n.id === selectedParam)) {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        return next;
      }, { replace: true });
    }
  }, [nodes, params, selectedParam, setParams]);

  const addChild = (parent: ResourceNode) => {
    const defaultType = parent.parentId === null ? DEFAULT_TOP_TYPE[platform.slug] ?? 'DASHBOARD' : CHILD_TYPES[parent.resourceType][0] ?? 'FEATURE';
    setDialog({ mode: 'create', parent, defaultType });
  };

  if (resources.isLoading) return <LoadingState label="Carregando a árvore…" />;
  if (resources.isError) return <ErrorState message="Não foi possível carregar a árvore desta plataforma." />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
      <Card className="p-3 lg:sticky lg:top-[calc(var(--h-topbar)+var(--h-nav)+10px)] lg:max-h-[calc(100dvh-var(--h-topbar)-var(--h-nav)-20px)] lg:overflow-y-auto">
        <ResourceTree nodes={nodes} selectedId={selected?.id ?? null} onSelect={select} onAddChild={addChild} canEdit={canEdit} />
        {nodes.length <= 1 && (
          <p className="mt-3 rounded-xl bg-surface-container-low p-3 text-[13px] text-on-surface-variant">
            Cadastre aqui os {platform.slug === 'aplicacoes' || platform.slug === 'appsheet' ? 'aplicativos' : 'dashboards'} de {platform.name} e,
            dentro de cada um, as abas ou controles internos que têm acesso próprio.
          </p>
        )}
      </Card>
      {selected && (
        <ResourceDetail
          node={selected}
          nodes={nodes}
          platform={platform}
          onEdit={(node) => setDialog({ mode: 'edit', node })}
          onRemove={setRemoving}
        />
      )}
      <ResourceFormDialog state={dialog} onClose={() => setDialog(null)} onSaved={(node) => select(node.id)} />
      <RemoveResourceDialog
        node={removing}
        nodes={nodes}
        onClose={() => setRemoving(null)}
        onRemoved={() => removing?.parentId && select(removing.parentId)}
      />
    </div>
  );
}
