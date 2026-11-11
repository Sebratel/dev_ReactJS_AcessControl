import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** Janela modal centralizada (formulários curtos e confirmações). */
export function Dialog({ open, onClose, title, description, children, footer, width = 'max-w-lg' }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button[data-autofocus]');
    (first ?? ref.current)?.focus();
    // fase de captura + stopPropagation: com um painel lateral aberto embaixo,
    // o Esc fecha só o diálogo de cima
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn('relative w-full rounded-xl border border-outline bg-surface-container-lowest shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] outline-none animate-fade-in-up', width)}
      >
        {/* o `.dialogo` da logisticDashboard: faixa vinho em cima, título vinho */}
        <header className="flex items-start gap-3 rounded-t-xl border-b border-t-[3px] border-b-outline border-t-primary px-4 pb-3 pt-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-primary-text">{title}</h2>
            {description && <div className="mt-1 text-[12.5px] leading-relaxed text-on-surface-variant">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-hover" aria-label="Fechar">
            <X size={16} />
          </button>
        </header>
        {children && <div className="px-4 py-3.5">{children}</div>}
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-outline px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
