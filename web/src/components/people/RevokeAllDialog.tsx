import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useRevokeAll } from '../../hooks/useAccessMutations';
import { ApiError } from '../../services/httpClient';
import type { Grant, Person, Platform } from '../../services/types';
import { pluralize } from '../../utils/format';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field, Input, Select, Textarea } from '../ui/Field';

/** Desligamento / troca de área: remove todos os acessos (de uma plataforma ou de todas). */
export function RevokeAllDialog({ person, grants, platforms, open, onClose }: {
  person: Person;
  grants: Grant[];
  platforms: Platform[];
  open: boolean;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const revokeAll = useRevokeAll();
  const [platformSlug, setPlatformSlug] = useState('');
  const [protocol, setProtocol] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPlatformSlug('');
      setProtocol('');
      setNotes('');
    }
  }, [open]);

  const active = grants.filter((g) => g.status === 'ACTIVE' && (!platformSlug || g.platformSlug === platformSlug));
  const invalidProtocol = protocol.trim() !== '' && !/^\d{1,20}$/.test(protocol.trim());
  const withAccess = platforms.filter((p) => grants.some((g) => g.status === 'ACTIVE' && g.platformSlug === p.slug));

  const confirm = async () => {
    try {
      const result = await revokeAll.mutateAsync({
        personId: person.id,
        input: { platformSlug: platformSlug || null, protocolNumber: protocol.trim() || null, notes: notes.trim() },
      });
      notify({ tone: 'success', title: pluralize(result.revoked.length, 'acesso removido', 'acessos removidos'), description: person.email });
      onClose();
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível remover', description: err instanceof ApiError ? err.message : undefined });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Remover todos os acessos"
      description={`${person.name || person.email} perde ${pluralize(active.length, 'acesso', 'acessos')}. Cada remoção vai para o log.`}
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={confirm} loading={revokeAll.isPending} disabled={!active.length || invalidProtocol}>
            Remover {active.length}
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="De onde">
          {(id) => (
            <Select id={id} value={platformSlug} onChange={(e) => setPlatformSlug(e.target.value)}>
              <option value="">Todas as plataformas</option>
              {withAccess.map((p) => <option key={p.slug} value={p.slug}>Só {p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Protocolo (opcional)" error={invalidProtocol ? 'Só números' : undefined}>
          {(id) => <Input id={id} inputMode="numeric" value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="Nº no Voalle" />}
        </Field>
        <Field label="Motivo (opcional)">
          {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: desligamento, mudança de área" />}
        </Field>
      </div>
    </Dialog>
  );
}
