import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '../../services/types';
import { IconButton } from './Button';

export function Pagination({ meta, onPage }: { meta: PageMeta | undefined; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-[13px] text-on-surface-variant">
      <span className="tabular-nums">
        Página {meta.page} de {meta.totalPages} · {meta.totalItems} registros
      </span>
      <IconButton label="Página anterior" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        <ChevronLeft size={16} />
      </IconButton>
      <IconButton label="Próxima página" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        <ChevronRight size={16} />
      </IconButton>
    </div>
  );
}
