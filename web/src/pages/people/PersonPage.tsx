import { ArrowLeft, Pencil, UserRound, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PersonAccessTree } from '../../components/access/PersonAccessTree';
import { RevokeDialog } from '../../components/access/RevokeDialog';
import { EventLog } from '../../components/events/EventLog';
import { PersonEditDialog } from '../../components/people/PersonEditDialog';
import { RevokeAllDialog } from '../../components/people/RevokeAllDialog';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useSession } from '../../context/SessionContext';
import { usePerson } from '../../hooks/useAccessQueries';
import { usePlatforms } from '../../hooks/usePlatforms';
import type { Grant } from '../../services/types';
import { formatDate, pluralize, titleCase } from '../../utils/format';

/** Tudo de uma pessoa: cadastro, árvore única dos acessos, histórico e "remover tudo". */
export default function PersonPage() {
  const { id } = useParams();
  const personId = Number(id);
  const { canEdit } = useSession();
  const person = usePerson(Number.isInteger(personId) && personId > 0 ? personId : null);
  const { data: platforms } = usePlatforms();
  const [editing, setEditing] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [revoking, setRevoking] = useState<Grant | null>(null);

  if (person.isLoading) return <main className="page sem-filtros"><LoadingState /></main>;
  if (person.isError || !person.data) return <main className="page sem-filtros"><ErrorState message="Pessoa não encontrada." /></main>;
  const { person: p, grants } = person.data;
  const activeCount = grants.filter((g) => g.status === 'ACTIVE').length;

  return (
    <main className="page sem-filtros">
      <Link to="/pessoas" className="inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-primary-text hover:underline">
        <ArrowLeft size={14} aria-hidden />Todas as pessoas
      </Link>
      <Card>
        <CardHeader title={<span className="normal-case">{p.email}</span>} subtitle={[titleCase(p.name), p.department].filter(Boolean).join(' · ') || undefined} />
        <div className="flex flex-wrap items-center gap-3 p-3">
          <span className="grid size-10 place-items-center rounded-full bg-primary text-on-primary"><UserRound size={18} aria-hidden /></span>
          <div className="min-w-0 flex-1 text-[12.5px] text-on-surface-variant">
            <p className="flex flex-wrap items-center gap-2">
              {!p.isActive && <Badge tone="warning">Inativa</Badge>}
              <Badge tone="brand">{pluralize(activeCount, 'acesso ativo', 'acessos ativos')}</Badge>
              <span>no cadastro desde {formatDate(p.createdAt)}</span>
            </p>
            {p.notes && <p className="mt-1">{p.notes}</p>}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button icon={<Pencil size={14} aria-hidden />} onClick={() => setEditing(true)}>Editar</Button>
              <Button variant="danger" icon={<UserX size={14} aria-hidden />} onClick={() => setRevokingAll(true)} disabled={!activeCount}>
                Remover todos
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Acessos ativos" subtitle="Tudo o que a pessoa tem, por plataforma — abra para ver hub, dashboards e abas" />
        <div className="p-3">
          <PersonAccessTree key={p.id} grants={grants} canEdit={canEdit} onRevoke={setRevoking} />
        </div>
      </Card>

      <h3 className="secao-titulo">Histórico desta pessoa</h3>
      <EventLog personId={p.id} />

      <PersonEditDialog person={p} open={editing} onClose={() => setEditing(false)} />
      <RevokeAllDialog person={p} grants={grants} platforms={platforms ?? []} open={revokingAll} onClose={() => setRevokingAll(false)} />
      <RevokeDialog grant={revoking} onClose={() => setRevoking(null)} />
    </main>
  );
}
