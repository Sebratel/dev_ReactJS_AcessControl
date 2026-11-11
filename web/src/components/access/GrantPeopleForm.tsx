import { ShieldPlus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import { useGrantAccessBatch } from '../../hooks/useAccessMutations';
import { useResourceGrants } from '../../hooks/useAccessQueries';
import { ApiError } from '../../services/httpClient';
import type { Protocol, ResourceNode } from '../../services/types';
import { isEmail } from '../../utils/emailOptions';
import { pluralize } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { PeoplePicker } from './PeoplePicker';
import { ProtocolPicker } from './ProtocolPicker';

/**
 * Conceder acesso a um item da árvore: quem recebe (várias pessoas, numa lista
 * pesquisável), o protocolo que justifica (obrigatório) e uma observação.
 * Os níveis acima entram junto — quem ainda não tem o hub ganha o hub.
 */
export function GrantPeopleForm({ resource, platformSlug, onDone }: {
  resource: ResourceNode;
  platformSlug: string;
  onDone?: () => void;
}) {
  const { notify } = useToast();
  const grant = useGrantAccessBatch();
  const current = useResourceGrants(resource.id, 'ACTIVE');
  const lockedEmails = useMemo(() => new Set((current.data ?? []).map((g) => g.personEmail.toLowerCase())), [current.data]);
  const [people, setPeople] = useState<string[]>([]);
  const [protocolNumber, setProtocolNumber] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ people?: string; protocol?: string }>({});

  const onProtocol = (number: string | null, protocol: Protocol | null) => {
    setProtocolNumber(number);
    if (number) setErrors((e) => ({ ...e, protocol: undefined }));
    // protocolo escolhido e ninguém na lista ainda: já traz quem o protocolo pede
    const target = protocol?.targetEmail?.toLowerCase();
    if (protocol && target && isEmail(target) && people.length === 0 && !lockedEmails.has(target)) {
      setPeople([target]);
      setErrors((e) => ({ ...e, people: undefined }));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      people: people.length ? undefined : 'Escolha ao menos uma pessoa.',
      protocol: protocolNumber ? undefined : 'Escolha o protocolo que pediu este acesso.',
    };
    setErrors(next);
    if (next.people || next.protocol) return;
    try {
      const result = await grant.mutateAsync({
        emails: people,
        resourceIds: [resource.id],
        includeAncestors: true,
        protocolNumber: protocolNumber!,
        notes: notes.trim(),
      });
      notify({
        tone: 'success',
        title: result.created.length ? pluralize(result.created.length, 'acesso registrado', 'acessos registrados') : 'Nada novo para registrar',
        description: `${pluralize(result.peopleCount, 'pessoa', 'pessoas')} · protocolo ${protocolNumber}`,
      });
      setPeople([]);
      setProtocolNumber(null);
      setNotes('');
      onDone?.();
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível registrar', description: err instanceof ApiError ? err.message : 'Tente novamente.' });
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
      <Field
        label="Quem recebe o acesso"
        error={errors.people}
        hint={resource.parentId !== null ? 'Pode escolher várias pessoas. Quem ainda não tem o acesso ao hub ganha junto.' : 'Pode escolher várias pessoas.'}
      >
        {(id) => (
          <PeoplePicker
            id={id}
            value={people}
            onChange={(next) => {
              setPeople(next);
              if (next.length) setErrors((e) => ({ ...e, people: undefined }));
            }}
            lockedEmails={lockedEmails}
            invalid={Boolean(errors.people)}
          />
        )}
      </Field>
      <Field label="Protocolo" error={errors.protocol} hint="Obrigatório — o acesso fica vinculado a ele no log.">
        {(id) => <ProtocolPicker id={id} value={protocolNumber} onChange={onProtocol} platformSlug={platformSlug} invalid={Boolean(errors.protocol)} />}
      </Field>
      <Field label="Observação (opcional)">
        {(id) => <Textarea id={id} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={grant.isPending} icon={<ShieldPlus size={16} aria-hidden />}>
          Conceder acesso{people.length ? ` (${pluralize(people.length, 'pessoa', 'pessoas')})` : ''}
        </Button>
      </div>
    </form>
  );
}
