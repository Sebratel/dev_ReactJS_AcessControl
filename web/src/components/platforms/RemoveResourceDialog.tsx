import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useRemoveResource } from '../../hooks/useAccessMutations';
import { ApiError } from '../../services/httpClient';
import type { ResourceNode } from '../../services/types';
import { pluralize } from '../../utils/format';
import { subtreeIds } from '../../utils/tree';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Checkbox } from '../ui/Field';

/** Remoção de um item da árvore (e de tudo abaixo). Com acessos ativos, exige confirmar que saem junto. */
export function RemoveResourceDialog({ node, nodes, onClose, onRemoved }: {
  node: ResourceNode | null;
  nodes: ResourceNode[];
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { notify } = useToast();
  const remove = useRemoveResource();
  const [confirmGrants, setConfirmGrants] = useState(false);

  useEffect(() => setConfirmGrants(false), [node]);

  const { childCount, grantCount } = useMemo(() => {
    if (!node) return { childCount: 0, grantCount: 0 };
    const ids = subtreeIds(nodes, node.id);
    const grants = nodes.filter((n) => ids.has(n.id)).reduce((sum, n) => sum + n.activeGrants, 0);
    return { childCount: ids.size - 1, grantCount: grants };
  }, [node, nodes]);

  const confirm = async () => {
    if (!node) return;
    try {
      await remove.mutateAsync({ id: node.id, revokeGrants: grantCount > 0 });
      notify({ tone: 'success', title: 'Item removido', description: grantCount ? `${pluralize(grantCount, 'acesso removido', 'acessos removidos')} junto.` : node.name });
      onRemoved();
      onClose();
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível remover', description: err instanceof ApiError ? err.message : undefined });
    }
  };

  return (
    <Dialog
      open={node !== null}
      onClose={onClose}
      title={`Remover “${node?.name ?? ''}”?`}
      description={childCount > 0 ? `Os ${childCount} itens abaixo dele também saem da árvore.` : 'O item sai da árvore; o histórico continua no log.'}
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={confirm} loading={remove.isPending} disabled={grantCount > 0 && !confirmGrants}>Remover</Button>
        </>
      )}
    >
      {grantCount > 0 && (
        <Checkbox
          label={`Remover também ${pluralize(grantCount, 'acesso ativo', 'acessos ativos')}`}
          description="Cada remoção fica registrada no log com o motivo “Recurso removido”."
          checked={confirmGrants}
          onChange={(e) => setConfirmGrants(e.target.checked)}
        />
      )}
    </Dialog>
  );
}
