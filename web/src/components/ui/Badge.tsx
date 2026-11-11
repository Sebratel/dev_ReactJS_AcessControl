import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<BadgeTone, string> = {
  brand: 'border-primary-text/25 bg-primary-soft text-primary-text',
  accent: 'border-accent/40 bg-accent-soft text-amber-900 dark:text-amber-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200',
  danger: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200',
  info: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200',
  neutral: 'border-outline bg-surface-container-low text-on-surface-variant',
};

export function Badge({ tone = 'neutral', icon, children, className, title }: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Contador redondo (menu lateral, abas). */
export function CountPill({ value, tone = 'brand', className }: { value: number; tone?: 'brand' | 'neutral'; className?: string }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-5',
        tone === 'brand' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant ring-1 ring-outline',
        className,
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}
