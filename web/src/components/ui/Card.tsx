import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** O `.visual` da logisticDashboard: cartão de cantos de 8 px com cabeçalho vinho. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('visual v-auto', className)}>{children}</section>;
}

/**
 * Cabeçalho vinho, título centralizado em maiúsculas (como os visuais do
 * Power BI das dashboards). As ações ficam numa faixa logo abaixo.
 */
export function CardHeader({ title, subtitle, actions }: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <>
      <header>
        <span className="titulo">{title}</span>
        {subtitle && <span className="sub">{subtitle}</span>}
      </header>
      {actions && <div className="visual-acoes">{actions}</div>}
    </>
  );
}

/** Rótulo pequeno em maiúsculas espaçadas. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[10.5px] font-bold uppercase tracking-widest text-on-surface-variant/80', className)}>{children}</p>;
}
