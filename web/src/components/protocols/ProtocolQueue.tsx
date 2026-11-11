import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePlatforms } from '../../hooks/usePlatforms';
import { useProtocols } from '../../hooks/useProtocols';
import type { ProtocolFilters } from '../../services/protocolsService';
import type { ProtocolState, RequestType } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { Checkbox, Select } from '../ui/Field';
import { StatCard } from '../ui/StatCard';
import { EmptyState, ErrorState, LoadingState, WarningNote } from '../ui/States';
import { Tabs } from '../ui/Tabs';
import { ProtocolDrawer } from './ProtocolDrawer';
import { ProtocolTable } from './ProtocolTable';

const STATE_TABS: { value: ProtocolState | 'ALL'; label: string }[] = [
  { value: 'OPEN', label: 'Abertos' },
  { value: 'CLOSED', label: 'Encerrados' },
  { value: 'CANCELED', label: 'Cancelados' },
  { value: 'ALL', label: 'Todos' },
];

/**
 * A fila de protocolos de Gestão de Acessos: barra de filtros (fixa sob as
 * abas, como na logisticDashboard), indicadores e a tabela. Na tela de uma
 * plataforma vem com `platformSlug` fixo, a barra no corpo e sem indicadores.
 */
export function ProtocolQueue({ platformSlug, showSummary = true }: { platformSlug?: string; showSummary?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<ProtocolState | 'ALL'>('OPEN');
  const [platform, setPlatform] = useState(platformSlug ?? '');
  const [requestType, setRequestType] = useState<RequestType | ''>('');
  const [unregistered, setUnregistered] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const filters = useMemo<ProtocolFilters>(() => ({
    state,
    platform: platformSlug ?? (platform || undefined),
    requestType: requestType || undefined,
    unregistered,
    search: debouncedSearch.trim() || undefined,
  }), [state, platform, platformSlug, requestType, unregistered, debouncedSearch]);

  const { data, isLoading, isError, error } = useProtocols(filters);
  const { data: platforms } = usePlatforms();
  const selected = params.get('protocolo');
  const meta = data?.meta;
  const summary = meta?.summary;
  const filtering = state !== 'OPEN' || (!platformSlug && platform) || requestType || unregistered || search;

  const open = (protocolNumber: string) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('protocolo', protocolNumber);
    return next;
  });
  const close = () => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.delete('protocolo');
    return next;
  }, { replace: true });

  const clear = () => {
    setState('OPEN');
    if (!platformSlug) setPlatform('');
    setRequestType('');
    setUnregistered(false);
    setSearch('');
  };

  return (
    <>
      <div className={cn('filtros', platformSlug && 'secao')}>
        <Tabs items={STATE_TABS} value={state} onChange={setState} label="Situação" />
        <label className={cn('busca', search && 'ativo')}>
          <Search size={14} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Protocolo, nome, e-mail…" aria-label="Buscar protocolo" className="!w-48" />
        </label>
        {!platformSlug && (
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-auto" aria-label="Plataforma">
            <option value="">Todas as plataformas</option>
            {platforms?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </Select>
        )}
        <Select value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType | '')} className="w-auto" aria-label="Tipo de pedido">
          <option value="">Inclusão e exclusão</option>
          <option value="INCLUSION">Só inclusão</option>
          <option value="EXCLUSION">Só exclusão</option>
        </Select>
        <Checkbox label="Só sem registro" checked={unregistered} onChange={(e) => setUnregistered(e.target.checked)} className="items-center text-[12.5px]" />
        {filtering && (
          <button type="button" className="limpar" onClick={clear}><X size={13} /> Limpar filtros</button>
        )}
      </div>

      {showSummary && summary && (
        <div className="kpi-faixa">
          <StatCard label="Abertos" value={summary.open} tone="brand" onClick={() => { setState('OPEN'); setUnregistered(false); }} active={state === 'OPEN' && !unregistered} />
          <StatCard label="Abertos atrasados" value={summary.openLate} tone="danger" hint="passaram do prazo de entrega" />
          <StatCard label="Novos hoje" value={summary.createdToday} tone="accent" />
          <StatCard label="Encerrados no mês" value={summary.closedThisMonth} onClick={() => { setState('CLOSED'); setUnregistered(false); }} active={state === 'CLOSED' && !unregistered} />
          <StatCard label="Sem registro aqui" value={summary.unregistered} hint="não cancelados, sem acesso registrado" onClick={() => { setState('ALL'); setUnregistered(true); }} active={unregistered} />
        </div>
      )}

      {meta?.lastError && <WarningNote>Última leitura do Voalle falhou ({meta.lastError}). Mostrando a última leitura boa.</WarningNote>}
      {isError && <ErrorState message={error instanceof Error ? error.message : 'Não foi possível carregar a fila.'} />}

      <Card>
        <CardHeader
          title="Fila de protocolos · Gestão de Acessos"
          subtitle={data ? `${data.data.length} protocolo(s)${meta?.fetchedAt ? ` · Voalle lido em ${formatDateTime(meta.fetchedAt)}` : ''}` : 'lendo o Voalle…'}
        />
        {isLoading && <LoadingState label="Lendo a fila no Voalle…" />}
        {data && data.data.length === 0 && (
          <EmptyState
            className="m-3"
            title={state === 'OPEN' && !unregistered ? 'Fila zerada' : 'Nenhum protocolo encontrado'}
            description={state === 'OPEN' && !unregistered ? 'Nenhum protocolo de Gestão de Acessos aberto agora. Novos aparecem aqui sozinhos.' : 'Ajuste os filtros ou a busca.'}
          />
        )}
        {data && data.data.length > 0 && <ProtocolTable protocols={data.data} platforms={platforms} onOpen={open} />}
      </Card>

      <ProtocolDrawer protocolNumber={selected} platforms={platforms ?? []} onClose={close} />
    </>
  );
}
