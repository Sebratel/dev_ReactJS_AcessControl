import { History, Inbox, Settings, Users, type LucideIcon } from 'lucide-react';
import { PLATFORM_ICON } from '../../utils/labels';

/**
 * As telas da aplicação — mesmo desenho do `pages.ts` da logisticDashboard:
 * cada tela tem nome (aba), título (topo), descrição e ícone (cartões da capa),
 * e os grupos viram as linhas de abas do topo.
 */
export interface PageDefinition {
  path: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** telas de plataforma: o slug (contadores vêm de /platforms) */
  platformSlug?: string;
}

export const COVER_PATH = '/capa';
export const PROTOCOLS_PATH = '/protocolos';
/** Tela só de administradores — botão próprio no topo, fora das abas. */
export const ADMIN_PATH = '/administracao';
export const PEOPLE_PATH = '/pessoas';
export const LOG_PATH = '/log';

export const platformPath = (slug: string): string => `/plataformas/${slug}`;
export const personPath = (id: number): string => `${PEOPLE_PATH}/${id}`;

const PLATFORMS: { slug: string; label: string; description: string }[] = [
  { slug: 'hub-bi', label: 'HUB BI', description: 'Acesso ao hub, a cada dashboard e às abas internas.' },
  { slug: 'aplicacoes', label: 'HUB APPS', description: 'Acesso ao hub, às aplicações e aos controles internos.' },
  { slug: 'upvalue', label: 'UpValue', description: 'Acesso à ferramenta e a cada dashboard dela.' },
  { slug: 'appsheet', label: 'AppSheet', description: 'Aplicativos AppSheet e seus controles internos.' },
  { slug: 'datahub', label: 'DataHub', description: 'Conjuntos de dados, dashboards e permissões internas.' },
];

export const PLATFORM_PAGES: PageDefinition[] = PLATFORMS.map((p) => ({
  path: platformPath(p.slug),
  label: p.label,
  title: p.label,
  description: p.description,
  icon: PLATFORM_ICON[p.slug] ?? Settings,
  platformSlug: p.slug,
}));

export const PROTOCOLS_PAGE: PageDefinition = {
  path: PROTOCOLS_PATH,
  label: 'Protocolos',
  title: 'Protocolos de Gestão de Acessos',
  description: 'A fila do Voalle em tempo real: o que foi pedido, por quem, prazo e se já tem registro aqui.',
  icon: Inbox,
};

export const CONTROL_PAGES: PageDefinition[] = [
  { path: PEOPLE_PATH, label: 'Pessoas', title: 'Pessoas', description: 'Tudo o que cada pessoa acessa, o histórico e remover todos os acessos.', icon: Users },
  { path: LOG_PATH, label: 'Log de alterações', title: 'Log de alterações', description: 'Toda adição e remoção de acesso: quem fez, quando e com qual protocolo.', icon: History },
];

export const ADMIN_PAGE: PageDefinition = {
  path: ADMIN_PATH,
  label: 'Administração',
  title: 'Administração',
  description: 'Usuários, quem está online e a permissão de cada um (Padrão, Edição, Admin).',
  icon: Settings,
};

/** Linhas de abas do topo, na ordem da capa. */
export const NAV_GROUPS: { key: string; label: string; pages: PageDefinition[] }[] = [
  { key: 'fila', label: 'Fila do Voalle', pages: [PROTOCOLS_PAGE] },
  { key: 'plataformas', label: 'Plataformas', pages: PLATFORM_PAGES },
  { key: 'controle', label: 'Controle', pages: CONTROL_PAGES },
];

export const NAV_COLUMNS = Math.max(...NAV_GROUPS.map((g) => g.pages.length));

const ALL_PAGES = [PROTOCOLS_PAGE, ...PLATFORM_PAGES, ...CONTROL_PAGES, ADMIN_PAGE];

/** A tela de uma rota (inclui as de detalhe: /pessoas/12 é a tela Pessoas). */
export function pageForPath(pathname: string): PageDefinition | undefined {
  return ALL_PAGES.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
}
