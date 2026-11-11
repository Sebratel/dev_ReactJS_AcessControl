import { CheckCheck, Clock3, MinusCircle, PlusCircle } from 'lucide-react';
import type { Protocol } from '../../services/types';
import { REQUEST_TYPE_LABEL } from '../../utils/labels';
import { Badge } from '../ui/Badge';

export function StateBadge({ protocol }: { protocol: Pick<Protocol, 'state' | 'statusLabel'> }) {
  const tone = protocol.state === 'OPEN' ? 'info' : protocol.state === 'CLOSED' ? 'success' : 'neutral';
  return <Badge tone={tone}>{protocol.statusLabel}</Badge>;
}

export function RequestTypeBadge({ protocol }: { protocol: Pick<Protocol, 'requestType'> }) {
  if (protocol.requestType === 'EXCLUSION') {
    return <Badge tone="danger" icon={<MinusCircle size={11} aria-hidden />}>{REQUEST_TYPE_LABEL.EXCLUSION}</Badge>;
  }
  if (protocol.requestType === 'INCLUSION') {
    return <Badge tone="brand" icon={<PlusCircle size={11} aria-hidden />}>{REQUEST_TYPE_LABEL.INCLUSION}</Badge>;
  }
  return <Badge>{REQUEST_TYPE_LABEL.OTHER}</Badge>;
}

export function LateBadge({ protocol }: { protocol: Pick<Protocol, 'isLate' | 'daysLate' | 'state'> }) {
  if (!protocol.isLate) return null;
  const days = protocol.daysLate ?? 0;
  return (
    <Badge tone={protocol.state === 'OPEN' ? 'danger' : 'warning'} icon={<Clock3 size={11} aria-hidden />}>
      {days > 0 ? `${days}d atraso` : 'Atrasado'}
    </Badge>
  );
}

/** Se o protocolo já tem registro de acesso aqui (o que fecha o ciclo de controle). */
export function RegistrationBadge({ protocol }: { protocol: Pick<Protocol, 'isRegistered' | 'grantsAdded' | 'grantsRevoked' | 'isHandled' | 'state'> }) {
  if (protocol.state === 'CANCELED') return null;
  if (protocol.isRegistered) {
    const parts = [
      protocol.grantsAdded ? `+${protocol.grantsAdded}` : '',
      protocol.grantsRevoked ? `−${protocol.grantsRevoked}` : '',
    ].filter(Boolean).join(' ');
    return (
      <Badge tone="success" icon={<CheckCheck size={11} aria-hidden />} title="Acessos registrados nesta aplicação">
        {parts || (protocol.isHandled ? 'Tratado' : 'Registrado')}
      </Badge>
    );
  }
  return <Badge tone="warning" title="Nenhum acesso registrado aqui para este protocolo">Sem registro</Badge>;
}
