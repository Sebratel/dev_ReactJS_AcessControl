import { ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { usePerson } from '../../hooks/useAccessQueries';
import type { Grant } from '../../services/types';
import { formatDate, pluralize } from '../../utils/format';
import { PersonAccessTree } from '../access/PersonAccessTree';
import { RevokeDialog } from '../access/RevokeDialog';
import { personPath } from '../layout/pages';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { ErrorState, LoadingState } from '../ui/States';
import { PersonFields, toPersonForm, useSavePerson, type PersonFormValues } from './PersonFields';

/**
 * Painel lateral da pessoa (aberto pela linha da lista): cadastro para editar
 * e a árvore única dos acessos ativos (remover direto dela). O histórico
 * completo fica na página da pessoa.
 */
export function PersonDrawer({ personId, onClose }: { personId: number | null; onClose: () => void }) {
  const { canEdit } = useSession();
  const person = usePerson(personId);
  const { save, isSaving } = useSavePerson();
  const [form, setForm] = useState<PersonFormValues | null>(null);
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const p = person.data?.person;

  // recomeça o formulário a cada pessoa aberta (e quando o cadastro muda)
  useEffect(() => {
    setForm(p ? toPersonForm(p) : null);
  }, [p]);

  const activeCount = useMemo(() => (person.data?.grants ?? []).filter((g) => g.status === 'ACTIVE').length, [person.data]);
  const dirty = Boolean(p && form && JSON.stringify(form) !== JSON.stringify(toPersonForm(p)));

  return (
    <>
      <Drawer
        open={personId !== null}
        onClose={onClose}
        width="max-w-lg"
        title={<span className="break-all">{p?.email ?? 'Pessoa'}</span>}
        subtitle={p && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {!p.isActive && <Badge tone="warning">Inativa</Badge>}
            <Badge tone="brand">{pluralize(activeCount, 'acesso ativo', 'acessos ativos')}</Badge>
            <span className="text-xs text-on-surface-variant">no cadastro desde {formatDate(p.createdAt)}</span>
          </div>
        )}
        footer={p && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link to={personPath(p.id)} className="mr-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-text hover:underline">
              Acessos e histórico<ArrowUpRight size={14} aria-hidden />
            </Link>
            <Button onClick={onClose}>{canEdit ? 'Cancelar' : 'Fechar'}</Button>
            {canEdit && (
              <Button variant="primary" disabled={!dirty} loading={isSaving} onClick={async () => { if (form && await save(p, form)) onClose(); }}>
                Salvar
              </Button>
            )}
          </div>
        )}
      >
        {person.isLoading && <LoadingState />}
        {person.isError && <ErrorState message="Não foi possível abrir a pessoa." />}
        {p && form && (
          <div className="grid grid-cols-1 gap-5">
            <section className="grid grid-cols-1 gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Cadastro</h3>
              <PersonFields value={form} onChange={setForm} disabled={!canEdit} />
              {!canEdit && <p className="text-xs text-on-surface-variant">Seu papel é de leitura — peça a permissão de Edição para alterar o cadastro.</p>}
            </section>
            <section className="grid grid-cols-1 gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Acessos ativos</h3>
              <PersonAccessTree key={p.id} grants={person.data!.grants} canEdit={canEdit} onRevoke={setRevoking} />
            </section>
          </div>
        )}
      </Drawer>
      <RevokeDialog grant={revoking} onClose={() => setRevoking(null)} />
    </>
  );
}
