import { Mail, Sparkle } from 'lucide-react';
import type { Platform, Protocol } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDate, titleCase } from '../../utils/format';
import { platformIcon } from '../../utils/labels';
import { LateBadge, RegistrationBadge, RequestTypeBadge, StateBadge } from './ProtocolBadges';

const DAY_MS = 86_400_000;
const isRecent = (p: Protocol): boolean => p.state === 'OPEN' && Boolean(p.createdAt) && Date.now() - Date.parse(p.createdAt!) < DAY_MS;

/**
 * Lista da fila. Tabela no desktop (rola na horizontal em vez de espremer) e
 * cartões no celular. O solicitante e o e-mail de quem recebe o acesso vêm
 * primeiro — é o que mais se procura.
 */
export function ProtocolTable({ protocols, platforms, onOpen }: {
  protocols: Protocol[];
  platforms: Platform[] | undefined;
  onOpen: (protocolNumber: string) => void;
}) {
  const platformName = (slug: string | null) => platforms?.find((p) => p.slug === slug)?.name ?? '—';

  return (
    <>
      <div className="tbl-wrap hidden md:block">
        <table className="pbi min-w-[980px]">
          <thead>
            <tr>
              <th className="left">PROTOCOLO</th>
              <th className="left">SOLICITANTE</th>
              <th className="left">PEDIDO</th>
              <th className="left">PLATAFORMA</th>
              <th className="left">ABERTO EM</th>
              <th className="left">PRAZO</th>
              <th className="left">SITUAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {protocols.map((p) => {
              const Icon = platformIcon(p.platformSlug);
              return (
                <tr
                  key={p.protocolNumber}
                  onClick={() => onOpen(p.protocolNumber)}
                  className={cn('clicavel align-top', isRecent(p) && 'sel')}
                >
                  <td className="left">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpen(p.protocolNumber); }}
                      className="font-mono text-[13px] font-bold text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      {p.protocolNumber}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <RequestTypeBadge protocol={p} />
                      {isRecent(p) && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold uppercase text-accent-strong"><Sparkle size={11} aria-hidden />Novo</span>}
                    </div>
                  </td>
                  <td className="left max-w-[240px] whitespace-normal">
                    <p className="truncate font-semibold text-on-surface">{titleCase(p.requesterName) || '—'}</p>
                    {p.targetEmail && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-on-surface-variant" title="E-mail de quem recebe o acesso">
                        <Mail size={11} aria-hidden className="shrink-0" />{p.targetEmail}
                      </p>
                    )}
                  </td>
                  <td className="left max-w-[320px] whitespace-normal">
                    <p className="line-clamp-2">{p.requestedItems.join(' · ') || <span className="text-on-surface-variant">Ver descrição</span>}</p>
                  </td>
                  <td className="left">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-on-surface"><Icon size={14} aria-hidden className="text-primary-text" />{platformName(p.platformSlug)}</span>
                  </td>
                  <td className="left tabular-nums">
                    {formatDate(p.createdAt)}
                    <span className="block text-[11px]">{p.totalDays ?? 0}d</span>
                  </td>
                  <td className="left tabular-nums">
                    {formatDate(p.deliveryDeadline)}
                    <div className="mt-1"><LateBadge protocol={p} /></div>
                  </td>
                  <td className="left">
                    <div className="flex flex-col items-start gap-1">
                      <StateBadge protocol={p} />
                      <RegistrationBadge protocol={p} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="grid grid-cols-1 gap-2 p-2 md:hidden">
        {protocols.map((p) => (
          <li key={p.protocolNumber}>
            <button
              type="button"
              onClick={() => onOpen(p.protocolNumber)}
              className={cn('w-full rounded-lg border border-outline bg-surface-container-lowest p-3 text-left transition active:scale-[0.99]', isRecent(p) && 'border-accent/60')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-primary-text">{p.protocolNumber}</span>
                <span className="text-xs tabular-nums text-on-surface-variant">{formatDate(p.createdAt)}</span>
              </div>
              <p className="mt-1 truncate font-semibold text-on-surface">{titleCase(p.requesterName)}</p>
              {p.targetEmail && <p className="truncate text-xs text-on-surface-variant">{p.targetEmail}</p>}
              <p className="mt-1.5 line-clamp-2 text-[13px] text-on-surface">{p.requestedItems.join(' · ') || 'Ver descrição'}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <StateBadge protocol={p} />
                <RequestTypeBadge protocol={p} />
                <LateBadge protocol={p} />
                <RegistrationBadge protocol={p} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
