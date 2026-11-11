import { ChevronRight, Lock, Sparkles, TriangleAlert, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ADMIN_PAGE, CONTROL_PAGES, LOG_PATH, PEOPLE_PATH, PLATFORM_PAGES, PROTOCOLS_PAGE, type PageDefinition,
} from '../../components/layout/pages';
import { useSession } from '../../context/SessionContext';
import { useAccessEvents, usePeople } from '../../hooks/useAccessQueries';
import { usePlatforms } from '../../hooks/usePlatforms';
import { useProtocols } from '../../hooks/useProtocols';
import { pluralize, timeAgo } from '../../utils/format';

const APP_NAME = 'Controle de Acessos';
const OPEN_FILTER = { state: 'OPEN' as const };
const PEOPLE_FILTER = { withAccess: true, page: 1, pageSize: 1 };
const LAST_EVENT_FILTER = { page: 1, pageSize: 1 };

type Tone = 'ok' | 'loading' | 'error';

function ScreenCard({ page, info, tone = 'ok', dashed = false }: { page: PageDefinition; info?: string; tone?: Tone; dashed?: boolean }) {
  const Icon = page.icon;
  return (
    <Link to={page.path} className={`tela-card${dashed ? ' tela-config' : ''}`}>
      <span className="tela-icone"><Icon size={17} strokeWidth={1.8} /></span>
      <span className="tela-txt">
        <b>{page.label}</b>
        <span>{page.description}</span>
        {info && (
          <small className={`tela-dado dado-${tone}`}>
            {tone === 'error' ? <TriangleAlert size={11} /> : <Clock3 size={11} />} {info}
          </small>
        )}
      </span>
      <ChevronRight size={15} className="tela-seta" />
    </Link>
  );
}

/**
 * CAPA — boas-vindas com as telas da aplicação, cada uma com o número do
 * momento (mesmo formato da capa da logisticDashboard). O nome da aplicação
 * fica no topo vinho (TopBar, variante da capa).
 */
export default function CoverPage() {
  const { user, config, canEdit, isAdmin } = useSession();
  const { data: protocols } = useProtocols(OPEN_FILTER);
  const { data: platforms } = usePlatforms();
  const { data: people } = usePeople(PEOPLE_FILTER);
  const { data: lastEvent } = useAccessEvents(LAST_EVENT_FILTER);
  // sem login o "usuário" é fictício ("Modo sem autenticação"): melhor não cumprimentá-lo pelo nome
  const firstName = config?.enabled ? (user?.name ?? '').trim().split(/\s+/)[0] : '';

  const summary = protocols?.meta.summary;
  const protocolInfo = !protocols ? { text: 'lendo o Voalle…', tone: 'loading' as Tone }
    : protocols.meta.lastError ? { text: 'última leitura do Voalle falhou', tone: 'error' as Tone }
      : { text: summary?.open ? `${pluralize(summary.open, 'aberto', 'abertos')}${summary.openLate ? ` · ${summary.openLate} atrasado(s)` : ''}` : 'fila zerada', tone: 'ok' as Tone };

  const platformInfo = (slug: string | undefined): string | undefined => {
    const p = platforms?.find((x) => x.slug === slug);
    if (!p) return undefined;
    const open = p.openProtocols ? ` · ${pluralize(p.openProtocols, 'protocolo aberto', 'protocolos abertos')}` : '';
    return `${pluralize(p.stats.peopleWithAccess, 'pessoa', 'pessoas')} · ${pluralize(p.stats.activeGrants, 'acesso', 'acessos')}${open}`;
  };
  const controlInfo = (path: string): string | undefined => {
    if (path === PEOPLE_PATH) return people ? `${pluralize(people.meta.totalItems, 'pessoa', 'pessoas')} com acesso ativo` : undefined;
    if (path === LOG_PATH) {
      const event = lastEvent?.data[0];
      return lastEvent ? (event ? `última alteração ${timeAgo(event.createdAt)}` : 'nada registrado ainda') : undefined;
    }
    return undefined;
  };

  return (
    <main className="page sem-filtros capa-pagina">
      <section className="boas-vindas" aria-labelledby="boas-vindas-titulo">
        <div className="bv-texto">
          <span className="bv-selo"><Sparkles size={11} /> Boas-vindas</span>
          <h2 id="boas-vindas-titulo">{firstName ? `Olá, ${firstName}!` : 'Olá!'}</h2>
          <p className="bv-onde">Você está em <b>{APP_NAME}</b>.</p>
          <p className="bv-intro">
            Aqui você acompanha a fila de protocolos de Gestão de Acessos do Voalle, registra o que foi liberado ou
            removido em cada plataforma e consulta quem tem acesso a quê — com cada alteração guardada no log.
            Escolha uma das telas para começar.
          </p>
          {canEdit ? (
            <p className="bv-nota">
              Para registrar um acesso, abra o protocolo na <Link to={PROTOCOLS_PAGE.path}>fila</Link> ou use a árvore da plataforma.
            </p>
          ) : (
            <p className="bv-nota">Seu acesso é <b>Padrão</b> (consulta). Para registrar acessos, peça a permissão de Edição a um administrador.</p>
          )}
        </div>

        <nav className="bv-telas" aria-label="Telas da aplicação">
          <h3 className="capa-secao-titulo">Fila do Voalle</h3>
          <div className="capa-extra capa-primeira">
            <ScreenCard page={PROTOCOLS_PAGE} info={protocolInfo.text} tone={protocolInfo.tone} />
          </div>
          <h3 className="capa-secao-titulo capa-secao-ger">Plataformas</h3>
          <div className="capa-extra capa-primeira">
            {PLATFORM_PAGES.map((p) => (
              <ScreenCard key={p.path} page={p} info={platformInfo(p.platformSlug)} tone={platforms ? 'ok' : 'loading'} />
            ))}
          </div>
          <h3 className="capa-secao-titulo capa-secao-ger">Controle</h3>
          <div className="capa-extra capa-primeira">
            {CONTROL_PAGES.map((p) => <ScreenCard key={p.path} page={p} info={controlInfo(p.path)} />)}
          </div>
          {isAdmin && (
            <div className="capa-config">
              <ScreenCard page={ADMIN_PAGE} info="só administradores" dashed />
            </div>
          )}
        </nav>
      </section>
      {!config?.enabled && (
        <div className="banner"><Lock size={14} /> Login desligado neste ambiente (sem GOOGLE_CLIENT_ID): todos entram como administrador.</div>
      )}
    </main>
  );
}
