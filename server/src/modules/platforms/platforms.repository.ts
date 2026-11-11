import { getDb } from '../../database/app-database.js';

export interface Platform {
  id: number;
  slug: string;
  name: string;
  description: string;
  url: string | null;
  sortOrder: number;
  rootResourceId: number;
}

export interface PlatformStats {
  resources: number;
  peopleWithAccess: number;
  activeGrants: number;
  /** pessoas com acesso à raiz (à ferramenta em si) */
  peopleWithRootAccess: number;
}

const SELECT = `
  SELECT pl.*, (
    SELECT r.id FROM resources r
    WHERE r.platform_id = pl.id AND r.parent_id IS NULL AND r.resource_type = 'PLATFORM' AND r.deleted_at IS NULL
    ORDER BY r.id LIMIT 1
  ) AS root_resource_id
  FROM platforms pl`;

function toPlatform(row: Record<string, unknown>): Platform {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ''),
    url: (row.url as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    rootResourceId: Number(row.root_resource_id),
  };
}

export function listPlatforms(): Platform[] {
  return getDb().prepare(`${SELECT} ORDER BY pl.sort_order, pl.name`).all().map(toPlatform);
}

export function findPlatformBySlug(slug: string): Platform | null {
  const row = getDb().prepare(`${SELECT} WHERE pl.slug = ?`).get(slug);
  return row ? toPlatform(row) : null;
}

export function findPlatformById(id: number): Platform | null {
  const row = getDb().prepare(`${SELECT} WHERE pl.id = ?`).get(id);
  return row ? toPlatform(row) : null;
}

export function getPlatformStats(platformId: number, rootResourceId: number): PlatformStats {
  const row = getDb().prepare(
    `SELECT
       (SELECT COUNT(*) FROM resources r WHERE r.platform_id = $platformId AND r.deleted_at IS NULL AND r.parent_id IS NOT NULL) AS resources,
       (SELECT COUNT(DISTINCT g.person_id) FROM grants g JOIN resources r ON r.id = g.resource_id
          WHERE r.platform_id = $platformId AND r.deleted_at IS NULL AND g.status = 'ACTIVE') AS people_with_access,
       (SELECT COUNT(*) FROM grants g JOIN resources r ON r.id = g.resource_id
          WHERE r.platform_id = $platformId AND r.deleted_at IS NULL AND g.status = 'ACTIVE') AS active_grants,
       (SELECT COUNT(*) FROM grants g WHERE g.resource_id = $rootId AND g.status = 'ACTIVE') AS people_with_root_access`,
  ).get({ platformId, rootId: rootResourceId });
  return {
    resources: Number(row?.resources ?? 0),
    peopleWithAccess: Number(row?.people_with_access ?? 0),
    activeGrants: Number(row?.active_grants ?? 0),
    peopleWithRootAccess: Number(row?.people_with_root_access ?? 0),
  };
}

export function updatePlatform(id: number, changes: { url?: string | null; description?: string }, now: string): void {
  const current = findPlatformById(id);
  if (!current) return;
  getDb().prepare('UPDATE platforms SET url = ?, description = ?, updated_at = ? WHERE id = ?').run(
    changes.url === undefined ? current.url : changes.url,
    changes.description ?? current.description,
    now,
    id,
  );
}
