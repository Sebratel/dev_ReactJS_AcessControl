import { RefreshCw } from 'lucide-react';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { useIntegrations, useSyncIntegration } from '../../hooks/useIntegrations';
import { ApiError } from '../../services/httpClient';
import { cn } from '../../utils/cn';
import { clockTime, formatDateTime, pluralize } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/**
 * Conexão direta da plataforma com o hub (HUB BI, HUB APPS): se está ligada,
 * quando sincronizou, se falhou — e o "Sincronizar agora" para quem edita.
 * Plataforma sem integração (UpValue, AppSheet, DataHub) não mostra nada.
 */
export function IntegrationStatusBar({ slug }: { slug: string }) {
  const { canEdit } = useSession();
  const { notify } = useToast();
  const integrations = useIntegrations();
  const sync = useSyncIntegration();
  const status = integrations.data?.find((i) => i.slug === slug);
  if (!status) return null;

  const busy = status.running || sync.isPending;
  const every = status.intervalMs ? `a cada ${Math.round(status.intervalMs / 60_000)} min` : 'só pelo botão';
  const view = !status.configured
    ? {
      dot: 'bg-neutral-400', text: 'Sem conexão direta',
      title: `A conexão com o ${status.label} não está configurada no servidor (veja o README). Até lá, use “Importar export”.`,
    }
    : busy
      ? { dot: 'bg-amber-400 animate-pulse', text: 'Sincronizando…', title: `Lendo o ${status.label}` }
      : status.lastError
        ? {
          dot: 'bg-rose-500', text: 'Falha na sincronização',
          title: `${status.lastError}${status.lastSuccessAt ? ` · última sincronização boa: ${formatDateTime(status.lastSuccessAt)}` : ''}`,
        }
        : status.lastSuccessAt
          ? {
            dot: 'bg-emerald-500', text: `Ao vivo · ${clockTime(status.lastSuccessAt)}`,
            title: `Sincronizado com o ${status.label} em ${formatDateTime(status.lastSuccessAt)} · ${every}`,
          }
          : { dot: 'bg-amber-400 animate-pulse', text: 'Aguardando a 1ª sincronização', title: `Sincroniza ${every}` };

  const run = async () => {
    try {
      const summary = await sync.mutateAsync(slug);
      const created = summary.grants.created + summary.hubAccess.created;
      notify({
        tone: 'success',
        title: `${status.label} sincronizado`,
        description: [
          pluralize(created, 'acesso novo', 'acessos novos'),
          pluralize(summary.notInExport.revoked, 'removido', 'removidos'),
          summary.notInExport.registeredHere ? `${summary.notInExport.registeredHere} registrado(s) só aqui` : null,
        ].filter(Boolean).join(' · '),
      });
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível sincronizar', description: err instanceof ApiError ? err.message : 'Tente novamente.' });
    }
  };

  const onlyHere = status.lastResult?.registeredHere ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-outline bg-surface-container-lowest px-2.5 text-[12px] text-on-surface"
        title={view.title}
        role="status"
      >
        <span className={cn('size-2 shrink-0 rounded-full', view.dot)} aria-hidden />
        <span>{view.text}</span>
        {onlyHere > 0 && !busy && (
          <Badge tone="warning" title={`Registrados aqui (protocolo ou manual) que não constam no ${status.label} — libere lá ou remova aqui`}>
            {onlyHere} só aqui
          </Badge>
        )}
      </span>
      {canEdit && status.configured && (
        <Button size="sm" icon={<RefreshCw size={14} aria-hidden />} loading={busy} onClick={run}>
          Sincronizar agora
        </Button>
      )}
    </div>
  );
}
