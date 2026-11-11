import { FileText, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Grant } from '../../services/types';
import { cn } from '../../utils/cn';
import { formatDate, formatDateTime, titleCase } from '../../utils/format';
import { RESOURCE_TYPE_ICON } from '../../utils/labels';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/Button';

const SOURCE_LABEL: Record<Grant['source'], string> = { MANUAL: 'Manual', PROTOCOL: 'Protocolo', IMPORT: 'Importado' };

/**
 * Lista de concessões. `mode="people"` destaca a pessoa (quem tem acesso a um
 * recurso); `mode="resources"` destaca o recurso (o que uma pessoa tem).
 */
export function GrantList({ grants, mode, onRevoke, canEdit, personHref }: {
  grants: Grant[];
  mode: 'people' | 'resources';
  onRevoke?: (grant: Grant) => void;
  canEdit: boolean;
  personHref?: (personId: number) => string;
}) {
  return (
    <ul className="divide-y divide-outline">
      {grants.map((g) => {
        const Icon = RESOURCE_TYPE_ICON[g.resourceType];
        const revoked = g.status === 'REVOKED';
        return (
          <li key={g.id} className={cn('flex items-start gap-3 py-2.5', revoked && 'opacity-60')}>
            <div className="min-w-0 flex-1">
              {mode === 'people' ? (
                <p className="truncate text-[13.5px] font-semibold text-on-surface">
                  {personHref ? <Link to={personHref(g.personId)} className="hover:underline">{g.personEmail}</Link> : g.personEmail}
                  {g.personName && <span className="ml-2 font-normal text-on-surface-variant">{titleCase(g.personName)}</span>}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-on-surface">
                  <Icon size={14} aria-hidden className="shrink-0 text-primary-text" />{g.resourceName}
                  <span className="font-normal text-on-surface-variant">· {g.platformName}</span>
                </p>
              )}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
                <span title={formatDateTime(g.grantedAt)}>desde {formatDate(g.grantedAt)}</span>
                <span>por {g.grantedBy}</span>
                {g.protocolNumber && <span className="inline-flex items-center gap-0.5 font-mono"><FileText size={11} aria-hidden />{g.protocolNumber}</span>}
                <Badge>{SOURCE_LABEL[g.source]}</Badge>
                {g.accessLevel && <Badge tone="accent">{g.accessLevel}</Badge>}
                {revoked && <Badge tone="danger">Removido em {formatDate(g.revokedAt)}</Badge>}
              </p>
              {g.notes && <p className="mt-1 text-xs italic text-on-surface-variant">“{g.notes}”</p>}
            </div>
            {canEdit && !revoked && onRevoke && (
              <IconButton label={`Remover acesso de ${g.personEmail} a ${g.resourceName}`} onClick={() => onRevoke(g)} className="text-rose-700 dark:text-rose-300">
                <UserMinus size={15} />
              </IconButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}
