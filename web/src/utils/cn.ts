import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind resolvendo conflitos (o `className` de quem usa vence). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
