import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useRevokeGrant } from '../../hooks/useAccessMutations';
import { ApiError } from '../../services/httpClient';
import type { Grant } from '../../services/types';
import { pluralize } from '../../utils/format';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Textarea } from '../ui/Field';
import { Dialog } from '../ui/Dialog';

/** Confirmação de remoção de acesso, com protocolo e observação para o log. */
export function RevokeDialog({ grant, defaultProtocol, onClose }: {
  grant: Grant | null;
  defaultProtocol?: string;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const revoke = useRevokeGrant();
  const [protocol, setProtocol] = useState('');
  const [notes, setNotes] = useState('');
  const [includeDescendants, setIncludeDescendants] = useState(true);

  useEffect(() => {
    if (grant) {
      setProtocol(defaultProtocol ?? '');
      setNotes('');
      setIncludeDescendants(true);
    }
  }, [grant, defaultProtocol]);

  const invalidProtocol = protocol.trim() !== '' && !/^\d{1,20}$/.test(protocol.trim());

  const confirm = async () => {
    if (!grant || invalidProtocol) return;
    try {
      const result = await revoke.mutateAsync({
        id: grant.id,
        input: { includeDescendants, protocolNumber: protocol.trim() || null, notes: notes.trim() },
      });
      notify({ tone: 'success', title: pluralize(result.revoked.length, 'acesso removido', 'acessos removidos'), description: grant.personEmail });
      onClose();
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível remover', description: err instanceof ApiError ? err.message : 'Tente novamente.' });
    }
  };

  return (
    <Dialog
      open={grant !== null}
      onClose={onClose}
      title="Remover acesso"
      description={grant && (
        <>
          <strong className="text-on-surface">{grant.personEmail}</strong> deixa de ter acesso a{' '}
          <strong className="text-on-surface">{grant.resourceName}</strong> ({grant.platformName}). Fica registrado no log.
        </>
      )}
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={confirm} loading={revoke.isPending} disabled={invalidProtocol}>Remover acesso</Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Protocolo (opcional)" error={invalidProtocol ? 'Só números' : undefined}>
          {(id) => <Input id={id} value={protocol} onChange={(e) => setProtocol(e.target.value)} inputMode="numeric" placeholder="Nº no Voalle" />}
        </Field>
        <Field label="Motivo / observação (opcional)">
          {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <Checkbox
          label="Remover também os níveis abaixo"
          description="Abas e funcionalidades deste item que a pessoa tiver."
          checked={includeDescendants}
          onChange={(e) => setIncludeDescendants(e.target.checked)}
        />
      </div>
    </Dialog>
  );
}
