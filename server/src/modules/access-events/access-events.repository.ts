import { getDb, nowIso, type SqlParams } from '../../database/app-database.js';

/**
 * Log de adições e remoções. Só INSERT e SELECT — nenhuma rota altera ou
 * apaga um evento.
 */
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

export interface NewAccessEvent {
  eventType: AccessEventType;
  actorEmail: string;
  platformId?: number | null;
  resourceId?: number | null;
  personId?: number | null;
  grantId?: number | null;
  resourcePath?: string;
  personEmail?: string;
  protocolNumber?: string | null;
  detail?: Record<string, unknown>;
}

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

export function insertAccessEvent(event: NewAccessEvent): void {
  getDb().prepare(
    `INSERT INTO access_events
       (event_type, platform_id, resource_id, person_id, grant_id, resource_path, person_email, protocol_number, actor_email, detail, created_at)
     VALUES ($eventType, $platformId, $resourceId, $personId, $grantId, $resourcePath, $personEmail, $protocolNumber, $actorEmail, $detail, $createdAt)`,
  ).run({
    eventType: event.eventType,
    platformId: event.platformId ?? null,
    resourceId: event.resourceId ?? null,
    personId: event.personId ?? null,
    grantId: event.grantId ?? null,
    resourcePath: event.resourcePath ?? '',
    personEmail: event.personEmail ?? '',
    protocolNumber: event.protocolNumber ?? null,
    actorEmail: event.actorEmail,
    detail: JSON.stringify(event.detail ?? {}),
    createdAt: nowIso(),
  });
}

export interface AccessEventFilter {
  platformSlug?: string;
  eventTypes?: AccessEventType[];
  search?: string;
  personId?: number;
  resourceId?: number;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export function listAccessEvents(filter: AccessEventFilter): { items: AccessEvent[]; totalItems: number } {
  const where: string[] = [];
  const params: SqlParams = {};
  if (filter.platformSlug) {
    where.push('pl.slug = $platformSlug');
    params.platformSlug = filter.platformSlug;
  }
  if (filter.eventTypes?.length) {
    const keys = filter.eventTypes.map((type, i) => {
      params[`type${i}`] = type;
      return `$type${i}`;
    });
    where.push(`e.event_type IN (${keys.join(', ')})`);
  }
  if (filter.personId) {
    where.push('e.person_id = $personId');
    params.personId = filter.personId;
  }
  if (filter.resourceId) {
    where.push('e.resource_id = $resourceId');
    params.resourceId = filter.resourceId;
  }
  if (filter.search) {
    where.push(`(e.person_email LIKE $search ESCAPE '\\' OR e.resource_path LIKE $search ESCAPE '\\'
      OR IFNULL(e.protocol_number, '') LIKE $search ESCAPE '\\' OR e.actor_email LIKE $search ESCAPE '\\'
      OR IFNULL(p.name, '') LIKE $search ESCAPE '\\')`);
    params.search = `%${escapeLike(filter.search)}%`;
  }
  if (filter.startDate) {
    where.push('e.created_at >= $startDate');
    params.startDate = filter.startDate;
  }
  if (filter.endDate) {
    where.push('e.created_at < $endDate');
    params.endDate = filter.endDate;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM access_events e
    LEFT JOIN platforms pl ON pl.id = e.platform_id
    LEFT JOIN people p ON p.id = e.person_id`;

  const db = getDb();
  const total = Number(db.prepare(`SELECT COUNT(*) AS n ${from} ${whereSql}`).get(params)?.n ?? 0);
  const rows = db.prepare(
    `SELECT e.*, pl.slug AS platform_slug, pl.name AS platform_name, p.name AS person_name
     ${from} ${whereSql}
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $limit OFFSET $offset`,
  ).all({ ...params, limit: filter.pageSize, offset: (filter.page - 1) * filter.pageSize });

  return {
    totalItems: total,
    items: rows.map((row) => ({
      id: Number(row.id),
      eventType: String(row.event_type) as AccessEventType,
      platformId: row.platform_id === null ? null : Number(row.platform_id),
      platformSlug: (row.platform_slug as string | null) ?? null,
      platformName: (row.platform_name as string | null) ?? null,
      resourceId: row.resource_id === null ? null : Number(row.resource_id),
      personId: row.person_id === null ? null : Number(row.person_id),
      grantId: row.grant_id === null ? null : Number(row.grant_id),
      resourcePath: String(row.resource_path ?? ''),
      personEmail: String(row.person_email ?? ''),
      personName: (row.person_name as string | null) ?? null,
      protocolNumber: (row.protocol_number as string | null) ?? null,
      actorEmail: String(row.actor_email),
      detail: safeJson(String(row.detail ?? '{}')),
      createdAt: String(row.created_at),
    })),
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
