import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PersonDrawer } from '../../components/people/PersonDrawer';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { Checkbox, Select } from '../../components/ui/Field';
import { InitialsBar } from '../../components/ui/InitialsBar';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { usePeople } from '../../hooks/useAccessQueries';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePlatforms } from '../../hooks/usePlatforms';
import { cn } from '../../utils/cn';
import { titleCase } from '../../utils/format';

/** Quem tem acesso a quê, olhando pela pessoa (o título fica no topo). */
export default function PeoplePage() {
  // pessoa aberta no painel lateral fica no endereço (?pessoa=ID), como o protocolo na fila
  const [params, setParams] = useSearchParams();
  const openId = Number(params.get('pessoa')) || null;
  const openPerson = (id: number) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('pessoa', String(id)); return next; });
  const closePerson = useCallback(() => setParams((prev) => { const next = new URLSearchParams(prev); next.delete('pessoa'); return next; }), [setParams]);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [withAccess, setWithAccess] = useState(true);
  const [initial, setInitial] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const { data: platforms } = usePlatforms();
  const filters = useMemo(
    () => ({ search: debounced.trim() || undefined, platform: platform || undefined, withAccess, initial: initial || undefined, page, pageSize: 50 }),
    [debounced, platform, withAccess, initial, page],
  );
  const people = usePeople(filters);
  const platformName = (slug: string) => platforms?.find((p) => p.slug === slug)?.name ?? slug;

  return (
    <main className="page">
      <div className="filtros">
        <span className="rotulo">Filtros</span>
        <label className={cn('busca', search && 'ativo')}>
          <Search size={14} aria-hidden />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome, e-mail ou área…" aria-label="Buscar pessoa" className="!w-52" />
        </label>
        <Select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="w-auto" aria-label="Plataforma">
          <option value="">Qualquer plataforma</option>
          {platforms?.map((p) => <option key={p.slug} value={p.slug}>Com acesso a {p.name}</option>)}
        </Select>
        <Checkbox label="Só quem tem acesso ativo" checked={withAccess} onChange={(e) => { setWithAccess(e.target.checked); setPage(1); }} className="items-center text-[12.5px]" />
      </div>

      {people.isError && <ErrorState message="Não foi possível carregar as pessoas." />}
      <Card>
        <CardHeader
          title="Pessoas e acessos"
          subtitle={people.data
            ? `${people.data.meta.totalItems} pessoa(s)${initial ? ` com e-mail começando em “${initial.toUpperCase()}”` : ''} · clique numa linha para ver e editar o cadastro e os acessos`
            : undefined}
          actions={(
            <InitialsBar
              value={initial}
              counts={people.data?.meta.initials}
              onChange={(letter) => {
                setInitial(letter);
                setPage(1);
              }}
            />
          )}
        />
        {people.isLoading && <LoadingState />}
        {people.data && people.data.data.length === 0 && (
          <EmptyState className="m-3" title="Ninguém por aqui ainda" description="As pessoas entram no cadastro ao receberem o primeiro acesso (pela fila de protocolos, pela árvore de uma plataforma ou pela importação do HUB)." />
        )}
        {people.data && people.data.data.length > 0 && (
          <div className="tbl-wrap">
            <table className="pbi min-w-[860px]">
              <thead>
                <tr>
                  <th className="left">E-MAIL</th>
                  <th className="left">NOME</th>
                  <th className="left">ÁREA</th>
                  <th className="left">PLATAFORMAS</th>
                  <th>ACESSOS ATIVOS</th>
                </tr>
              </thead>
              <tbody>
                {people.data.data.map((p) => (
                  <tr key={p.id} className="clicavel" onClick={() => openPerson(p.id)}>
                    <td className="left">
                      <button
                        type="button"
                        className="text-left font-semibold text-on-surface hover:text-primary-text hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPerson(p.id);
                        }}
                      >
                        {p.email}
                      </button>
                      {!p.isActive && <Badge tone="warning" className="ml-2">Inativa</Badge>}
                    </td>
                    <td className="left">{titleCase(p.name) || '—'}</td>
                    <td className="left">{p.department || '—'}</td>
                    <td className="left whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {p.platforms.map((slug) => <Badge key={slug} tone="brand">{platformName(slug)}</Badge>)}
                        {!p.platforms.length && <span className="text-xs text-on-surface-variant">nenhuma</span>}
                      </div>
                    </td>
                    <td className="center font-semibold">{p.activeGrants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {people.data && people.data.meta.totalPages > 1 && (
          <div className="border-t border-outline px-3 py-2"><Pagination meta={people.data.meta} onPage={setPage} /></div>
        )}
      </Card>
      <PersonDrawer personId={openId} onClose={closePerson} />
    </main>
  );
}
