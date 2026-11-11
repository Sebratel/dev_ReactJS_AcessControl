import { AppException } from '../../common/errors/app.exception.js';
import { nowIso, transaction } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import { listGrants } from '../grants/grants.repository.js';
import { revokeMany } from '../grants/grants.service.js';
import { diffFields, type Actor } from '../people/people.service.js';
import {
  buildResourcePath, findDescendantIds, findResourceById, insertResource, softDeleteResources, updateResource,
  type Resource, type ResourceChanges, type ResourceType,
} from './resources.repository.js';

export interface CreateResourceInput {
  parentId: number;
  resourceType: Exclude<ResourceType, 'PLATFORM'>;
  name: string;
  url: string | null;
  description: string;
  owner: string;
  isAccessControlled: boolean;
  externalRef?: string | null;
  sortOrder?: number;
}

export function getResourceOrThrow(id: number): Resource {
  const resource = findResourceById(id);
  if (!resource) throw new AppException(404, 'RESOURCE_NOT_FOUND', 'Recurso não encontrado.');
  return resource;
}

export function createResource(input: CreateResourceInput, actor: Actor): Resource {
  const parent = getResourceOrThrow(input.parentId);
  return transaction(() => {
    const id = insertResource({
      platformId: parent.platformId,
      parentId: parent.id,
      resourceType: input.resourceType,
      name: input.name.trim(),
      url: input.url,
      description: input.description,
      owner: input.owner,
      isAccessControlled: input.isAccessControlled,
      externalRef: input.externalRef ?? null,
      sortOrder: input.sortOrder ?? 0,
    }, nowIso());
    insertAccessEvent({
      eventType: 'RESOURCE_CREATED',
      actorEmail: actor.email,
      platformId: parent.platformId,
      resourceId: id,
      resourcePath: buildResourcePath(id),
      detail: { resourceType: input.resourceType, url: input.url ?? undefined },
    });
    return getResourceOrThrow(id);
  });
}

export function editResource(id: number, changes: ResourceChanges, actor: Actor): Resource {
  const current = getResourceOrThrow(id);
  const isRoot = current.resourceType === 'PLATFORM';
  if (isRoot && (changes.parentId !== undefined || changes.resourceType !== undefined)) {
    throw new AppException(422, 'RESOURCE_ROOT_IMMUTABLE', 'A raiz da plataforma não pode ser movida nem mudar de tipo.');
  }
  if (changes.resourceType === 'PLATFORM') {
    throw new AppException(422, 'RESOURCE_TYPE_INVALID', 'Só a raiz de cada plataforma é do tipo Plataforma.');
  }
  if (changes.parentId !== undefined && changes.parentId !== current.parentId) {
    const newParent = getResourceOrThrow(changes.parentId);
    if (newParent.platformId !== current.platformId) {
      throw new AppException(422, 'RESOURCE_PARENT_INVALID', 'O recurso só pode ser movido dentro da mesma plataforma.');
    }
    if (newParent.id === id || findDescendantIds(id).includes(newParent.id)) {
      throw new AppException(422, 'RESOURCE_PARENT_INVALID', 'Um recurso não pode ficar dentro dele mesmo.');
    }
  }
  return transaction(() => {
    updateResource(id, { ...changes, name: changes.name?.trim() }, nowIso());
    const updated = getResourceOrThrow(id);
    const diff = diffFields(current, updated, ['name', 'url', 'description', 'owner', 'isAccessControlled', 'resourceType', 'parentId']);
    if (Object.keys(diff).length) {
      insertAccessEvent({
        eventType: 'RESOURCE_UPDATED',
        actorEmail: actor.email,
        platformId: updated.platformId,
        resourceId: id,
        resourcePath: buildResourcePath(id),
        detail: { changes: diff },
      });
    }
    return updated;
  });
}

/**
 * Remove o recurso e tudo abaixo dele. Com acessos ativos na sub-árvore, só
 * remove se pedirem para revogar junto — cada revogação vai para o log.
 */
export function removeResource(id: number, options: { revokeGrants: boolean }, actor: Actor): { revokedGrants: number } {
  const resource = getResourceOrThrow(id);
  if (resource.resourceType === 'PLATFORM') {
    throw new AppException(422, 'RESOURCE_ROOT_IMMUTABLE', 'A raiz da plataforma não pode ser removida.');
  }
  const subtree = [id, ...findDescendantIds(id)];
  const subtreeSet = new Set(subtree);
  const active = listGrants({ platformId: resource.platformId, status: 'ACTIVE' }).filter((g) => subtreeSet.has(g.resourceId));
  if (active.length && !options.revokeGrants) {
    throw new AppException(
      409,
      'RESOURCE_HAS_ACTIVE_GRANTS',
      `Há ${active.length} acesso(s) ativo(s) neste recurso ou abaixo dele. Confirme a remoção junto com os acessos.`,
      [{ activeGrants: active.length }],
    );
  }
  return transaction(() => {
    const path = buildResourcePath(id);
    revokeMany(active, { includeDescendants: false, protocolNumber: null, notes: `Recurso removido: ${path}` }, actor);
    softDeleteResources(subtree, nowIso());
    insertAccessEvent({
      eventType: 'RESOURCE_REMOVED',
      actorEmail: actor.email,
      platformId: resource.platformId,
      resourceId: id,
      resourcePath: path,
      detail: { removedNodes: subtree.length, revokedGrants: active.length },
    });
    return { revokedGrants: active.length };
  });
}
