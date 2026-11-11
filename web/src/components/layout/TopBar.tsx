import { Bell, BellOff, Moon, RefreshCw, Settings, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { useProtocols, useRefreshProtocols } from '../../hooks/useProtocols';
import { clockTime, formatDateTime, timeAgo } from '../../utils/format';
import { ADMIN_PATH, COVER_PATH, pageForPath } from './pages';
import { PageNav } from './PageNav';
import { UserMenu } from './UserMenu';

const OPEN_FILTER = { state: 'OPEN' as const };
const APP_TITLE = 'CONTROLE DE ACESSOS';

function notificationState(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/**
 * Topo + navegação — mesmo desenho da logisticDashboard. Na CAPA o topo é o
 * próprio bloco vinho com o nome da aplicação (sem as abas: os cartões da capa
 * fazem esse papel); nas outras telas é a barra branca com o título da tela,
 * as ações e as abas (`PageNav`). Para voltar à capa, o logo.
 *
 * O ponto diz o estado da leitura do Voalle (a fila é relida a cada 3 min):
 * verde (em dia), dourado (atrasada), vermelho (a última leitura falhou),
 * cinza (lendo pela primeira vez).
 */
export function TopBar() {
  const { pathname } = useLocation();
  const { isAdmin } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { data } = useProtocols(OPEN_FILTER);
  const refresh = useRefreshProtocols();
  const [notify, setNotify] = useState(notificationState);
  const meta = data?.meta;

  const fetchedAt = meta?.fetchedAt ?? null;
  const age = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : Infinity;
  const refreshMs = meta?.refreshMs ?? 180_000;
  const stale = meta ? age > refreshMs * 3 : false;
  const failedFirst = !fetchedAt && Boolean(meta?.lastError);
  const dotClass = failedFirst ? 'error' : !fetchedAt ? 'loading' : meta?.lastError ? 'error' : stale ? 'stale' : '';
  const dotTitle = failedFirst ? `Não foi possível ler o Voalle: ${meta?.lastError ?? ''}`
    : !fetchedAt ? 'Lendo o Voalle pela primeira vez'
    : meta?.lastError ? `A última leitura do Voalle falhou — mostrando a de ${formatDateTime(fetchedAt)}`
      : `Fila relida a cada ${refreshMs >= 60_000 ? `${Math.round(refreshMs / 60_000)} min` : `${Math.round(refreshMs / 1000)} s`}`;
  const whenText = refresh.isPending ? 'atualizando…' : failedFirst ? 'Voalle indisponível' : !fetchedAt ? 'carregando…' : `Voalle lido às ${clockTime(fetchedAt)}`;
  const onCover = pathname === COVER_PATH;
  const title = pageForPath(pathname)?.title ?? APP_TITLE;

  const askNotifications = async () => {
    if (notify === 'default') setNotify(await Notification.requestPermission());
  };

  const actions = (
    <div className="topo-acoes">
      <div className="updated">
        <span className={`live-dot ${dotClass}`} title={dotTitle} />
        <span className="quando" title={fetchedAt ? `Lido ${timeAgo(fetchedAt)}` : undefined}>{whenText}</span>
        {isAdmin && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            title="Reler o Voalle agora (administradores)"
            aria-label="Reler o Voalle agora"
          >
            <span className={refresh.isPending ? 'spin' : ''}><RefreshCw size={15} /></span>
          </button>
        )}
        {isAdmin && (
          <NavLink
            to={ADMIN_PATH}
            className={({ isActive }) => `icon-btn${isActive ? ' ativo' : ''}`}
            title="Administração · usuários e permissões"
            aria-label="Administração"
          >
            <Settings size={15} />
          </NavLink>
        )}
        {notify !== 'unsupported' && (
          <button
            type="button"
            className={`icon-btn${notify === 'granted' ? ' ativo' : ''}`}
            onClick={askNotifications}
            title={notify === 'granted' ? 'Avisos de protocolo novo ligados' : notify === 'denied' ? 'Avisos bloqueados no navegador' : 'Avisar protocolo novo com notificação do sistema'}
            aria-label="Notificações de protocolo novo"
          >
            {notify === 'denied' ? <BellOff size={15} /> : <Bell size={15} />}
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
      <UserMenu />
    </div>
  );

  if (onCover) {
    return (
      <header className="topbar topbar-capa">
        {/* sem o logo-botão aqui: ele só leva à capa, e já se está nela */}
        <div className="capa-titulo">
          <img src="/logo-circular-sebratel.png" alt="" />
          <h1>{APP_TITLE}</h1>
          <p>Protocolos de Gestão de Acessos e quem tem acesso a quê — direto do Voalle</p>
        </div>
        {actions}
      </header>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link to={COVER_PATH} className="logo" title="Voltar para a capa">
          <img src="/logo-sebratel.svg" alt="Sebratel" />
          <span>{APP_TITLE}</span>
        </Link>
        <h1>{title}</h1>
        {actions}
      </header>
      <PageNav />
    </>
  );
}
