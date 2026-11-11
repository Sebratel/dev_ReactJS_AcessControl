import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

/** Botões segmentados — o `.alternador` da logisticDashboard (rola na horizontal no celular). */
export function Tabs<T extends string>({ items, value, onChange, label, className }: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** rótulo cinza à esquerda (`.alternador-rotulo`) */
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <div role="tablist" className="alternador">
        {label && <span className="alternador-rotulo">{label}</span>}
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn('whitespace-nowrap', active && 'on')}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined && <span className="tabular-nums opacity-80">({item.count})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
