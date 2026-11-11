import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { Protocol } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDateTime, titleCase } from '../../utils/format';
import { WarningNote } from '../ui/States';

function Item({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] text-on-surface">{children || '—'}</dd>
    </div>
  );
}

/** Dados do protocolo como vieram do Voalle (somente leitura). */
export function ProtocolInfo({ protocol }: { protocol: Protocol }) {
  const [showDescription, setShowDescription] = useState(false);
  const suspiciousEmail = protocol.informedEmail && !protocol.isInformedEmailValid;

  return (
    <div className="grid grid-cols-1 gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-outline bg-surface-container-lowest p-4 sm:grid-cols-3">
        <Item label="Solicitante" className="col-span-2 sm:col-span-1">{titleCase(protocol.requesterName)}</Item>
        <Item label="E-mail do cadastro">{protocol.requesterEmail}</Item>
        <Item label="E-mail informado">{protocol.informedEmail ?? 'não informado'}</Item>
        <Item label="Aberto em">{formatDateTime(protocol.createdAt)}</Item>
        <Item label="Prazo de entrega">{formatDateTime(protocol.deliveryDeadline)}</Item>
        <Item label={protocol.state === 'CANCELED' ? 'Cancelado em' : 'Encerrado em'}>{protocol.closedAt ? formatDateTime(protocol.closedAt) : 'em aberto'}</Item>
        <Item label="Responsável">{titleCase(protocol.responsibleName)}</Item>
        <Item label="Equipe">{protocol.team}</Item>
        <Item label="Dias corridos">{protocol.totalDays === null ? '—' : `${protocol.totalDays} dia(s)`}{protocol.isLate ? ` · ${protocol.daysLate ?? 0}d de atraso` : ''}</Item>
        <Item label="Categoria">{[protocol.category2, protocol.category3].filter(Boolean).join(' › ')}</Item>
        {protocol.solution && <Item label="Solução">{protocol.solution}</Item>}
        {protocol.linkedProtocols.length > 0 && <Item label="Protocolos vinculados">{protocol.linkedProtocols.join(', ')}</Item>}
      </dl>

      {suspiciousEmail && (
        <WarningNote>
          O e-mail informado no protocolo (<strong>{protocol.informedEmail}</strong>) não parece válido —
          sugerimos <strong>{protocol.targetEmail}</strong>, do cadastro do solicitante. Confira antes de liberar.
        </WarningNote>
      )}

      <div className="rounded-lg border border-outline bg-surface-container-lowest p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">O que foi pedido</p>
        {protocol.requestedItems.length ? (
          <ul className="mt-1.5 grid gap-1">
            {protocol.requestedItems.map((item) => (
              <li key={item} className="rounded-lg bg-accent-soft/60 px-2.5 py-1.5 text-[13.5px] font-medium text-on-surface">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-on-surface-variant">O protocolo não segue o modelo — veja a descrição.</p>
        )}
        {protocol.descriptionText && (
          <>
            <button
              type="button"
              onClick={() => setShowDescription((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-text hover:underline"
              aria-expanded={showDescription}
            >
              <ChevronDown size={14} className={cn('transition', showDescription && 'rotate-180')} aria-hidden />
              {showDescription ? 'Esconder descrição' : 'Ver descrição completa'}
            </button>
            {showDescription && (
              <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-container-low p-3 text-[13px] leading-relaxed text-on-surface">
                {protocol.descriptionText}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
