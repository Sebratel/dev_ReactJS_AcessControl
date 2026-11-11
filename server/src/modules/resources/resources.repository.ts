import { getDb, type SqlParams } from '../../database/app-database.js';

export const RESOURCE_TYPES = ['PLATFORM', 'DASHBOARD', 'APPLICATION', 'TAB', 'FEATURE', 'ROLE', 'DATASET', 'FOLDER'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface Resource {
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
}

/** Nó da árvore como a tela usa: o recurso + quantas pessoas têm acesso a ele. */
export interface ResourceNode extends Resource {
  activeGrants: number;
}

function toResource(row: Record<string, unknown>): Resource {
  return {
    id: Number(row.id),
    platformId: Number(row.platform_id),
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    resourceType: String(row.resource_type) as ResourceType,
    name: String(row.name),
    url: (row.url as string | null) ?? null,
    description: String(row.description ?? ''),
    owner: String(row.owner ?? ''),
    isAccessControlled: Number(row.is_access_controlled) === 1,
    externalRef: (row.external_ref as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listResourceNodes(platformId: number): ResourceNode[] {
  return getDb().prepare(
    `SELECT r.*, (
       SELECT COUNT(*) FROM grants g WHERE g.resource_id = r.id AND g.status = 'ACTIVE'
     ) AS active_grants
     FROM resources r
     WHERE r.platform_id = ? AND r.deleted_at IS NULL
     ORDER BY r.sort_order, r.name COLLATE NOCASE`,
  ).all(platformId).map((row) => ({ ...toResource(row), activeGrants: Number(row.active_grants ?? 0) }));
}

export function findResourceById(id: number): Resource | null {
  const row = getDb().prepare('SELECT * FROM resources WHERE id = ? AND deleted_at IS NULL').get(id);
  return row ? toResource(row) : null;
}

export function findResourceByExternalRef(platformId: number, externalRef: string): Resource | null {
  const row = getDb().prepare(
    'SELECT * FROM resources WHERE platform_id = ? AND external_ref = ? AND deleted_at IS NULL',
  ).get(platformId, externalRef);
  return row ? toResource(row) : null;
}

/** Ids dos ancestrais, do pai até a raiz. */
export function findAncestorIds(id: number): number[] {
  return getDb().prepare(
    `WITH RECURSIVE up(id, parent_id, depth) AS (
       SELECT id, parent_id, 0 FROM resources WHERE id = ?
       UNION ALL
       SELECT r.id, r.parent_id, up.depth + 1 FROM resources r JOIN up ON r.id = up.parent_id
     )
     SELECT id FROM up WHERE depth > 0 ORDER BY depth`,
  ).all(id).map((row) => Number(row.id));
}

/** Ids dos descendentes vivos (sem o próprio). */
export function findDescendantIds(id: number): number[] {
  return getDb().prepare(
    `WITH RECURSIVE down(id) AS (
       SELECT id FROM resources WHERE parent_id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT r.id FROM resources r JOIN down ON r.parent_id = down.id WHERE r.deleted_at IS NULL
     )
     SELECT id FROM down`,
  ).all(id).map((row) => Number(row.id));
}

/** "HUB BI › Dashboard X › Aba Y" — o caminho legível que vai para o log. */
export function buildResourcePath(id: number): string {
  const rows = getDb().prepare(
    `WITH RECURSIVE up(id, parent_id, name, platform_id, depth) AS (
       SELECT id, parent_id, name, platform_id, 0 FROM resources WHERE id = ?
       UNION ALL
       SELECT r.id, r.parent_id, r.name, r.platform_id, up.depth + 1 FROM resources r JOIN up ON r.id = up.parent_id
     )
     SELECT up.name, up.parent_id, pl.name AS platform_name FROM up JOIN platforms pl ON pl.id = up.platform_id ORDER BY depth DESC`,
  ).all(id);
  if (!rows.length) return '';
  // a raiz se chama "Acesso ao X": no caminho, aparece o nome da plataforma
  const names = rows.map((row, i) => (i === 0 && row.parent_id === null ? String(row.platform_name) : String(row.name)));
  return names.join(' › ');
}

export interface ResourceInput {
  platformId: number;
  parentId: number;
  resourceType: ResourceType;
  name: string;
  url: string | null;
  description: string;
  owner: string;
  isAccessControlled: boolean;
  externalRef: string | null;
  sortOrder: number;
}

export function insertResource(input: ResourceInput, now: string): number {
  const result = getDb().prepare(
    `INSERT INTO resources
       (platform_id, parent_id, resource_type, name, url, description, owner, is_access_controlled, external_ref, sort_order, created_at, updated_at)
     VALUES ($platformId, $parentId, $resourceType, $name, $url, $description, $owner, $isAccessControlled, $externalRef, $sortOrder, $now, $now)`,
  ).run({
    ...input,
    isAccessControlled: input.isAccessControlled ? 1 : 0,
    now,
  } as unknown as SqlParams);
  return Number(result.lastInsertRowid);
}

export type ResourceChanges = Partial<Omit<ResourceInput, 'platformId'>>;

const COLUMN: Record<keyof ResourceChanges, string> = {
  parentId: 'parent_id',
  resourceType: 'resource_type',
  name: 'name',
  url: 'url',
  description: 'description',
  owner: 'owner',
  isAccessControlled: 'is_access_controlled',
  externalRef: 'external_ref',
  sortOrder: 'sort_order',
};

export function updateResource(id: number, changes: ResourceChanges, now: string): void {
  const sets: string[] = [];
  const params: SqlParams = { id, now };
  (Object.keys(changes) as (keyof ResourceChanges)[]).forEach((key) => {
    const value = changes[key];
    // só colunas conhecidas entram no SQL — o nome da coluna nunca vem do cliente
    if (value === undefined || !Object.hasOwn(COLUMN, key)) return;
    sets.push(`${COLUMN[key]} = $${key}`);
    params[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  });
  if (!sets.length) return;
  getDb().prepare(`UPDATE resources SET ${sets.join(', ')}, updated_at = $now WHERE id = $id`).run(params);
}

export function softDeleteResources(ids: number[], now: string): void {
  const stmt = getDb().prepare('UPDATE resources SET deleted_at = ?, updated_at = ? WHERE id = ?');
  ids.forEach((id) => stmt.run(now, now, id));
}
