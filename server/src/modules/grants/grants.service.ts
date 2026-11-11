import { AppException } from '../../common/errors/app.exception.js';
import { nowIso, transaction } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import { ensurePerson, getPersonOrThrow, type Actor } from '../people/people.service.js';
import {
  buildResourcePath, findAncestorIds, findDescendantIds, findResourceById, type Resource,
} from '../resources/resources.repository.js';
import {
  findActiveGrant, findGrantById, insertGrant, listGrants, markGrantRevoked, updateGrantDetails,
  type GrantSource, type GrantView,
} from './grants.repository.js';

export interface GrantRequest {
  email: string;
  name?: string;
  resourceIds: number[];
  /** concede junto os níveis acima que têm controle próprio (hub -> dashboard -> aba) */
  includeAncestors: boolean;
  accessLevel: string;
  protocolNumber: string | null;
  notes: string;
  source: GrantSource;
}

export interface GrantResult {
  personId: number;
  created: GrantView[];
  alreadyActive: GrantView[];
}

/**
 * Concede acesso a uma pessoa em um ou mais recursos. Numa árvore, ter acesso
 * à aba sem ter ao dashboard (ou ao hub) não serve para nada — por isso, por
 * padrão, os níveis acima com controle próprio entram junto.
 */
export function grantAccess(request: GrantRequest, actor: Actor): GrantResult {
  const resources = request.resourceIds.map((id) => {
    const resource = findResourceById(id);
    if (!resource) throw new AppException(404, 'RESOURCE_NOT_FOUND', `Recurso ${id} não encontrado.`);
    return resource;
  });

  return transaction(() => {
    const person = ensurePerson(request.email, request.name, actor);
    const targets = new Map<number, { resource: Resource; depth: number }>();
    resources.forEach((resource) => {
      const ancestors = findAncestorIds(resource.id);
      targets.set(resource.id, { resource, depth: ancestors.length });
      if (!request.includeAncestors) return;
      ancestors.forEach((ancestorId, index) => {
        if (targets.has(ancestorId)) return;
        const ancestor = findResourceById(ancestorId);
        if (ancestor?.isAccessControlled) targets.set(ancestorId, { resource: ancestor, depth: ancestors.length - index - 1 });
      });
    });

    const created: GrantView[] = [];
    const alreadyActive: GrantView[] = [];
    const now = nowIso();
    [...targets.values()]
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ resource }) => {
        const existing = findActiveGrant(resource.id, person.id);
        if (existing) {
          alreadyActive.push(existing);
          return;
        }
        const grantId = insertGrant({
          resourceId: resource.id,
          personId: person.id,
          accessLevel: request.accessLevel,
          source: request.source,
          protocolNumber: request.protocolNumber,
          notes: request.notes,
          grantedBy: actor.email,
          grantedAt: now,
        });
        insertAccessEvent({
          eventType: 'GRANT_ADDED',
          actorEmail: actor.email,
          platformId: resource.platformId,
          resourceId: resource.id,
          personId: person.id,
          grantId,
          resourcePath: buildResourcePath(resource.id),
          personEmail: person.email,
          protocolNumber: request.protocolNumber,
          detail: { accessLevel: request.accessLevel || undefined, source: request.source, notes: request.notes || undefined },
        });
        const grant = findGrantById(grantId);
        if (grant) created.push(grant);
      });
    return { personId: person.id, created, alreadyActive };
  });
}

export interface BatchGrantResult {
  peopleCount: number;
  created: GrantView[];
  alreadyActive: GrantView[];
}

/**
 * A mesma concessão para várias pessoas (tela da plataforma: escolhe quem
 * recebe numa lista). Tudo ou nada — se um e-mail falhar, nada é gravado.
 */
export function grantAccessToMany(
  emails: string[],
  request: Omit<GrantRequest, 'email' | 'name'>,
  actor: Actor,
): BatchGrantResult {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  return transaction(() => {
    const results = unique.map((email) => grantAccess({ ...request, email }, actor));
    return {
      peopleCount: results.length,
      created: results.flatMap((r) => r.created),
      alreadyActive: results.flatMap((r) => r.alreadyActive),
    };
  });
}

export interface RevokeRequest {
  /** remove junto os acessos da mesma pessoa nos níveis abaixo (abas de um dashboard removido) */
  includeDescendants: boolean;
  protocolNumber: string | null;
  notes: string;
}

export function revokeGrant(grantId: number, request: RevokeRequest, actor: Actor): GrantView[] {
  const grant = findGrantById(grantId);
  if (!grant) throw new AppException(404, 'GRANT_NOT_FOUND', 'Concessão de acesso não encontrada.');
  if (grant.status !== 'ACTIVE') throw new AppException(409, 'GRANT_ALREADY_REVOKED', 'Esse acesso já foi removido.');

  return transaction(() => {
    const targets: GrantView[] = [grant];
    if (request.includeDescendants) {
      const descendants = new Set(findDescendantIds(grant.resourceId));
      listGrants({ personId: grant.personId, status: 'ACTIVE' })
        .filter((g) => descendants.has(g.resourceId))
        .forEach((g) => targets.push(g));
    }
    return revokeMany(targets, request, actor);
  });
}

/** Desligamento / troca de área: tira todos os acessos da pessoa (opcionalmente de uma plataforma só). */
export function revokeAllForPerson(personId: number, platformId: number | null, request: Omit<RevokeRequest, 'includeDescendants'>, actor: Actor): GrantView[] {
  getPersonOrThrow(personId);
  return transaction(() => {
    const targets = listGrants({ personId, status: 'ACTIVE', ...(platformId ? { platformId } : {}) });
    return revokeMany(targets, { ...request, includeDescendants: false }, actor);
  });
}

/** Remove uma lista de concessões ativas, registrando cada uma no log. Usar dentro de `transaction`. */
export function revokeMany(targets: GrantView[], request: RevokeRequest, actor: Actor): GrantView[] {
  const now = nowIso();
  const revoked: GrantView[] = [];
  targets.forEach((target) => {
    markGrantRevoked(target.id, { revokedBy: actor.email, revokedAt: now, protocolNumber: request.protocolNumber, notes: request.notes });
    insertAccessEvent({
      eventType: 'GRANT_REVOKED',
      actorEmail: actor.email,
      platformId: target.platformId,
      resourceId: target.resourceId,
      personId: target.personId,
      grantId: target.id,
      resourcePath: buildResourcePath(target.resourceId),
      personEmail: target.personEmail,
      protocolNumber: request.protocolNumber,
      detail: { notes: request.notes || undefined },
    });
    const updated = findGrantById(target.id);
    if (updated) revoked.push(updated);
  });
  return revoked;
}

export function editGrant(grantId: number, changes: { accessLevel?: string; notes?: string }): GrantView {
  const grant = findGrantById(grantId);
  if (!grant) throw new AppException(404, 'GRANT_NOT_FOUND', 'Concessão de acesso não encontrada.');
  updateGrantDetails(grantId, changes);
  return findGrantById(grantId) ?? grant;
}
