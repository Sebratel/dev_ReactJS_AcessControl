import { MinusCircle, PencilLine, PlusCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAccessEvents } from '../../hooks/useAccessQueries';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePlatforms } from '../../hooks/usePlatforms';
import type { AccessEvent, AccessEventType } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDateTime, titleCase } from '../../utils/format';
import { EVENT_LABEL } from '../../utils/labels';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { Pagination } from '../ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../ui/States';
import { Tabs } from '../ui/Tabs';

type Kind = 'ACCESS' | 'ADDED' | 'REVOKED' | 'CATALOG' | 'ALL';

const KIND_TYPES: Record<Kind, AccessEventType[] | undefined> = {
  ACCESS: ['GRANT_ADDED', 'GRANT_REVOKED', 'GRANT_UPDATED'],
  ADDED: ['GRANT_ADDED'],
  REVOKED: ['GRANT_REVOKED'],
  CATALOG: ['RESOURCE_CREATED', 'RESOURCE_UPDATED', 'RESOURCE_REMOVED', 'PERSON_CREATED', 'PERSON_UPDATED', 'PROTOCOL_UPDATED', 'USER_ROLE_CHANGED', 'IMPORT_APPLIED'],
  ALL: undefined,
};

const KIND_TABS: { value: Kind; label: string }[] = [
  { value: 'ACCESS', label: 'Adições e remoções' },
  { value: 'ADDED', label: 'Só adições' },
  { value: 'REVOKED', label: 'Só remoções' },
  { value: 'CATALOG', label: 'Cadastro' },
  { value: 'ALL', label: 'Tudo' },
];

const TONE: Partial<Record<AccessEventType, BadgeTone>> = {
  GRANT_ADDED: 'success', GRANT_REVOKED: 'danger', GRANT_UPDATED: 'info', RESOURCE_REMOVED: 'warning', IMPORT_APPLIED: 'accent',
};

function EventIcon({ type }: { type: AccessEventType }) {
  if (type === 'GRANT_ADDED') return <PlusCircle size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden />;
  if (type === 'GRANT_REVOKED') return <MinusCircle size={16} className="text-rose-600 dark:text-rose-400" aria-hidden />;
  return <PencilLine size={16} className="text-on-surface-variant" aria-hidden />;
}

function detailText(event: AccessEvent): string {
  const d = event.detail;
  const parts: string[] = [];
  if (d.source === 'IMPORT') parts.push('importado do HUB');
  if (event.eventType === 'IMPORT_APPLIED') {
    parts.push(`${Number(d.rows ?? 0)} linhas · ${Number(d.grantsCreated ?? 0)} acessos novos · ${Number(d.dashboardsCreated ?? 0)} dashboards novos · ${Number(d.revoked ?? 0)} removidos`);
  }
  if (typeof d.accessLevel === 'string') parts.push(`nível: ${d.accessLevel}`);
  if (d.accessLevel && typeof d.accessLevel === 'object') {
    const change = d.accessLevel as { from?: unknown; to?: unknown };
    parts.push(`nível: ${String(change.from ?? '—')} → ${String(change.to ?? '—')}`);
  }
  if (typeof d.notes === 'string' && d.notes) parts.push(`“${d.notes}”`);
  if (d.changes && typeof d.changes === 'object') parts.push(`alterou: ${Object.keys(d.changes as object).join(', ')}`);
  if (typeof d.action === 'string') parts.push(`${d.action.toLowerCase()}${typeof d.role === 'string' ? ` (${d.role})` : ''}`);
  if (typeof d.from === 'string' && typeof d.to === 'string') parts.push(`permissão: ${d.from} → ${d.to}`);
  if (typeof d.isHandled === 'boolean') parts.push(d.isHandled ? 'marcado como tratado' : 'reaberto');
  if (typeof d.note === 'string') parts.push('anotação');
  if (d.platformSlug !== undefined) parts.push(`plataforma: ${String(d.platformSlug ?? '—')}`);
  return parts.join(' · ');
}

/** Log de adições e remoções (e mudanças de cadastro), com filtros. */
export function EventLog({ platformSlug, personId, defaultKind = 'ACCESS', inSection = false }: {
  platformSlug?: string;
  personId?: number;
  defaultKind?: Kind;
  /** dentro de outra tela: a barra de filtros não gruda no topo */
  inSection?: boolean;
}) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [platform, setPlatform] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const { data: platforms } = usePlatforms();

  const filters = useMemo(() => ({
    platform: platformSlug ?? (platform || undefined),
    personId,
    eventType: KIND_TYPES[kind],
    search: debounced.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: 50,
  }), [platformSlug, platform, personId, kind, debounced, startDate, endDate, page]);

  const events = useAccessEvents(filters);
  const changeFilter = <T,>(setter: (v: T) => void) => (value: T) => { setter(value); setPage(1); };

  const sticky = !inSection && personId === undefined;

  return (
    <>
      <div className={cn('filtros', !sticky && 'secao')}>
        <Tabs items={KIND_TABS} value={kind} onChange={changeFilter(setKind)} label="Mostrar" />
        {personId === undefined && (
          <label className={cn('busca', search && 'ativo')}>
            <Search size={14} aria-hidden />
            <input value={search} onChange={(e) => changeFilter(setSearch)(e.target.value)} placeholder="E-mail, recurso, protocolo…" aria-label="Buscar no log" className="!w-48" />
          </label>
        )}
        {!platformSlug && (
          <Select value={platform} onChange={(e) => changeFilter(setPlatform)(e.target.value)} className="w-auto" aria-label="Plataforma">
            <option value="">Todas as plataformas</option>
            {platforms?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </Select>
        )}
        <span className="rotulo">De</span>
        <Input type="date" value={startDate} onChange={(e) => changeFilter(setStartDate)(e.target.value)} className="w-auto" aria-label="De" />
        <span className="rotulo">até</span>
        <Input type="date" value={endDate} onChange={(e) => changeFilter(setEndDate)(e.target.value)} className="w-auto" aria-label="Até" />
      </div>

      <Card>
        <CardHeader title="Log de alterações" subtitle={events.data ? `${events.data.meta.totalItems} registro(s) · não editável` : undefined} />
        {events.isLoading && <LoadingState />}
        {events.isError && <div className="p-3"><ErrorState message="Não foi possível carregar o log." /></div>}
        {events.data && events.data.data.length === 0 && <EmptyState className="m-3" title="Nada no log com esses filtros" />}
      {events.data && events.data.data.length > 0 && (
        <ol className="divide-y divide-outline">
          {events.data.data.map((e) => (
            <li key={e.id} className={cn('flex gap-3 px-4 py-3', events.isFetching && 'opacity-70')}>
              <span className="mt-0.5"><EventIcon type={e.eventType} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <Badge tone={TONE[e.eventType] ?? 'neutral'}>{EVENT_LABEL[e.eventType]}</Badge>
                  {e.personEmail && <span className="font-semibold text-on-surface">{e.personEmail}</span>}
                  {e.personEmail && e.personName && <span className="text-on-surface-variant">{titleCase(e.personName)}</span>}
                </div>
                {e.resourcePath && <p className="mt-1 text-[13px] text-on-surface">{e.resourcePath}</p>}
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-on-surface-variant">
                  <span className="tabular-nums">{formatDateTime(e.createdAt)}</span>
                  <span>por {e.actorEmail}</span>
                  {e.protocolNumber && <span className="font-mono">protocolo {e.protocolNumber}</span>}
                  {detailText(e) && <span>{detailText(e)}</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
        {events.data && events.data.meta.totalPages > 1 && (
          <div className="border-t border-outline px-3 py-2"><Pagination meta={events.data.meta} onPage={setPage} /></div>
        )}
      </Card>
    </>
  );
}
