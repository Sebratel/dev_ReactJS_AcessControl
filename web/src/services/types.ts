/** Tipos das respostas da API (espelham os DTOs do servidor). Datas sempre em ISO 8601 UTC. */

export type TeamRole = 'VIEWER' | 'EDITOR' | 'ADMIN';

export interface AuthConfig {
  enabled: boolean;
  clientId: string;
  allowedDomain: string;
}

export interface SessionUser {
  email: string;
  name: string;
  picture: string | null;
  role: TeamRole;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PeopleListMeta extends PageMeta {
  /** quantas pessoas por letra inicial do e-mail (a–z ou '#'), com os outros filtros */
  initials: Record<string, number>;
}

// ------------------------------------------------------------- protocolos
export type ProtocolState = 'OPEN' | 'CLOSED' | 'CANCELED';
export type RequestType = 'INCLUSION' | 'EXCLUSION' | 'OTHER';

export interface Protocol {
  assignmentId: number;
  protocolNumber: string;
  title: string;
  statusLabel: string;
  state: ProtocolState;
  requestType: RequestType;
  platformSlug: string | null;
  suggestedPlatformSlug: string | null;
  category2: string | null;
  category3: string | null;
  solution: string | null;
  team: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  targetEmail: string | null;
  informedEmail: string | null;
  isInformedEmailValid: boolean;
  requestedItems: string[];
  descriptionText: string;
  responsibleName: string | null;
  createdAt: string | null;
  deadline: string | null;
  deliveryDeadline: string | null;
  closedAt: string | null;
  linkedProtocols: string[];
  totalDays: number | null;
  isLate: boolean;
  daysLate: number | null;
  note: string;
  isHandled: boolean;
  handledBy: string | null;
  handledAt: string | null;
  grantsAdded: number;
  grantsRevoked: number;
  isRegistered: boolean;
}

export interface ProtocolQueueSummary {
  open: number;
  openLate: number;
  createdToday: number;
  closedThisMonth: number;
  unregistered: number;
  openByPlatform: Record<string, number>;
}

export interface ProtocolListMeta {
  totalItems: number;
  summary: ProtocolQueueSummary;
  fetchedAt: string | null;
  lastError: string | null;
  refreshMs: number;
}

export interface ResourceSuggestion {
  resourceId: number;
  name: string;
  path: string;
  resourceType: ResourceType;
  score: number;
}

export interface ProtocolDetail {
  protocol: Protocol;
  person: Person | null;
  personGrants: Grant[];
  linkedGrants: Grant[];
  suggestions: ResourceSuggestion[];
}

// ------------------------------------------------------------ plataformas
export interface PlatformStats {
  resources: number;
  peopleWithAccess: number;
  activeGrants: number;
  peopleWithRootAccess: number;
}

export interface Platform {
  id: number;
  slug: string;
  name: string;
  description: string;
  url: string | null;
  sortOrder: number;
  rootResourceId: number;
  stats: PlatformStats;
  openProtocols: number;
}

export type ResourceType = 'PLATFORM' | 'DASHBOARD' | 'APPLICATION' | 'TAB' | 'FEATURE' | 'ROLE' | 'DATASET' | 'FOLDER';

export interface ResourceNode {
  id: number;
  platformId: number;
  parentId: number | null;
  resourceType: ResourceType;
  name: string;
  url: string | null;
  description: string;
  owner: string;
  isAccessControlled: boolean;
  externalRef: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  activeGrants: number;
}

// ------------------------------------------------------- pessoas e acessos
export interface Person {
  id: number;
  email: string;
  name: string;
  department: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonSummary extends Person {
  activeGrants: number;
  platforms: string[];
}

export type GrantStatus = 'ACTIVE' | 'REVOKED';
export type GrantSource = 'MANUAL' | 'PROTOCOL' | 'IMPORT';

export interface Grant {
  id: number;
  status: GrantStatus;
  accessLevel: string;
  source: GrantSource;
  protocolNumber: string | null;
  notes: string;
  grantedBy: string;
  grantedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
  revokeProtocolNumber: string | null;
  revokeNotes: string;
  resourceId: number;
  resourceName: string;
  resourceType: ResourceType;
  resourceParentId: number | null;
  platformId: number;
  platformSlug: string;
  platformName: string;
  personId: number;
  personEmail: string;
  personName: string;
}

export interface BatchGrantResult {
  peopleCount: number;
  created: Grant[];
  alreadyActive: Grant[];
}

export interface GrantResult {
  personId: number;
  created: Grant[];
  alreadyActive: Grant[];
}

// ------------------------------------------------------------------- log
export type AccessEventType =
  | 'GRANT_ADDED'
  | 'GRANT_REVOKED'
  | 'GRANT_UPDATED'
  | 'IMPORT_APPLIED'
  | 'RESOURCE_CREATED'
  | 'RESOURCE_UPDATED'
  | 'RESOURCE_REMOVED'
  | 'PERSON_CREATED'
  | 'PERSON_UPDATED'
  | 'PROTOCOL_UPDATED'
  | 'USER_ROLE_CHANGED';

export interface AccessEvent {
  id: number;
  eventType: AccessEventType;
  platformId: number | null;
  platformSlug: string | null;
  platformName: string | null;
  resourceId: number | null;
  personId: number | null;
  grantId: number | null;
  resourcePath: string;
  personEmail: string;
  personName: string | null;
  protocolNumber: string | null;
  actorEmail: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

// ------------------------------------------------------------- importação
export type ImportCell = string | number | boolean | null;

export interface ImportTable {
  header: ImportCell[];
  rows: ImportCell[][];
}

export interface ImportSummary {
  applied: boolean;
  rowsRead: number;
  rowsValid: number;
  ignoredCount: number;
  notices: string[];
  ignored: { rowNumber: number; reason: string }[];
  dashboards: { created: string[]; linked: string[]; renamed: { from: string; to: string }[]; unchanged: number };
  people: { created: number; updated: number; unchanged: number; withoutHubAccount: number };
  hubAccess: { created: number; updated: number; unchanged: number };
  grants: { created: number; unchanged: number };
  notInExport: {
    total: number;
    revoked: number;
    /** registrados aqui (protocolo/manual) que não constam na origem — mantidos */
    registeredHere: number;
    sample: { personEmail: string; resourceName: string; grantedAt: string }[];
  };
}

// ------------------------------------------------------- administração
export interface AppUser {
  email: string;
  name: string;
  picture: string | null;
  role: TeamRole;
  firstSeenAt: string;
  lastSeenAt: string;
  lastLoginAt: string | null;
  online: boolean;
}

// ------------------------------------------------- integração direta (hubs)
export interface IntegrationResult {
  items: number;
  people: number;
  grantsCreated: number;
  revoked: number;
  /** registrados aqui que não constam no hub (mantidos) */
  registeredHere: number;
  changed: boolean;
}

export interface IntegrationStatus {
  slug: string;
  label: string;
  configured: boolean;
  /** 0 = só pelo botão */
  intervalMs: number;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastResult: IntegrationResult | null;
}
