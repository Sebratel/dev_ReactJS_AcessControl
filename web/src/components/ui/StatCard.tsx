import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

type Tone = 'brand' | 'accent' | 'danger' | 'success' | 'neutral';

/**
 * Indicador no formato `.kpi` da logisticDashboard: cartão escuro, número
 * grande e rótulo em maiúsculas. Alerta vira dourado; problema, vinho. Clicável
 * quando recebe `onClick` (filtra a tela).
 */
export function StatCard({ label, value, tone = 'neutral', hint, onClick, active }: {
  label: string;
  value: number | string;
  /** mantido por compatibilidade: o `.kpi` não tem ícone */
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  const highlight = numeric > 0 ? (tone === 'danger' ? 'alerta-vinho' : tone === 'accent' ? 'alerta' : '') : '';
  const className = cn('kpi', highlight, onClick && 'clicavel', active && 'ativo');
  const body = (
    <>
      <span className="value">{value}</span>
      <span className="label">{label}</span>
      {hint && <span className="desc">{hint}</span>}
    </>
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={active}>
      {body}
    </button>
  );
}
