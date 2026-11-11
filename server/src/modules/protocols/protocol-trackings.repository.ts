import { getDb } from '../../database/app-database.js';

/** O que é nosso sobre um protocolo: plataforma corrigida, anotação e "já tratado". */
export interface ProtocolTracking {
  protocolNumber: string;
  platformSlug: string | null;
  note: string;
  isHandled: boolean;
  handledBy: string | null;
  handledAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

function toTracking(row: Record<string, unknown>): ProtocolTracking {
  return {
    protocolNumber: String(row.protocol_number),
    platformSlug: (row.platform_slug as string | null) ?? null,
    note: String(row.note ?? ''),
    isHandled: Number(row.is_handled) === 1,
    handledBy: (row.handled_by as string | null) ?? null,
    handledAt: (row.handled_at as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
}

export function listTrackings(): Map<string, ProtocolTracking> {
  const map = new Map<string, ProtocolTracking>();
  getDb().prepare('SELECT * FROM protocol_trackings').all().forEach((row) => {
    const tracking = toTracking(row);
    map.set(tracking.protocolNumber, tracking);
  });
  return map;
}

export function findTracking(protocolNumber: string): ProtocolTracking | null {
  const row = getDb().prepare('SELECT * FROM protocol_trackings WHERE protocol_number = ?').get(protocolNumber);
  return row ? toTracking(row) : null;
}

export function upsertTracking(tracking: ProtocolTracking): void {
  getDb().prepare(
    `INSERT INTO protocol_trackings (protocol_number, platform_slug, note, is_handled, handled_by, handled_at, updated_by, updated_at)
     VALUES ($protocolNumber, $platformSlug, $note, $isHandled, $handledBy, $handledAt, $updatedBy, $updatedAt)
     ON CONFLICT (protocol_number) DO UPDATE SET
       platform_slug = excluded.platform_slug, note = excluded.note, is_handled = excluded.is_handled,
       handled_by = excluded.handled_by, handled_at = excluded.handled_at,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  ).run({ ...tracking, isHandled: tracking.isHandled ? 1 : 0 });
}
