import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Painel lateral (detalhe de protocolo, de pessoa). Fecha com Esc, clique no
 * fundo ou no X; o foco vai para o painel ao abrir e volta para quem abriu.
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-2xl' }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-neutral-950/35 backdrop-blur-[1px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full flex-col border-l border-outline bg-surface shadow-2xl outline-none animate-slide-in-right',
          width,
        )}
      >
        <header className="flex items-start gap-3 border-b border-t-[3px] border-b-outline border-t-primary bg-surface-container-lowest px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold text-primary-text">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-on-surface-variant">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl text-on-surface-variant transition hover:bg-surface-hover hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer && <footer className="border-t border-outline bg-surface-container-lowest px-4 py-3 sm:px-6">{footer}</footer>}
      </div>
    </div>
  );
}
