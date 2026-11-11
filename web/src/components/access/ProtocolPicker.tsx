import { FileText, X } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { useProtocols } from '../../hooks/useProtocols';
import type { Protocol } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDate, titleCase } from '../../utils/format';
import { searchProtocols } from '../../utils/protocolSearch';
import { Badge, type BadgeTone } from '../ui/Badge';
import { CONTROL } from '../ui/Field';

const STATE: Record<Protocol['state'], { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Aberto', tone: 'accent' },
  CLOSED: { label: 'Encerrado', tone: 'neutral' },
  CANCELED: { label: 'Cancelado', tone: 'danger' },
};

const category = (p: Protocol) => [p.category2, p.category3].filter(Boolean).join(' › ');

/**
 * Escolha do protocolo do Voalle que justifica a liberação: busca por número,
 * solicitante, e-mail ou pedido (abertos e da plataforma atual primeiro). Se o
 * Voalle estiver fora, dá para usar o número digitado.
 */
export function ProtocolPicker({ id, value, onChange, platformSlug, invalid }: {
  id: string;
  value: string | null;
  onChange: (protocolNumber: string | null, protocol: Protocol | null) => void;
  platformSlug: string | null;
  invalid?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const queue = useProtocols({ state: 'ALL' });
  const protocols = useMemo(() => queue.data?.data ?? [], [queue.data]);
  const voalleDown = Boolean(queue.data?.meta.lastError) && protocols.length === 0;

  const typed = query.trim();
  const manual = /^\d{1,20}$/.test(typed) && !protocols.some((p) => p.protocolNumber === typed) ? typed : null;
  const options = useMemo(() => searchProtocols(protocols, query, platformSlug), [protocols, query, platformSlug]);
  const count = options.length + (manual ? 1 : 0);
  const selected = value ? protocols.find((p) => p.protocolNumber === value) ?? null : null;

  const pick = (index: number) => {
    if (manual && index === options.length) onChange(manual, null);
    else if (options[index]) onChange(options[index]!.protocolNumber, options[index]!);
    else return;
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(count - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open) pick(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  if (value) {
    return (
      <div className={cn(CONTROL, 'flex min-h-8 items-center gap-2 py-1.5')}>
        <FileText size={15} aria-hidden className="shrink-0 text-primary-text" />
        <span className="min-w-0 flex-1 truncate">
          <b className="font-semibold">Protocolo {value}</b>
          {selected ? (
            <> · {titleCase(selected.requesterName) || 'sem solicitante'}{category(selected) ? ` · ${category(selected)}` : ''}</>
          ) : (
            <span className="text-on-surface-variant"> · fora da fila do Voalle</span>
          )}
        </span>
        {selected && <Badge tone={STATE[selected.state].tone}>{STATE[selected.state].label}</Badge>}
        <button
          id={id}
          type="button"
          onClick={() => {
            onChange(null, null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="grid size-6 place-items-center rounded text-on-surface-variant hover:bg-surface-hover hover:text-on-surface"
          aria-label="Trocar o protocolo"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && count ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={voalleDown ? 'Voalle indisponível — digite o número do protocolo' : 'Buscar por número, solicitante ou pedido…'}
        autoComplete="off"
        className={cn(CONTROL, 'h-8')}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-outline bg-surface-container-lowest p-1 shadow-lg"
        >
          {queue.isLoading && <li className="px-3 py-2 text-xs text-on-surface-variant">Carregando a fila do Voalle…</li>}
          {!queue.isLoading && count === 0 && (
            <li className="px-3 py-2 text-xs text-on-surface-variant">
              {voalleDown ? 'Fila do Voalle indisponível agora. Digite o número do protocolo.' : 'Nenhum protocolo encontrado.'}
            </li>
          )}
          {options.map((p, i) => (
            <li
              key={p.protocolNumber}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]', i === active && 'bg-surface-hover')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-on-surface">
                  <b className="font-semibold">{p.protocolNumber}</b> · {titleCase(p.requesterName) || 'sem solicitante'}
                </span>
                <span className="block truncate text-[11.5px] text-on-surface-variant">
                  {[category(p), p.targetEmail, p.requestedItems[0], p.createdAt ? `aberto em ${formatDate(p.createdAt)}` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Badge tone={STATE[p.state].tone}>{STATE[p.state].label}</Badge>
            </li>
          ))}
          {manual && (
            <li
              id={`${listId}-${options.length}`}
              role="option"
              aria-selected={active === options.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(options.length)}
              onMouseEnter={() => setActive(options.length)}
              className={cn('cursor-pointer rounded-md px-2.5 py-1.5 text-[12.5px] text-on-surface', active === options.length && 'bg-surface-hover')}
            >
              Usar o protocolo <b className="font-semibold">{manual}</b> <span className="text-on-surface-variant">(não está na fila do Voalle)</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
