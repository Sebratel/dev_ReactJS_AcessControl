import { UserPlus, X } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { usePeopleEmails } from '../../hooks/useAccessQueries';
import { useDismiss } from '../../hooks/useDismiss';
import { cn } from '../../utils/cn';
import { emailOptions, type EmailOption } from '../../utils/emailOptions';
import { Badge } from '../ui/Badge';
import { CONTROL } from '../ui/Field';

/**
 * Escolha de pessoas pelo e-mail, várias de uma vez: todos os e-mails do
 * cadastro, sem repetidos e em ordem alfabética; o que se digita filtra na hora.
 * Quem já tem o acesso aparece travado. Um e-mail completo que não está no
 * cadastro vira "Cadastrar …".
 */
export function PeoplePicker({ id, value, onChange, lockedEmails, invalid }: {
  id: string;
  /** e-mails escolhidos (minúsculos) */
  value: string[];
  onChange: (next: string[]) => void;
  lockedEmails?: Set<string>;
  invalid?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const emails = usePeopleEmails();

  const options = useMemo(() => emailOptions(emails.data ?? [], value, query), [emails.data, value, query]);
  const isLocked = (o: EmailOption) => lockedEmails?.has(o.email) ?? false;

  const select = (option: EmailOption | undefined) => {
    if (!option || isLocked(option)) return;
    onChange([...value, option.email]);
    setQuery('');
    setActive(0);
    // fecha para não cobrir os campos de baixo; clicar ou digitar abre de novo
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // não envia o formulário ao escolher
      if (open) select(options[active]);
    } else if (e.key === 'Backspace' && query === '' && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(CONTROL, 'flex min-h-8 cursor-text flex-wrap items-center gap-1 py-1', open && 'border-primary-text ring-[3px] ring-primary-soft')}
        aria-invalid={invalid || undefined}
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {value.map((email) => (
          <span key={email} className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary-soft py-0.5 pl-2 pr-0.5 text-[12px] text-on-surface">
            <span className="truncate">{email}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v !== email));
              }}
              className="grid size-5 place-items-center rounded text-on-surface-variant hover:bg-surface-hover hover:text-on-surface"
              aria-label={`Tirar ${email}`}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? 'Adicionar mais um e-mail…' : 'Buscar e-mail…'}
          autoComplete="off"
          className="h-6 min-w-[10rem] flex-1 bg-transparent text-[12.5px] text-on-surface outline-none placeholder:text-on-surface-variant/70"
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-outline bg-surface-container-lowest p-1 shadow-lg"
        >
          {emails.isLoading ? (
            <li className="px-3 py-2 text-xs text-on-surface-variant">Carregando…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-on-surface-variant">Nenhum e-mail encontrado. Digite o e-mail completo para cadastrar alguém novo.</li>
          ) : (
            options.map((o, i) => {
              const locked = isLocked(o);
              return (
                <li
                  key={o.email}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={locked || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-on-surface',
                    locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    i === active && !locked && 'bg-surface-hover',
                  )}
                >
                  {o.isNew && <UserPlus size={14} aria-hidden className="shrink-0 text-primary-text" />}
                  <span className="min-w-0 flex-1 truncate">{o.isNew ? `Cadastrar ${o.email}` : o.email}</span>
                  {locked && <Badge tone="success">Já tem</Badge>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
