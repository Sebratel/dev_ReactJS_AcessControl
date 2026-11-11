import { cn } from '../../utils/cn';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const BASE = 'h-7 rounded-md text-[12px] font-semibold transition-colors';
const ACTIVE = 'bg-primary text-on-primary';
const IDLE = 'text-on-surface hover:bg-surface-hover';
const EMPTY = 'cursor-not-allowed text-on-surface-variant/40';

/**
 * Barra de letras A–Z para filtrar pela inicial. Letra sem ninguém fica
 * apagada; clicar de novo na letra escolhida (ou em "Todas") tira o filtro.
 * '#' aparece só quando há algo que não começa com letra.
 */
export function InitialsBar({ value, counts, onChange, label = 'Filtrar pela letra inicial do e-mail' }: {
  /** letra escolhida (minúscula) ou '' para todas */
  value: string;
  /** quantos por letra; sem isso (carregando) as letras ficam apagadas */
  counts?: Record<string, number>;
  onChange: (letter: string) => void;
  label?: string;
}) {
  const letters = counts?.['#'] ? [...LETTERS, '#'] : LETTERS;
  return (
    // ocupa a largura toda do cabeçalho: as letras se esticam por igual e,
    // em tela estreita, quebram em linhas de colunas iguais (mín. 28 px cada)
    <div role="group" aria-label={label} className="flex w-full min-w-0 flex-1 items-start gap-1">
      <button type="button" aria-pressed={!value} onClick={() => onChange('')} className={cn(BASE, 'shrink-0 px-2.5', value ? IDLE : ACTIVE)}>
        Todas
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(1.75rem,1fr))] gap-0.5">
        {letters.map((letter) => {
          const count = counts?.[letter] ?? 0;
          const on = value === letter;
          return (
            <button
              key={letter}
              type="button"
              aria-pressed={on}
              disabled={!count && !on}
              title={count ? `${count} pessoa(s)` : 'Ninguém com esta letra'}
              aria-label={`${letter.toUpperCase()}, ${count ? `${count} pessoa(s)` : 'ninguém'}`}
              onClick={() => onChange(on ? '' : letter)}
              className={cn(BASE, on ? ACTIVE : count ? IDLE : EMPTY)}
            >
              {letter.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
