import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md';

/** Mesmo desenho do `.btn` da logisticDashboard (32 px, cantos de 8 px, vinho no primário). */
const VARIANT: Record<Variant, string> = {
  primary: 'border-primary bg-primary text-on-primary hover:border-primary-strong hover:bg-primary-strong',
  accent: 'border-accent bg-accent text-neutral-900 hover:bg-accent-strong',
  secondary: 'border-outline bg-surface-container-lowest text-on-surface hover:border-primary-text hover:text-primary-text',
  ghost: 'border-transparent bg-transparent text-on-surface-variant hover:bg-surface-hover hover:text-on-surface',
  danger: 'border-[var(--erro-borda)] bg-[var(--erro-borda)] text-white hover:brightness-95',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-[12px]',
  md: 'h-8 gap-1.5 px-[13px] text-[12.5px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pbi-gold)]',
        'disabled:cursor-default disabled:opacity-55',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/** Botão quadrado só com ícone — o `.icon-btn` da logisticDashboard; sempre com `aria-label`. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }>(
  function IconButton({ label, active, className, children, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn('icon-btn shrink-0', active && 'ativo', className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
