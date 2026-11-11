import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlatformGrants, usePlatformResources } from '../../hooks/usePlatforms';
import type { Grant, Platform } from '../../services/types';
import { formatDate, titleCase } from '../../utils/format';
import { nodePath } from '../../utils/tree';
import { personPath } from '../layout/pages';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../ui/States';

interface PersonAccess {
  personId: number;
  email: string;
  name: string;
  grants: Grant[];
  hasRoot: boolean;
  since: string;
}

/** "Quem tem acesso a quê" na plataforma: uma linha por pessoa, com os itens liberados. */
export function PlatformPeopleTab({ platform }: { platform: Platform }) {
  const grants = usePlatformGrants(platform.slug, 'ACTIVE');
  const resources = usePlatformResources(platform.slug);
  const [search, setSearch] = useState('');

  const people = useMemo<PersonAccess[]>(() => {
    const byPerson = new Map<number, PersonAccess>();
    (grants.data ?? []).forEach((g) => {
      const entry = byPerson.get(g.personId) ?? { personId: g.personId, email: g.personEmail, name: g.personName, grants: [], hasRoot: false, since: g.grantedAt };
      entry.grants.push(g);
      if (g.resourceParentId === null) entry.hasRoot = true;
      if (g.grantedAt < entry.since) entry.since = g.grantedAt;
      byPerson.set(g.personId, entry);
    });
    const q = search.trim().toLowerCase();
    return [...byPerson.values()]
      .filter((p) => !q || p.email.includes(q) || p.name.toLowerCase().includes(q) || p.grants.some((g) => g.resourceName.toLowerCase().includes(q)))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR'));
  }, [grants.data, search]);

  if (grants.isLoading || resources.isLoading) return <LoadingState />;
  if (grants.isError) return <ErrorState message="Não foi possível carregar os acessos." />;
  const nodes = resources.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pessoa ou item…" className="pl-9" aria-label="Buscar pessoa" />
      </div>
      {people.length === 0 ? (
        <EmptyState title="Ninguém com acesso registrado" description={`Os acessos de ${platform.name} aparecem aqui conforme forem registrados.`} />
      ) : (
        <section className="visual v-auto"><header><span className="titulo">Quem tem acesso a quê</span><span className="sub">uma linha por pessoa, com os itens liberados</span></header><div className="tbl-wrap">
          <table className="pbi min-w-[760px]">
            <thead>
              <tr>
                <th className="left">E-MAIL</th>
                <th>ACESSO À FERRAMENTA</th>
                <th className="left">ITENS LIBERADOS</th>
                <th>DESDE</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.personId} className="align-top">
                  <td className="left">
                    <Link to={personPath(p.personId)} className="font-semibold text-on-surface hover:text-primary-text hover:underline">{p.email}</Link>
                    {p.name && <p className="text-xs text-on-surface-variant">{titleCase(p.name)}</p>}
                  </td>
                  <td className="center">{p.hasRoot ? <Badge tone="success">Sim</Badge> : <Badge tone="warning">Não registrado</Badge>}</td>
                  <td className="left whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {p.grants.filter((g) => g.resourceParentId !== null).map((g) => (
                        <span key={g.id} className="rounded-lg bg-surface-container-low px-2 py-0.5 text-xs text-on-surface ring-1 ring-outline" title={g.accessLevel || undefined}>
                          {nodePath(nodes, g.resourceId) || g.resourceName}
                        </span>
                      ))}
                      {p.grants.every((g) => g.resourceParentId === null) && <span className="text-xs text-on-surface-variant">Só o hub</span>}
                    </div>
                  </td>
                  <td className="center tabular-nums">{formatDate(p.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></section>
      )}
    </div>
  );
}
