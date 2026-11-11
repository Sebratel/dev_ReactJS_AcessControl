import { ChevronDown, ChevronUp } from 'lucide-react';
import { Fragment, useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDismiss } from '../../hooks/useDismiss';
import { usePlatforms } from '../../hooks/usePlatforms';
import { NAV_COLUMNS, NAV_GROUPS, pageForPath, PROTOCOLS_PATH } from './pages';

type Group = (typeof NAV_GROUPS)[number];

/** As células de uma linha na grade: coluna 1 = grupo; cada tela ocupa um par (ícone, aba). */
function RowCells({ group, gridRow, pathname, first, counts }: {
  group: Group;
  gridRow: number;
  pathname: string;
  first: boolean;
  counts: Record<string, number>;
}) {
  const below = first ? '' : ' baixo';
  const current = pageForPath(pathname);
  const groupActive = group.pages.some((p) => p.path === current?.path);
  return (
    <>
      <span className={`nav-grupo${below}${groupActive ? ' ativo' : ''}`} style={{ gridRow }} aria-hidden="true">{group.label}</span>
      {group.pages.map((page, col) => {
        const Icon = page.icon;
        const count = counts[page.path] ?? 0;
        return (
          <Fragment key={page.path}>
            <span
              className={`nav-icone${below}${current?.path === page.path ? ' ativo' : ''}`}
              style={{ gridRow, gridColumn: col * 2 + 2 }}
              aria-hidden="true"
            >
              <Icon size={17} strokeWidth={1.8} />
            </span>
            <NavLink
              to={page.path}
              style={{ gridRow, gridColumn: col * 2 + 3 }}
              className={({ isActive }) => `${below.trim()}${isActive ? ' active' : ''}`.trim() || undefined}
              aria-label={count ? `${page.label} — ${count} protocolo(s) aberto(s)` : page.label}
            >
              {page.label}
              {count > 0 && <span className="nav-contador">{count}</span>}
            </NavLink>
          </Fragment>
        );
      })}
      {group.pages.length < NAV_COLUMNS && (
        <span className={`nav-vazio${below}`} style={{ gridRow, gridColumn: `${group.pages.length * 2 + 2} / -1` }} aria-hidden="true" />
      )}
    </>
  );
}

/**
 * Abas das telas, RECOLHIDAS (como na logisticDashboard): fica à vista só a
 * linha do grupo da tela aberta; "Mais telas" abre os OUTROS grupos por cima
 * do conteúdo. O painel se fecha ao escolher uma tela, ao clicar fora ou com Esc.
 * As abas mostram quantos protocolos estão abertos.
 */
export function PageNav() {
  const { pathname } = useLocation();
  const { data: platforms } = usePlatforms();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const panelId = useId();

  useEffect(() => setOpen(false), [pathname]);

  const counts: Record<string, number> = { [PROTOCOLS_PATH]: platforms?.reduce((sum, p) => sum + p.openProtocols, 0) ?? 0 };
  platforms?.forEach((p) => { counts[`/plataformas/${p.slug}`] = p.openProtocols; });

  const currentPage = pageForPath(pathname);
  const current = NAV_GROUPS.find((g) => g.pages.some((p) => p.path === currentPage?.path));
  const others = NAV_GROUPS.filter((g) => g !== current);
  const style = { '--nav-colunas': NAV_COLUMNS } as CSSProperties;

  return (
    <div className={`pagenav-wrap${open ? ' aberta' : ''}`} ref={ref}>
      <nav className="pagenav" style={style} aria-label="Telas do grupo aberto">
        {current ? (
          <RowCells group={current} gridRow={1} pathname={pathname} first counts={counts} />
        ) : (
          <>
            <span className="nav-grupo" style={{ gridRow: 1 }} aria-hidden="true">Telas</span>
            <span className="nav-dica" style={{ gridRow: 1 }}>Escolha uma tela em “Mais telas”</span>
          </>
        )}
      </nav>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Recolher as abas' : 'Mostrar as telas dos outros grupos'}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span>{open ? 'Recolher' : 'Mais telas'}</span>
      </button>
      {open && (
        <nav
          id={panelId}
          className="pagenav pagenav-painel"
          style={{ ...style, gridTemplateRows: `repeat(${others.length}, var(--h-nav-linha))` }}
          aria-label="Telas dos outros grupos"
        >
          {others.map((group, i) => (
            <RowCells key={group.key} group={group} gridRow={i + 1} pathname={pathname} first={i === 0} counts={counts} />
          ))}
        </nav>
      )}
    </div>
  );
}
