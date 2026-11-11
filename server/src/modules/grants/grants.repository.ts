import { getDb, type SqlParams } from '../../database/app-database.js';

export type GrantStatus = 'ACTIVE' | 'REVOKED';
export type GrantSource = 'MANUAL' | 'PROTOCOL' | 'IMPORT';

export interface GrantView {
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
  resourceType: string;
  resourceParentId: number | null;
  platformId: number;
  platformSlug: string;
  platformName: string;
  personId: number;
  personEmail: string;
  personName: string;
}

const SELECT = `
  SELECT g.*, r.name AS resource_name, r.resource_type, r.parent_id AS resource_parent_id,
    pl.id AS platform_id, pl.slug AS platform_slug, pl.name AS platform_name,
    p.email AS person_email, p.name AS person_name
  FROM grants g
  JOIN resources r ON r.id = g.resource_id
  JOIN platforms pl ON pl.id = r.platform_id
  JOIN people p ON p.id = g.person_id`;

function toGrant(row: Record<string, unknown>): GrantView {
  return {
    id: Number(row.id),
    status: String(row.status) as GrantStatus,
    accessLevel: String(row.access_level ?? ''),
    source: String(row.source) as GrantSource,
    protocolNumber: (row.protocol_number as string | null) ?? null,
    notes: String(row.notes ?? ''),
    grantedBy: String(row.granted_by),
    grantedAt: String(row.granted_at),
    revokedBy: (row.revoked_by as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    revokeProtocolNumber: (row.revoke_protocol_number as string | null) ?? null,
    revokeNotes: String(row.revoke_notes ?? ''),
    resourceId: Number(row.resource_id),
    resourceName: String(row.resource_name),
    resourceType: String(row.resource_type),
    resourceParentId: row.resource_parent_id === null ? null : Number(row.resource_parent_id),
    platformId: Number(row.platform_id),
    platformSlug: String(row.platform_slug),
    platformName: String(row.platform_name),
    personId: Number(row.person_id),
    personEmail: String(row.person_email),
    personName: String(row.person_name ?? ''),
  };
}

export interface GrantFilter {
  resourceId?: number;
  personId?: number;
  /** e-mail da pessoa (sem diferença de maiúsculas) — o formulário de concessão usa */
  email?: string;
  platformId?: number;
  protocolNumber?: string;
  status?: GrantStatus;
}

export function listGrants(filter: GrantFilter): GrantView[] {
  const where = ['r.deleted_at IS NULL'];
  const params: SqlParams = {};
  if (filter.resourceId) {
    where.push('g.resource_id = $resourceId');
    params.resourceId = filter.resourceId;
  }
  if (filter.personId) {
    where.push('g.person_id = $personId');
    params.personId = filter.personId;
  }
  if (filter.email) {
    where.push('p.email = $email COLLATE NOCASE');
    params.email = filter.email.trim().toLowerCase();
  }
  if (filter.platformId) {
    where.push('r.platform_id = $platformId');
    params.platformId = filter.platformId;
  }
  if (filter.protocolNumber) {
    where.push('(g.protocol_number = $protocolNumber OR g.revoke_protocol_number = $protocolNumber)');
    params.protocolNumber = filter.protocolNumber;
  }
  if (filter.status) {
    where.push('g.status = $status');
    params.status = filter.status;
  }
  return getDb().prepare(
    `${SELECT} WHERE ${where.join(' AND ')}
     ORDER BY g.status, p.name COLLATE NOCASE, p.email, r.name COLLATE NOCASE`,
  ).all(params).map(toGrant);
}

export function findGrantById(id: number): GrantView | null {
  const row = getDb().prepare(`${SELECT} WHERE g.id = ?`).get(id);
  return row ? toGrant(row) : null;
}

export function findActiveGrant(resourceId: number, personId: number): GrantView | null {
  const row = getDb().prepare(`${SELECT} WHERE g.resource_id = ? AND g.person_id = ? AND g.status = 'ACTIVE'`).get(resourceId, personId);
  return row ? toGrant(row) : null;
}

export interface NewGrant {
  resourceId: number;
  personId: number;
  accessLevel: string;
  source: GrantSource;
  protocolNumber: string | null;
  notes: string;
  grantedBy: string;
  grantedAt: string;
}

export function insertGrant(input: NewGrant): number {
  const result = getDb().prepare(
    `INSERT INTO grants (resource_id, person_id, status, access_level, source, protocol_number, notes, granted_by, granted_at)
     VALUES ($resourceId, $personId, 'ACTIVE', $accessLevel, $source, $protocolNumber, $notes, $grantedBy, $grantedAt)`,
  ).run(input as unknown as SqlParams);
  return Number(result.lastInsertRowid);
}

export function markGrantRevoked(
  id: number,
  input: { revokedBy: string; revokedAt: string; protocolNumber: string | null; notes: string },
): void {
  getDb().prepare(
    `UPDATE grants SET status = 'REVOKED', revoked_by = ?, revoked_at = ?, revoke_protocol_number = ?, revoke_notes = ?
     WHERE id = ? AND status = 'ACTIVE'`,
  ).run(input.revokedBy, input.revokedAt, input.protocolNumber, input.notes, id);
}

export function updateGrantDetails(id: number, changes: { accessLevel?: string; notes?: string }): void {
  const current = findGrantById(id);
  if (!current) return;
  getDb().prepare('UPDATE grants SET access_level = ?, notes = ? WHERE id = ?').run(
    changes.accessLevel ?? current.accessLevel,
    changes.notes ?? current.notes,
    id,
  );
}

/** Quantas concessões (ativas ou não) cada protocolo tem — para a fila marcar "registrado". */
export function countGrantsByProtocol(): Map<string, { added: number; revoked: number }> {
  const map = new Map<string, { added: number; revoked: number }>();
  const rows = getDb().prepare(
    `SELECT protocol_number AS protocol, COUNT(*) AS n, 'added' AS kind FROM grants WHERE protocol_number IS NOT NULL GROUP BY protocol_number
     UNION ALL
     SELECT revoke_protocol_number, COUNT(*), 'revoked' FROM grants WHERE revoke_protocol_number IS NOT NULL GROUP BY revoke_protocol_number`,
  ).all();
  rows.forEach((row) => {
    const key = String(row.protocol);
    const entry = map.get(key) ?? { added: 0, revoked: 0 };
    if (row.kind === 'added') entry.added += Number(row.n);
    else entry.revoked += Number(row.n);
    map.set(key, entry);
  });
  return map;
}
