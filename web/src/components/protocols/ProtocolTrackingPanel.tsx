import { CheckCircle2, Circle, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { useUpdateProtocolTracking } from '../../hooks/useProtocols';
import { ApiError } from '../../services/httpClient';
import type { Platform, Protocol } from '../../services/types';
import { formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, Textarea } from '../ui/Field';

/** O que é nosso sobre o protocolo: plataforma corrigida, anotação e "tratado". */
export function ProtocolTrackingPanel({ protocol, platforms }: { protocol: Protocol; platforms: Platform[] }) {
  const { canEdit } = useSession();
  const { notify } = useToast();
  const update = useUpdateProtocolTracking(protocol.protocolNumber);
  const [note, setNote] = useState(protocol.note);

  useEffect(() => setNote(protocol.note), [protocol.note, protocol.protocolNumber]);

  const save = async (changes: { platformSlug?: string | null; note?: string; isHandled?: boolean }, message: string) => {
    try {
      await update.mutateAsync(changes);
      notify({ tone: 'success', title: message });
    } catch (err) {
      notify({ tone: 'error', title: 'Não foi possível salvar', description: err instanceof ApiError ? err.message : undefined });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline bg-surface-container-lowest p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Plataforma"
          hint={protocol.suggestedPlatformSlug && protocol.platformSlug !== protocol.suggestedPlatformSlug
            ? 'Corrigida pelo time (a categoria do Voalle apontava outra).'
            : `Pela categoria do Voalle: ${protocol.category2 ?? '—'}`}
        >
          {(id) => (
            <Select
              id={id}
              value={protocol.platformSlug ?? ''}
              disabled={!canEdit || update.isPending}
              onChange={(e) => void save({ platformSlug: e.target.value || null }, 'Plataforma do protocolo atualizada')}
            >
              <option value="">Sem plataforma</option>
              {platforms.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <Button
          variant={protocol.isHandled ? 'secondary' : 'accent'}
          disabled={!canEdit}
          loading={update.isPending}
          icon={protocol.isHandled ? <CheckCircle2 size={16} className="text-emerald-600" aria-hidden /> : <Circle size={16} aria-hidden />}
          onClick={() => void save({ isHandled: !protocol.isHandled }, protocol.isHandled ? 'Protocolo reaberto aqui' : 'Protocolo marcado como tratado')}
          title="Use quando o protocolo não gera acesso para registrar (dúvida, pedido duplicado, fora do escopo)"
        >
          {protocol.isHandled ? 'Tratado' : 'Marcar como tratado'}
        </Button>
      </div>
      {protocol.isHandled && protocol.handledBy && (
        <p className="text-xs text-on-surface-variant">Tratado por {protocol.handledBy} em {formatDateTime(protocol.handledAt)}.</p>
      )}
      <Field label="Anotação do time">
        {(id) => (
          <Textarea id={id} rows={2} value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: aguardando o gestor aprovar; liberado também no Voalle…" />
        )}
      </Field>
      {canEdit && note !== protocol.note && (
        <div className="flex justify-end">
          <Button size="sm" variant="primary" icon={<Save size={14} aria-hidden />} loading={update.isPending} onClick={() => void save({ note }, 'Anotação salva')}>
            Salvar anotação
          </Button>
        </div>
      )}
    </div>
  );
}
