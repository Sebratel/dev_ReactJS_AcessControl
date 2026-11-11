import { AppException } from '../../common/errors/app.exception.js';
import { nowIso, transaction } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import { insertGrant, listGrants, updateGrantDetails, type GrantView } from '../grants/grants.repository.js';
import { revokeMany } from '../grants/grants.service.js';
import { findPersonByEmail, insertPerson, updatePerson, type Person } from '../people/people.repository.js';
import type { Actor } from '../people/people.service.js';
import { findPlatformBySlug } from '../platforms/platforms.repository.js';
import { normalizeText } from '../protocols/protocol-parser.js';
import { buildResourcePath, insertResource, listResourceNodes, updateResource } from '../resources/resources.repository.js';

/**
 * Núcleo das importações de export (HUB BI, UpValue…): cada formato tem o
 * próprio leitor, que entrega estas linhas; daqui para frente é igual para todos.
 */
export interface AccessImportRecord {
  rowNumber: number;
  /** identidade do item na origem (id do dashboard, nome do relatório) — vira `external_ref` */
  resourceKey: string;
  resourceName: string;
  email: string;
  userName: string | null;
  /** nível de acesso à ferramenta, quando o export traz (HUB BI: Admin/User) */
  rootLevel: string | null;
  grantedAt: string | null;
  /** id da permissão na origem, só para o log */
  sourceRef: string | null;
  /** complemento da observação da concessão (ex.: "via perfil") */
  note?: string | null;
}

/** Item da origem com dados além do nome (link, situação) — opcional. */
export interface ImportItem {
  key: string;
  name: string;
  url?: string | null;
  description?: string | null;
  /**
   * false = aberto a todo mundo do hub (ex.: app do HUB APPS sem nenhuma
   * regra): vira item "sem controle próprio" (herda do hub), sem concessões.
   * Quando informado, acompanha a origem também nos itens que já existem.
   */
  accessControlled?: boolean;
}

/**
 * Pessoa com acesso à ferramenta mesmo sem nenhum item (o cadastro de
 * usuários do hub), com o nível e a área — opcional.
 */
export interface ImportMember {
  email: string;
  userName: string | null;
  rootLevel: string | null;
  department?: string | null;
  /** desde quando tem acesso à ferramenta (ISO) */
  since?: string | null;
}

export interface IgnoredRow {
  rowNumber: number;
  reason: string;
}

export interface ParsedImport {
  records: AccessImportRecord[];
  ignored: IgnoredRow[];
  rowsRead: number;
  items?: ImportItem[];
  members?: ImportMember[];
  /** avisos do leitor (arquivos reconhecidos, o que foi deixado de fora) */
  notices?: string[];
}

export interface ImportStrategy {
  platformSlug: string;
  /** "Importado do …" nas concessões e no log */
  sourceLabel: string;
  /** identifica a importação no evento IMPORT_APPLIED */
  eventSource: string;
  /** quem recebe o acesso à ferramenta (raiz): só quem tem nível no export, ou todo mundo listado */
  rootGrant: 'withLevel' | 'everyone';
  /**
   * O export lista TODOS os usuários da ferramenta: acesso à raiz de quem não
   * aparece mais entra em "não consta" (no HUB BI não — quem não tem permissão
   * em dashboard nenhum simplesmente não aparece no export).
   */
  rootTracksExport: boolean;
  /** nome exibido na árvore (ex.: sem o prefixo "[Up] ") */
  displayName?: (name: string) => string;
  /** tipo dos itens criados na árvore (padrão: dashboard) */
  resourceType?: 'DASHBOARD' | 'APPLICATION';
}

export interface ImportSummary {
  applied: boolean;
  rowsRead: number;
  rowsValid: number;
  ignoredCount: number;
  ignored: IgnoredRow[];
  notices: string[];
  dashboards: { created: string[]; linked: string[]; renamed: { from: string; to: string }[]; unchanged: number };
  people: { created: number; updated: number; unchanged: number; withoutHubAccount: number };
  hubAccess: { created: number; updated: number; unchanged: number };
  grants: { created: number; unchanged: number };
  notInExport: {
    total: number;
    revoked: number;
    /** registrados aqui (protocolo/manual) e ausentes na origem: mantidos, são divergência */
    registeredHere: number;
    sample: { personEmail: string; resourceName: string; grantedAt: string }[];
  };
}

export interface ImportOptions {
  /** só calcula (tudo roda numa transação desfeita no fim): a prévia é o mesmo código da importação */
  dryRun: boolean;
  /** remove daqui os acessos que não constam mais no export */
  revokeMissing: boolean;
  /**
   * com `revokeMissing`: remove só o que veio da própria origem (origem
   * "Importado"); o que foi registrado aqui fica e conta como divergência.
   * É o modo da sincronização automática.
   */
  revokeOnlyImported?: boolean;
  /** não grava o evento de importação quando nada mudou (sincronização periódica) */
  quietWhenUnchanged?: boolean;
}

const SAMPLE = 30;

class DryRunRollback extends Error {
  constructor(readonly summary: ImportSummary) {
    super('dry-run');
  }
}

/**
 * Importa um export para a árvore da plataforma:
 * - item da origem -> item da árvore, casado pela chave (`external_ref`); sem
 *   chave conhecida, casa pelo nome com um item cadastrado à mão; senão cria;
 * - e-mail -> pessoa; acesso à ferramenta -> raiz (com o nível, quando houver);
 * - cada linha -> acesso ao item (origem "Importado").
 * Idempotente: importar o mesmo arquivo de novo não muda nada.
 */
export function importAccessExport(parsed: ParsedImport, strategy: ImportStrategy, options: ImportOptions, actor: Actor): ImportSummary {
  const platform = findPlatformBySlug(strategy.platformSlug);
  if (!platform) throw new AppException(500, 'PLATFORM_NOT_FOUND', `Plataforma ${strategy.platformSlug} não encontrada.`);
  try {
    return transaction(() => {
      const summary = apply(parsed, strategy, options, actor, platform.id, platform.rootResourceId);
      if (options.dryRun) throw new DryRunRollback(summary);
      return summary;
    });
  } catch (err) {
    if (err instanceof DryRunRollback) return err.summary;
    throw err;
  }
}

function apply(parsed: ParsedImport, strategy: ImportStrategy, options: ImportOptions, actor: Actor, platformId: number, rootId: number): ImportSummary {
  const now = nowIso();
  const note = `Importado do ${strategy.sourceLabel}`;
  const display = strategy.displayName ?? ((name: string) => name);
  const summary: ImportSummary = {
    applied: !options.dryRun,
    rowsRead: parsed.rowsRead,
    rowsValid: parsed.records.length,
    ignoredCount: parsed.ignored.length,
    ignored: parsed.ignored.slice(0, 50),
    notices: parsed.notices ?? [],
    dashboards: { created: [], linked: [], renamed: [], unchanged: 0 },
    people: { created: 0, updated: 0, unchanged: 0, withoutHubAccount: 0 },
    hubAccess: { created: 0, updated: 0, unchanged: 0 },
    grants: { created: 0, unchanged: 0 },
    notInExport: { total: 0, revoked: 0, registeredHere: 0, sample: [] },
  };
  const paths = new Map<number, string>();
  const pathOf = (id: number) => {
    if (!paths.has(id)) paths.set(id, buildResourcePath(id));
    return paths.get(id)!;
  };

  // ------------------------------------------------------------------- itens
  const nodes = listResourceNodes(platformId);
  const byRef = new Map(nodes.filter((n) => n.externalRef).map((n) => [n.externalRef!, n]));
  const byName = new Map(
    nodes
      .filter((n) => !n.externalRef && ['DASHBOARD', 'APPLICATION', 'DATASET'].includes(n.resourceType))
      .map((n) => [normalizeText(n.name), n]),
  );
  const items = new Map<string, { name: string; url: string | null; description: string | null; accessControlled?: boolean }>();
  (parsed.items ?? []).forEach((i) => items.set(i.key, {
    name: display(i.name), url: i.url ?? null, description: i.description ?? null, accessControlled: i.accessControlled,
  }));
  parsed.records.forEach((r) => {
    if (!items.has(r.resourceKey)) items.set(r.resourceKey, { name: display(r.resourceName), url: null, description: null });
  });
  const openKeys = new Set([...items.entries()].filter(([, i]) => i.accessControlled === false).map(([key]) => key));
  const resourceByKey = new Map<string, number>();
  const resourceType = strategy.resourceType ?? 'DASHBOARD';

  [...items.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR')).forEach(([key, item]) => {
    const { name } = item;
    const existing = byRef.get(key);
    if (existing) {
      resourceByKey.set(key, existing.id);
      // link que faltava aqui vem da origem; os editados à mão ficam como estão
      if (!existing.url && item.url) updateResource(existing.id, { url: item.url }, now);
      // aberto/fechado a todos acompanha a origem quando ela informa
      if (item.accessControlled !== undefined && existing.isAccessControlled !== item.accessControlled) {
        updateResource(existing.id, { isAccessControlled: item.accessControlled }, now);
        summary.dashboards.renamed.push({
          from: existing.name,
          to: `${name} (${item.accessControlled ? 'com controle próprio' : 'aberto a todos do hub'})`,
        });
        insertAccessEvent({
          eventType: 'RESOURCE_UPDATED', actorEmail: actor.email, platformId, resourceId: existing.id, resourcePath: pathOf(existing.id),
          detail: { source: 'IMPORT', changes: { isAccessControlled: { from: existing.isAccessControlled, to: item.accessControlled } } },
        });
      }
      if (existing.name !== name) {
        updateResource(existing.id, { name }, now);
        paths.delete(existing.id);
        summary.dashboards.renamed.push({ from: existing.name, to: name });
        insertAccessEvent({
          eventType: 'RESOURCE_UPDATED', actorEmail: actor.email, platformId, resourceId: existing.id,
          resourcePath: pathOf(existing.id), detail: { source: 'IMPORT', changes: { name: { from: existing.name, to: name } } },
        });
      } else {
        summary.dashboards.unchanged += 1;
      }
      return;
    }
    const sameName = byName.get(normalizeText(name)) ?? byName.get(normalizeText(key));
    if (sameName) {
      byName.delete(normalizeText(sameName.name));
      updateResource(sameName.id, { externalRef: key }, now);
      resourceByKey.set(key, sameName.id);
      summary.dashboards.linked.push(name);
      insertAccessEvent({
        eventType: 'RESOURCE_UPDATED', actorEmail: actor.email, platformId, resourceId: sameName.id,
        resourcePath: pathOf(sameName.id), detail: { source: 'IMPORT', linkedTo: key },
      });
      return;
    }
    const id = insertResource({
      platformId, parentId: rootId, resourceType, name, url: item.url, description: item.description || note, owner: '',
      isAccessControlled: item.accessControlled ?? true, externalRef: key, sortOrder: 0,
    }, now);
    resourceByKey.set(key, id);
    summary.dashboards.created.push(name);
    insertAccessEvent({
      eventType: 'RESOURCE_CREATED', actorEmail: actor.email, platformId, resourceId: id,
      resourcePath: pathOf(id), detail: { source: 'IMPORT', resourceType },
    });
  });

  // ----------------------------------------------------------------- pessoas
  const byEmail = groupBy(parsed.records, (r) => r.email);
  const members = new Map((parsed.members ?? []).map((m) => [m.email, m]));
  const emails = [...new Set([...members.keys(), ...byEmail.keys()])];
  const people = new Map<string, Person>();
  emails.forEach((email) => {
    const rows = byEmail.get(email) ?? [];
    const member = members.get(email);
    const name = member?.userName ?? rows.find((r) => r.userName)?.userName ?? '';
    const department = member?.department ?? '';
    let person = findPersonByEmail(email);
    if (!person) {
      const id = insertPerson({ email, name, department, notes: '' }, now);
      insertAccessEvent({ eventType: 'PERSON_CREATED', actorEmail: actor.email, personId: id, personEmail: email, detail: { source: 'IMPORT' } });
      summary.people.created += 1;
      person = findPersonByEmail(email)!;
    } else if ((!person.name && name) || (!person.department && department)) {
      updatePerson(person.id, { name: person.name || name, department: person.department || department }, now);
      summary.people.updated += 1;
    } else {
      summary.people.unchanged += 1;
    }
    people.set(email, person);
  });

  // ------------------------------------------------- concessões já ativas
  const active = listGrants({ platformId, status: 'ACTIVE' });
  const activeKey = new Map(active.map((g) => [`${g.resourceId}:${g.personId}`, g]));
  const granted = new Set(activeKey.keys());

  // ---------------------------------------------- acesso à ferramenta (raiz)
  emails.forEach((email) => {
    const rows = byEmail.get(email) ?? [];
    const member = members.get(email);
    const person = people.get(email)!;
    const level = member?.rootLevel ?? rows.find((r) => r.rootLevel)?.rootLevel ?? null;
    if (strategy.rootGrant === 'withLevel' && !level) {
      summary.people.withoutHubAccount += 1;
      return;
    }
    const current = activeKey.get(`${rootId}:${person.id}`);
    if (current) {
      if (level && current.accessLevel !== level) {
        updateGrantDetails(current.id, { accessLevel: level });
        summary.hubAccess.updated += 1;
        insertAccessEvent({
          eventType: 'GRANT_UPDATED', actorEmail: actor.email, platformId, resourceId: rootId, personId: person.id,
          grantId: current.id, resourcePath: pathOf(rootId), personEmail: email,
          detail: { source: 'IMPORT', accessLevel: { from: current.accessLevel || null, to: level } },
        });
      } else {
        summary.hubAccess.unchanged += 1;
      }
      return;
    }
    const grantId = insertGrant({
      resourceId: rootId, personId: person.id, accessLevel: level ?? '', source: 'IMPORT', protocolNumber: null,
      notes: note, grantedBy: actor.email, grantedAt: member?.since ?? earliest(rows) ?? now,
    });
    granted.add(`${rootId}:${person.id}`);
    summary.hubAccess.created += 1;
    insertAccessEvent({
      eventType: 'GRANT_ADDED', actorEmail: actor.email, platformId, resourceId: rootId, personId: person.id, grantId,
      resourcePath: pathOf(rootId), personEmail: email, detail: { source: 'IMPORT', accessLevel: level ?? undefined },
    });
  });

  // ------------------------------------------------------ acessos aos itens
  const inExport = new Set<string>();
  parsed.records.forEach((r) => {
    const resourceId = resourceByKey.get(r.resourceKey)!;
    const person = people.get(r.email)!;
    const key = `${resourceId}:${person.id}`;
    inExport.add(key);
    if (granted.has(key)) {
      summary.grants.unchanged += 1;
      return;
    }
    const grantId = insertGrant({
      resourceId, personId: person.id, accessLevel: '', source: 'IMPORT', protocolNumber: null,
      notes: r.note ? `${note} (${r.note})` : note, grantedBy: actor.email, grantedAt: r.grantedAt ?? now,
    });
    granted.add(key);
    summary.grants.created += 1;
    insertAccessEvent({
      eventType: 'GRANT_ADDED', actorEmail: actor.email, platformId, resourceId, personId: person.id, grantId,
      resourcePath: pathOf(resourceId), personEmail: r.email,
      detail: { source: 'IMPORT', sourceRef: r.sourceRef ?? undefined, sourceGrantedAt: r.grantedAt ?? undefined },
    });
  });

  // --------------- registrado aqui, mas não consta no export (itens da origem)
  // item aberto a todos (sem controle próprio) não tem concessão a conferir
  const importedIds = new Set(listResourceNodes(platformId)
    .filter((n) => n.externalRef && !openKeys.has(n.externalRef))
    .map((n) => n.id));
  const listedPeople = new Set([...people.values()].map((p) => p.id));
  const missing: GrantView[] = active.filter((g) => {
    if (importedIds.has(g.resourceId)) return !inExport.has(`${g.resourceId}:${g.personId}`);
    // raiz: só quando o export lista todos os usuários da ferramenta
    return strategy.rootTracksExport && g.resourceId === rootId && !listedPeople.has(g.personId);
  });
  const toRevoke = options.revokeOnlyImported ? missing.filter((g) => g.source === 'IMPORT') : missing;
  summary.notInExport.total = missing.length;
  summary.notInExport.registeredHere = missing.filter((g) => g.source !== 'IMPORT').length;
  summary.notInExport.sample = missing.slice(0, SAMPLE).map((g) => ({ personEmail: g.personEmail, resourceName: g.resourceName, grantedAt: g.grantedAt }));
  if (options.revokeMissing && toRevoke.length) {
    summary.notInExport.revoked = revokeMany(toRevoke, {
      includeDescendants: false, protocolNumber: null, notes: `Não consta mais no ${strategy.sourceLabel}`,
    }, actor).length;
  }

  const changed = summary.dashboards.created.length + summary.dashboards.linked.length + summary.dashboards.renamed.length
    + summary.people.created + summary.people.updated + summary.hubAccess.created + summary.hubAccess.updated
    + summary.grants.created + summary.notInExport.revoked;
  if (options.quietWhenUnchanged && changed === 0) return summary;

  insertAccessEvent({
    eventType: 'IMPORT_APPLIED', actorEmail: actor.email, platformId, resourceId: rootId, resourcePath: pathOf(rootId),
    detail: {
      source: strategy.eventSource,
      rows: summary.rowsValid,
      dashboardsCreated: summary.dashboards.created.length,
      peopleCreated: summary.people.created,
      grantsCreated: summary.grants.created + summary.hubAccess.created,
      revoked: summary.notInExport.revoked,
    },
  });
  return summary;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  });
  return map;
}

function earliest(rows: AccessImportRecord[]): string | null {
  return rows.map((r) => r.grantedAt).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
}
