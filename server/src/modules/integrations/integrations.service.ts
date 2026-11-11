import { AppException } from '../../common/errors/app.exception.js';
import { logger } from '../../common/helpers/logger.helper.js';
import { appConfig, hasHubApps, hasHubBi } from '../../config/env.config.js';
import { importAccessExport, type ImportStrategy, type ImportSummary, type ParsedImport } from '../imports/access-import.service.js';
import { parseHubAppsExport } from '../imports/hub-apps.parser.js';
import type { Actor } from '../people/people.service.js';
import { closeHubApps, fetchHubAppsSnapshot, hubAppsTables } from './hub-apps.source.js';
import { closeHubBi, fetchHubBiSnapshot, hubBiImport } from './hub-bi.source.js';

/**
 * Integração direta com os hubs (somente leitura): lê a origem, monta a mesma
 * entrada da importação de export e aplica com a mesma regra — casa pelo id,
 * não duplica, só grava o que mudou. O que sai da origem:
 *   - veio de lá (origem "Importado")  -> é removido daqui (espelho do hub);
 *   - foi registrado aqui (protocolo)  -> fica e conta como divergência.
 */
export type IntegrationSlug = 'hub-bi' | 'aplicacoes';
type Loader = () => Promise<ParsedImport>;

interface Integration {
  slug: IntegrationSlug;
  label: string;
  configured: () => boolean;
  load: Loader;
  strategy: ImportStrategy;
}

const INTEGRATIONS: Integration[] = [
  {
    slug: 'hub-bi',
    label: 'HUB BI',
    configured: () => hasHubBi,
    load: async () => hubBiImport(await fetchHubBiSnapshot()),
    // DHO_users é a lista completa do hub: quem sai dela perde o acesso à raiz
    strategy: { platformSlug: 'hub-bi', sourceLabel: 'HUB BI', eventSource: 'HUB_BI_SYNC', rootGrant: 'withLevel', rootTracksExport: true },
  },
  {
    slug: 'aplicacoes',
    label: 'HUB APPS',
    configured: () => hasHubApps,
    load: async () => parseHubAppsExport(hubAppsTables(await fetchHubAppsSnapshot())),
    strategy: {
      platformSlug: 'aplicacoes', sourceLabel: 'HUB APPS', eventSource: 'HUB_APPS_SYNC', rootGrant: 'everyone',
      rootTracksExport: true, resourceType: 'APPLICATION',
    },
  },
];

export interface IntegrationResult {
  items: number;
  people: number;
  grantsCreated: number;
  revoked: number;
  /** registrados aqui que não constam na origem (mantidos) */
  registeredHere: number;
  changed: boolean;
}

export interface IntegrationStatus {
  slug: IntegrationSlug;
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

interface State {
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastResult: IntegrationResult | null;
}

const LOAD_TIMEOUT_MS = 120_000;
export const SYSTEM_ACTOR: Actor = { email: 'sincronização automática' };

const freshState = (): State => ({ running: false, lastRunAt: null, lastSuccessAt: null, lastError: null, lastResult: null });
const states = new Map<IntegrationSlug, State>(INTEGRATIONS.map((i) => [i.slug, freshState()]));
const testLoaders = new Map<IntegrationSlug, Loader>();

/** Testes: troca a leitura da origem por uma função (e conta como configurada). */
export function setIntegrationLoaderForTests(slug: IntegrationSlug, loader: Loader | null): void {
  if (loader) testLoaders.set(slug, loader);
  else testLoaders.delete(slug);
  states.set(slug, freshState());
}

const integrationOf = (slug: string): Integration => {
  const found = INTEGRATIONS.find((i) => i.slug === slug);
  if (!found) throw new AppException(404, 'INTEGRATION_NOT_FOUND', 'Essa plataforma não tem integração direta.');
  return found;
};
const isConfigured = (i: Integration) => testLoaders.has(i.slug) || i.configured();

export function listIntegrationStatus(): IntegrationStatus[] {
  return INTEGRATIONS.map((i) => ({
    slug: i.slug,
    label: i.label,
    configured: isConfigured(i),
    intervalMs: appConfig.integrations.intervalMs,
    ...states.get(i.slug)!,
  }));
}

/** Lê a origem e aplica. Com `dryRun`, só calcula (nada gravado, status não muda). */
export async function syncIntegration(slug: string, actor: Actor, options: { dryRun: boolean }): Promise<ImportSummary> {
  const integration = integrationOf(slug);
  if (!isConfigured(integration)) {
    throw new AppException(409, 'INTEGRATION_NOT_CONFIGURED', `A conexão direta com o ${integration.label} não está configurada no servidor.`);
  }
  const state = states.get(integration.slug)!;
  if (state.running) throw new AppException(409, 'SYNC_RUNNING', `Já existe uma sincronização do ${integration.label} em andamento.`);

  state.running = true;
  const startedAt = new Date().toISOString();
  if (!options.dryRun) state.lastRunAt = startedAt;
  try {
    const load = testLoaders.get(integration.slug) ?? integration.load;
    let parsed: ParsedImport;
    try {
      parsed = await withTimeout(load(), LOAD_TIMEOUT_MS);
    } catch (err) {
      const message = describeError(integration.label, err);
      logger.warn('integracao', `${integration.label}: leitura falhou (${errorCode(err)})`);
      if (!options.dryRun) state.lastError = message;
      throw new AppException(502, 'INTEGRATION_FAILED', message);
    }
    const summary = importAccessExport(parsed, integration.strategy, {
      dryRun: options.dryRun, revokeMissing: true, revokeOnlyImported: true, quietWhenUnchanged: true,
    }, actor);
    if (!options.dryRun) {
      const result: IntegrationResult = {
        items: summary.dashboards.created.length + summary.dashboards.linked.length + summary.dashboards.renamed.length + summary.dashboards.unchanged,
        people: summary.people.created + summary.people.updated + summary.people.unchanged,
        grantsCreated: summary.grants.created + summary.hubAccess.created,
        revoked: summary.notInExport.revoked,
        registeredHere: summary.notInExport.registeredHere,
        changed: summary.grants.created + summary.hubAccess.created + summary.hubAccess.updated + summary.notInExport.revoked
          + summary.dashboards.created.length + summary.dashboards.renamed.length + summary.people.created + summary.people.updated > 0,
      };
      Object.assign(state, { lastSuccessAt: new Date().toISOString(), lastError: null, lastResult: result });
      logger.info('integracao', `${integration.label}: sincronizado · ${result.grantsCreated} novo(s), ${result.revoked} removido(s), ${result.registeredHere} só aqui`);
    }
    return summary;
  } finally {
    state.running = false;
  }
}

function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : err instanceof Error ? err.name : 'erro';
}

/**
 * Mensagem para a tela sem nada da conexão (endereço, usuário, chave): a
 * mensagem original do driver pode trazer esses dados, então não vai adiante.
 */
export function describeError(label: string, err: unknown): string {
  const code = errorCode(err);
  if (code === 'TIMEOUT') return `${label}: a leitura passou de ${LOAD_TIMEOUT_MS / 60_000} min e foi cancelada.`;
  if (['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', '16'].includes(code)) {
    return `${label}: a credencial foi recusada — confira usuário/senha ou a conta de serviço.`;
  }
  if (code === '7') return `${label}: a conta de serviço não tem permissão de leitura no Firestore.`;
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', '14'].includes(code)) {
    return `${label}: sem conexão com a origem (rede, endereço ou porta).`;
  }
  if (code === 'ENOENT') return `${label}: o arquivo da credencial não foi encontrado no servidor.`;
  if (code === 'SyntaxError') return `${label}: o arquivo da credencial não é um JSON válido.`;
  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return `${label}: a estrutura do banco mudou (tabela ou coluna não encontrada).`;
  return `${label}: falha ao ler a origem (${code}).`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let interval: NodeJS.Timeout | null = null;
let firstRun: NodeJS.Timeout | null = null;

/** Sincroniza cada hub configurado logo depois de subir e depois a cada HUB_SYNC_INTERVAL_MS. */
export function startIntegrationsScheduler(): void {
  const active = INTEGRATIONS.filter((i) => i.configured());
  if (!active.length || !appConfig.integrations.intervalMs || interval) return;
  const runAll = async () => {
    for (const integration of active) {
      try {
        await syncIntegration(integration.slug, SYSTEM_ACTOR, { dryRun: false });
      } catch {
        // já registrado no status e no log
      }
    }
  };
  firstRun = setTimeout(() => void runAll(), 10_000);
  firstRun.unref();
  interval = setInterval(() => void runAll(), appConfig.integrations.intervalMs);
  interval.unref();
}

export async function stopIntegrationsScheduler(): Promise<void> {
  if (firstRun) clearTimeout(firstRun);
  if (interval) clearInterval(interval);
  firstRun = null;
  interval = null;
  await Promise.all([closeHubApps(), closeHubBi()]);
}
