import {
  forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../utils/cn';

/** Mesmo campo do cadastro da logisticDashboard: 32 px, cantos de 8 px, foco vinho. */
export const CONTROL =
  'w-full rounded-lg border border-outline bg-surface-container-lowest px-[9px] text-[12.5px] text-on-surface transition-colors ' +
  'placeholder:text-on-surface-variant/70 focus:border-primary-text focus:outline-none focus:ring-[3px] focus:ring-primary-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--erro-borda)]';

/** Rótulo + controle + dica/erro. O controle recebe o id pelo `children(id)`. */
export function Field({ label, hint, error, children, className }: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('grid grid-cols-1 gap-1.5', className)}>
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-[0.5px] text-on-surface-variant">{label}</label>
      {children(id)}
      {error ? (
        <p className="text-xs font-medium text-rose-700 dark:text-rose-300" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(CONTROL, 'h-8', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, 'h-8 cursor-pointer pr-7', className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, 'min-h-16 resize-y py-1.5', className)} {...rest} />;
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }>(
  function Checkbox({ label, description, className, ...rest }, ref) {
    return (
      <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm text-on-surface', className)}>
        <input ref={ref} type="checkbox" className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-[var(--color-primary)]" {...rest} />
        <span>
          <span className="font-medium">{label}</span>
          {description && <span className="block text-xs text-on-surface-variant">{description}</span>}
        </span>
      </label>
    );
  },
);
