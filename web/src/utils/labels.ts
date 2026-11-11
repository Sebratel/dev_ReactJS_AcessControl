import {
  AppWindow, BarChart3, Database, FileSpreadsheet, Folder, KeyRound, Layers, LayoutDashboard, PanelTop, Shield,
  Sparkles, ToggleRight, type LucideIcon,
} from 'lucide-react';
import type { AccessEventType, RequestType, ResourceType, TeamRole } from '../services/types';

/** Ícone de cada plataforma (as que existirem além destas usam o genérico). */
export const PLATFORM_ICON: Record<string, LucideIcon> = {
  'hub-bi': BarChart3,
  datahub: Database,
  aplicacoes: AppWindow,
  appsheet: FileSpreadsheet,
  upvalue: Sparkles,
};

export const platformIcon = (slug: string | null | undefined): LucideIcon => (slug && PLATFORM_ICON[slug]) || Layers;

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  PLATFORM: 'Plataforma',
  DASHBOARD: 'Dashboard',
  APPLICATION: 'Aplicação',
  TAB: 'Aba / página',
  FEATURE: 'Funcionalidade',
  ROLE: 'Papel / perfil',
  DATASET: 'Conjunto de dados',
  FOLDER: 'Pasta / grupo',
};

export const RESOURCE_TYPE_ICON: Record<ResourceType, LucideIcon> = {
  PLATFORM: Shield,
  DASHBOARD: LayoutDashboard,
  APPLICATION: AppWindow,
  TAB: PanelTop,
  FEATURE: ToggleRight,
  ROLE: KeyRound,
  DATASET: Database,
  FOLDER: Folder,
};

/** Tipos sugeridos para criar abaixo de cada tipo — o primeiro é o padrão. */
export const CHILD_TYPES: Record<ResourceType, Exclude<ResourceType, 'PLATFORM'>[]> = {
  PLATFORM: ['DASHBOARD', 'APPLICATION', 'FOLDER', 'DATASET', 'ROLE'],
  FOLDER: ['DASHBOARD', 'APPLICATION', 'FOLDER', 'DATASET'],
  DASHBOARD: ['TAB', 'ROLE', 'FEATURE'],
  APPLICATION: ['FEATURE', 'ROLE', 'TAB'],
  DATASET: ['FEATURE', 'ROLE'],
  TAB: ['FEATURE', 'ROLE'],
  FEATURE: ['FEATURE', 'ROLE'],
  ROLE: ['FEATURE'],
};

/** Tipo padrão do primeiro nível de cada plataforma. */
export const DEFAULT_TOP_TYPE: Record<string, Exclude<ResourceType, 'PLATFORM'>> = {
  'hub-bi': 'DASHBOARD',
  datahub: 'DASHBOARD',
  aplicacoes: 'APPLICATION',
  appsheet: 'APPLICATION',
  upvalue: 'DASHBOARD',
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  INCLUSION: 'Inclusão',
  EXCLUSION: 'Exclusão',
  OTHER: 'Outro',
};

export const EVENT_LABEL: Record<AccessEventType, string> = {
  GRANT_ADDED: 'Acesso concedido',
  GRANT_REVOKED: 'Acesso removido',
  GRANT_UPDATED: 'Acesso alterado',
  IMPORT_APPLIED: 'Importação',
  RESOURCE_CREATED: 'Recurso cadastrado',
  RESOURCE_UPDATED: 'Recurso alterado',
  RESOURCE_REMOVED: 'Recurso removido',
  PERSON_CREATED: 'Pessoa cadastrada',
  PERSON_UPDATED: 'Pessoa alterada',
  PROTOCOL_UPDATED: 'Protocolo anotado',
  USER_ROLE_CHANGED: 'Permissão alterada',
};

/** Papéis — os mesmos nomes da logisticDashboard. */
export const ROLE_LABEL: Record<TeamRole, string> = {
  ADMIN: 'Admin',
  EDITOR: 'Edição',
  VIEWER: 'Padrão',
};

export const ROLE_ORDER: TeamRole[] = ['VIEWER', 'EDITOR', 'ADMIN'];

/** O que cada permissão libera — vai no diálogo de confirmação da Administração. */
export const ROLE_EFFECT: Record<TeamRole, string> = {
  VIEWER: 'Passa a só consultar a aplicação.',
  EDITOR: 'Passa a poder conceder e remover acessos, editar a árvore, as pessoas e importar do HUB.',
  ADMIN: 'Passa a ter acesso à Administração (usuários e permissões) e à releitura manual do Voalle, além da edição.',
};
