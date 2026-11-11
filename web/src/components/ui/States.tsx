import { Inbox, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** O `.loading` da logisticDashboard: anel girando + texto. */
export function LoadingState({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('loading', className)}>
      <div className="spinner" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action, icon, className }: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('empty rounded-lg border border-dashed border-outline px-6 py-8', className)}>
      <span className="text-on-surface-variant">{icon ?? <Inbox size={22} aria-hidden />}</span>
      <p className="text-[14px] font-bold text-on-surface">{title}</p>
      {description && <div className="max-w-md text-[12.5px] text-on-surface-variant">{description}</div>}
      {action}
    </div>
  );
}

/** Faixa de erro (`.banner.error`). */
export function ErrorState({ message, action, className }: { message: string; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('banner error', className)}>
      <TriangleAlert size={14} aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {action}
    </div>
  );
}

/** Faixa de aviso dourada (`.banner`): dado desatualizado, e-mail suspeito. */
export function WarningNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('banner', className)}>
      <TriangleAlert size={14} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
