import { AppException } from '../../common/errors/app.exception.js';
import { logger } from '../../common/helpers/logger.helper.js';
import { appConfig, hasVoalle } from '../../config/env.config.js';
import { nowIso, transaction } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import { countGrantsByProtocol, listGrants, type GrantView } from '../grants/grants.repository.js';
import { findPersonByEmail, type Person } from '../people/people.repository.js';
import type { Actor } from '../people/people.service.js';
import { findPlatformBySlug, listPlatforms } from '../platforms/platforms.repository.js';
import { buildResourcePath, listResourceNodes } from '../resources/resources.repository.js';
import { mapProtocolRow, type Protocol, type ProtocolState } from './protocol.mapper.js';
import { normalizeText, similarity, type RequestType } from './protocol-parser.js';
import { findTracking, listTrackings, upsertTracking, type ProtocolTracking } from './protocol-trackings.repository.js';
import { fetchAccessProtocols, type VoalleProtocolRow } from './voalle-protocols.repository.js';

/**
 * Fila de protocolos "em tempo real": o Voalle é relido em segundo plano a
 * cada PROTOCOLS_REFRESH_MS (padrão 3 min — a consulta leva ~50 ms) e a API
 * responde da última leitura boa. Se uma leitura falha, a fila continua com o
 * dado anterior e o erro aparece na tela, em vez de a lista sumir.
 */
type ProtocolSource = () => Promise<VoalleProtocolRow[]>;

let source: ProtocolSource = () => fetchAccessProtocols(appConfig.protocols.category, appConfig.protocols.since);
let snapshot: { protocols: Protocol[]; fetchedAt: string | null; lastError: string | null; lastAttemptAt: string | null } = {
  protocols: [],
  fetchedAt: null,
  lastError: null,
  lastAttemptAt: null,
};
let inFlight: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;
let lastLoggedError: string | null = null;

/** Só para os testes: troca a fonte (sem Voalle) e zera o estado. */
export function setProtocolSourceForTests(fn: ProtocolSource): void {
  source = fn;
  snapshot = { protocols: [], fetchedAt: null, lastError: null, lastAttemptAt: null };
  inFlight = null;
}

export function refreshProtocols(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    snapshot.lastAttemptAt = nowIso();
    try {
      if (!hasVoalle && !appConfig.isTest) throw new Error('Voalle não configurado (DB_VOALLE_* / DB_ELLEVEN_*).');
      const rows = await source();
      const now = new Date();
      snapshot = {
        protocols: rows.map((row) => mapProtocolRow(row, now, appConfig.auth.allowedDomain)),
        fetchedAt: now.toISOString(),
        lastError: null,
        lastAttemptAt: snapshot.lastAttemptAt,
      };
    } catch (err) {
      // o detalhe (host, porta, mensagem do driver) fica só no log; a tela recebe texto genérico
      const detail = err instanceof Error ? err.message : String(err);
      if (lastLoggedError !== detail) logger.warn('protocolos', `falha ao ler o Voalle: ${detail}`);
      lastLoggedError = detail;
      snapshot.lastError = hasVoalle || appConfig.isTest
        ? 'não foi possível ler o Voalle agora — nova tentativa em instantes'
        : 'Voalle não configurado no servidor';
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function startProtocolsScheduler(): void {
  if (timer) return;
  void refreshProtocols();
  timer = setInterval(() => void refreshProtocols(), appConfig.protocols.refreshMs);
  timer.unref();
}

export function stopProtocolsScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

async function currentProtocols(): Promise<Protocol[]> {
  if (!snapshot.fetchedAt) await refreshProtocols();
  return snapshot.protocols;
}

export interface ProtocolListItem extends Protocol {
  /** plataforma efetiva: a corrigida pelo time ou a deduzida da categoria */
  platformSlug: string | null;
  suggestedPlatformSlug: string | null;
  note: string;
  isHandled: boolean;
  handledBy: string | null;
  handledAt: string | null;
  grantsAdded: number;
  grantsRevoked: number;
  /** já tem registro aqui (acesso concedido/removido vinculado, ou marcado como tratado) */
  isRegistered: boolean;
}

function enrich(
  protocol: Protocol,
  trackings: Map<string, ProtocolTracking>,
  counts: Map<string, { added: number; revoked: number }>,
): ProtocolListItem {
  const tracking = trackings.get(protocol.protocolNumber);
  const count = counts.get(protocol.protocolNumber) ?? { added: 0, revoked: 0 };
  return {
    ...protocol,
    platformSlug: tracking?.platformSlug ?? protocol.platformSlug,
    suggestedPlatformSlug: protocol.platformSlug,
    note: tracking?.note ?? '',
    isHandled: tracking?.isHandled ?? false,
    handledBy: tracking?.handledBy ?? null,
    handledAt: tracking?.handledAt ?? null,
    grantsAdded: count.added,
    grantsRevoked: count.revoked,
    isRegistered: count.added + count.revoked > 0 || (tracking?.isHandled ?? false),
  };
}

export interface ProtocolFilter {
  state: ProtocolState | 'ALL';
  platformSlug?: string;
  requestType?: RequestType;
  search?: string;
  unregisteredOnly?: boolean;
}

export interface ProtocolQueueSummary {
  open: number;
  openLate: number;
  createdToday: number;
  closedThisMonth: number;
  unregistered: number;
  openByPlatform: Record<string, number>;
}

export async function listProtocols(filter: ProtocolFilter): Promise<{
  items: ProtocolListItem[];
  summary: ProtocolQueueSummary;
  fetchedAt: string | null;
  lastError: string | null;
  refreshMs: number;
}> {
  const protocols = await currentProtocols();
  const trackings = listTrackings();
  const counts = countGrantsByProtocol();
  const all = protocols.map((p) => enrich(p, trackings, counts));

  const search = filter.search ? normalizeText(filter.search) : '';
  const items = all.filter((p) => {
    if (filter.state !== 'ALL' && p.state !== filter.state) return false;
    if (filter.platformSlug && p.platformSlug !== filter.platformSlug) return false;
    if (filter.requestType && p.requestType !== filter.requestType) return false;
    if (filter.unregisteredOnly && (p.isRegistered || p.state === 'CANCELED')) return false;
    if (search) {
      const haystack = normalizeText([
        p.protocolNumber, p.requesterName, p.requesterEmail, p.targetEmail, p.requestedItems.join(' '), p.title, p.note,
      ].filter(Boolean).join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return {
    items,
    summary: summarize(all, new Date()),
    fetchedAt: snapshot.fetchedAt,
    lastError: snapshot.lastError,
    refreshMs: appConfig.protocols.refreshMs,
  };
}

/** Dia/mês civil de Brasília (-03:00) de um instante. */
const brtDay = (iso: string | Date): string => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

export function summarize(all: ProtocolListItem[], now: Date): ProtocolQueueSummary {
  const today = brtDay(now);
  const month = today.slice(0, 7);
  const openByPlatform: Record<string, number> = {};
  let open = 0;
  let openLate = 0;
  let createdToday = 0;
  let closedThisMonth = 0;
  let unregistered = 0;
  all.forEach((p) => {
    if (p.state === 'OPEN') {
      open += 1;
      if (p.isLate) openLate += 1;
      const key = p.platformSlug ?? 'sem-plataforma';
      openByPlatform[key] = (openByPlatform[key] ?? 0) + 1;
    }
    if (p.createdAt && brtDay(p.createdAt) === today) createdToday += 1;
    if (p.state === 'CLOSED' && p.closedAt && brtDay(p.closedAt).startsWith(month)) closedThisMonth += 1;
    if (p.state !== 'CANCELED' && !p.isRegistered) unregistered += 1;
  });
  return { open, openLate, createdToday, closedThisMonth, unregistered, openByPlatform };
}

export interface ResourceSuggestion {
  resourceId: number;
  name: string;
  path: string;
  resourceType: string;
  score: number;
}

export interface ProtocolDetail {
  protocol: ProtocolListItem;
  person: Person | null;
  /** acessos atuais da pessoa na plataforma do protocolo */
  personGrants: GrantView[];
  /** concessões/remoções feitas com este protocolo */
  linkedGrants: GrantView[];
  suggestions: ResourceSuggestion[];
}

export async function getProtocolDetail(protocolNumber: string): Promise<ProtocolDetail> {
  const protocols = await currentProtocols();
  const found = protocols.find((p) => p.protocolNumber === protocolNumber);
  if (!found) throw new AppException(404, 'PROTOCOL_NOT_FOUND', `Protocolo ${protocolNumber} não está na fila de Gestão de Acessos.`);
  const protocol = enrich(found, listTrackings(), countGrantsByProtocol());

  const person = protocol.targetEmail ? findPersonByEmail(protocol.targetEmail) : null;
  const platform = protocol.platformSlug ? findPlatformBySlug(protocol.platformSlug) : null;
  const personGrants = person ? listGrants({ personId: person.id, status: 'ACTIVE', ...(platform ? { platformId: platform.id } : {}) }) : [];

  return {
    protocol,
    person,
    personGrants,
    linkedGrants: listGrants({ protocolNumber }),
    suggestions: platform ? suggestResources(platform.id, protocol.requestedItems) : [],
  };
}

export function suggestResources(platformId: number, requestedItems: string[]): ResourceSuggestion[] {
  if (!requestedItems.length) return [];
  return listResourceNodes(platformId)
    .filter((node) => node.resourceType !== 'PLATFORM')
    .map((node) => ({
      resourceId: node.id,
      name: node.name,
      path: buildResourcePath(node.id),
      resourceType: node.resourceType,
      score: Math.max(...requestedItems.map((item) => similarity(item, node.name))),
    }))
    .filter((s) => s.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export async function updateProtocolTracking(
  protocolNumber: string,
  changes: { platformSlug?: string | null; note?: string; isHandled?: boolean },
  actor: Actor,
): Promise<ProtocolListItem> {
  const protocols = await currentProtocols();
  if (!protocols.some((p) => p.protocolNumber === protocolNumber)) {
    throw new AppException(404, 'PROTOCOL_NOT_FOUND', `Protocolo ${protocolNumber} não está na fila de Gestão de Acessos.`);
  }
  if (changes.platformSlug && !listPlatforms().some((p) => p.slug === changes.platformSlug)) {
    throw new AppException(422, 'PLATFORM_NOT_FOUND', 'Plataforma inválida.');
  }
  const now = nowIso();
  const current = findTracking(protocolNumber);
  const isHandled = changes.isHandled ?? current?.isHandled ?? false;
  const next: ProtocolTracking = {
    protocolNumber,
    platformSlug: changes.platformSlug === undefined ? current?.platformSlug ?? null : changes.platformSlug,
    note: changes.note ?? current?.note ?? '',
    isHandled,
    handledBy: isHandled ? (current?.isHandled ? current.handledBy : actor.email) : null,
    handledAt: isHandled ? (current?.isHandled ? current.handledAt : now) : null,
    updatedBy: actor.email,
    updatedAt: now,
  };
  transaction(() => {
    upsertTracking(next);
    insertAccessEvent({
      eventType: 'PROTOCOL_UPDATED',
      actorEmail: actor.email,
      protocolNumber,
      platformId: next.platformSlug ? findPlatformBySlug(next.platformSlug)?.id ?? null : null,
      detail: {
        platformSlug: changes.platformSlug === undefined ? undefined : changes.platformSlug,
        isHandled: changes.isHandled,
        note: changes.note === undefined ? undefined : changes.note,
      },
    });
  });
  return (await getProtocolDetail(protocolNumber)).protocol;
}

/** Protocolos abertos por plataforma — os cards e o menu lateral usam. */
export async function countOpenByPlatform(): Promise<Record<string, number>> {
  const { summary } = await listProtocols({ state: 'OPEN' });
  return summary.openByPlatform;
}
