import { ExternalLink, FileUp, History, Inbox, Network, Users } from 'lucide-react';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { EventLog } from '../../components/events/EventLog';
import { ImportDialog } from '../../components/platforms/ImportDialog';
import { IMPORTERS } from '../../components/platforms/importers';
import { IntegrationStatusBar } from '../../components/platforms/IntegrationStatusBar';
import { PlatformAccessTab } from '../../components/platforms/PlatformAccessTab';
import { PlatformPeopleTab } from '../../components/platforms/PlatformPeopleTab';
import { ProtocolQueue } from '../../components/protocols/ProtocolQueue';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Tabs } from '../../components/ui/Tabs';
import { useSession } from '../../context/SessionContext';
import { usePlatforms } from '../../hooks/usePlatforms';

type Tab = 'arvore' | 'pessoas' | 'protocolos' | 'log';

/**
 * Uma plataforma (HUB BI, DataHub, HUB APPS, AppSheet, UpValue): os números,
 * a árvore de acessos, quem tem acesso a quê, os protocolos e o log dela.
 * O nome da plataforma é o título do topo (como na logisticDashboard).
 */
export default function PlatformPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: platforms, isLoading } = usePlatforms();
  const { canEdit } = useSession();
  const [importing, setImporting] = useState(false);
  const platform = platforms?.find((p) => p.slug === slug);
  const tab = (params.get('aba') as Tab | null) ?? 'arvore';

  const setTab = (value: Tab) => setParams((prev) => {
    const next = new URLSearchParams();
    next.set('aba', value);
    if (value === 'arvore' && prev.get('item')) next.set('item', prev.get('item')!);
    return next;
  });

  if (isLoading) return <main className="page sem-filtros"><LoadingState /></main>;
  if (!platform) {
    return <main className="page sem-filtros"><EmptyState title="Plataforma não encontrada" description="Escolha uma plataforma nas abas." /></main>;
  }

  const { stats } = platform;
  const importer = IMPORTERS[platform.slug];

  return (
    <main className="page sem-filtros">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="page-intro">{platform.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBar slug={platform.slug} />
          {canEdit && importer && (
            <Button icon={<FileUp size={14} aria-hidden />} onClick={() => setImporting(true)}>Importar export</Button>
          )}
          {platform.url && (
            <a href={platform.url} target="_blank" rel="noopener noreferrer" className="btn">
              <ExternalLink size={14} aria-hidden />Abrir {platform.name}
            </a>
          )}
        </div>
      </div>

      <div className="kpi-faixa">
        <StatCard label="Itens na árvore" value={stats.resources} onClick={() => setTab('arvore')} active={tab === 'arvore'} />
        <StatCard label="Pessoas com acesso" value={stats.peopleWithAccess} hint={`${stats.peopleWithRootAccess} com acesso à ferramenta`} onClick={() => setTab('pessoas')} active={tab === 'pessoas'} />
        <StatCard label="Acessos ativos" value={stats.activeGrants} />
        <StatCard label="Protocolos abertos" value={platform.openProtocols} tone="accent" onClick={() => setTab('protocolos')} active={tab === 'protocolos'} />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        label="Ver"
        items={[
          { value: 'arvore', label: 'Árvore de acessos', icon: <Network size={13} aria-hidden /> },
          { value: 'pessoas', label: 'Quem tem acesso', icon: <Users size={13} aria-hidden />, count: stats.peopleWithAccess },
          { value: 'protocolos', label: 'Protocolos', icon: <Inbox size={13} aria-hidden />, count: platform.openProtocols || undefined },
          { value: 'log', label: 'Log', icon: <History size={13} aria-hidden /> },
        ]}
      />

      {tab === 'arvore' && <PlatformAccessTab key={platform.slug} platform={platform} />}
      {tab === 'pessoas' && <PlatformPeopleTab key={platform.slug} platform={platform} />}
      {tab === 'protocolos' && <ProtocolQueue key={platform.slug} platformSlug={platform.slug} showSummary={false} />}
      {tab === 'log' && <EventLog key={platform.slug} platformSlug={platform.slug} inSection />}
      {importer && <ImportDialog importer={importer} open={importing} onClose={() => setImporting(false)} />}
    </main>
  );
}
