import type { VoalleProtocolRow } from './voalle-protocols.repository.js';
import {
  parseRequest, pickTargetEmail, subjectFromTitle, toPlatformSlug, toRequestType, type RequestType,
} from './protocol-parser.js';

export type ProtocolState = 'OPEN' | 'CLOSED' | 'CANCELED';

/** Protocolo como a API entrega: datas em ISO 8601 UTC, campos já interpretados. */
export interface Protocol {
  assignmentId: number;
  protocolNumber: string;
  title: string;
  statusLabel: string;
  state: ProtocolState;
  requestType: RequestType;
  platformSlug: string | null;
  category2: string | null;
  category3: string | null;
  category4: string | null;
  category5: string | null;
  solution: string | null;
  team: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  /** e-mail de quem deve receber o acesso (informado ou, se inválido, o do solicitante) */
  targetEmail: string | null;
  informedEmail: string | null;
  isInformedEmailValid: boolean;
  requestedItems: string[];
  descriptionText: string;
  responsibleName: string | null;
  createdAt: string | null;
  deadline: string | null;
  deliveryDeadline: string | null;
  closedAt: string | null;
  gravity: number | null;
  tendency: number | null;
  urgency: number | null;
  linkedProtocols: string[];
  totalDays: number | null;
  isLate: boolean;
  daysLate: number | null;
}

const DAY_MS = 86_400_000;

/**
 * O Voalle grava `timestamp without time zone` na hora de Brasília. Sem horário
 * de verão desde 2019, o fuso é fixo em -03:00.
 */
export function voalleTimestampToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?/.exec(value);
  if (!match) return null;
  const millis = match[3] ? match[3].slice(0, 4).padEnd(4, '0') : '.000';
  const date = new Date(`${match[1]}T${match[2]}${millis}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toState(statusLabel: string | null | undefined): ProtocolState {
  const value = (statusLabel ?? '').trim().toLowerCase();
  if (value.startsWith('encerrad') || value.startsWith('conclu') || value.startsWith('finaliz')) return 'CLOSED';
  if (value.startsWith('cancelad')) return 'CANCELED';
  return 'OPEN';
}

/** Mesma regra da consulta original: dias corridos e atraso contra o "prazo de entrega". */
export function computeTiming(
  state: ProtocolState,
  createdAt: string | null,
  closedAt: string | null,
  deliveryDeadline: string | null,
  now: Date,
): { totalDays: number | null; isLate: boolean; daysLate: number | null } {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  const closed = closedAt ? Date.parse(closedAt) : NaN;
  const due = deliveryDeadline ? Date.parse(deliveryDeadline) : NaN;
  const nowMs = now.getTime();

  const end = state === 'CLOSED' && !Number.isNaN(closed) ? closed : nowMs;
  const totalDays = Number.isNaN(created) ? null : Math.round((end - created) / DAY_MS);

  let lateMs: number | null = null;
  if (!Number.isNaN(due)) {
    if (Number.isNaN(closed) && nowMs > due) lateMs = nowMs - due;
    else if (!Number.isNaN(closed) && closed > due) lateMs = closed - due;
  }
  return { totalDays, isLate: lateMs !== null, daysLate: lateMs === null ? null : Math.round(lateMs / DAY_MS) };
}

export function mapProtocolRow(row: VoalleProtocolRow, now: Date, allowedDomain: string): Protocol {
  const parsed = parseRequest(row.description);
  if (!parsed.requestedItems.length) {
    const subject = subjectFromTitle(row.title, row.requester_name);
    if (subject) parsed.requestedItems.push(subject);
  }
  const target = pickTargetEmail(parsed.emails, row.requester_email, allowedDomain);
  const state = toState(row.status);
  const createdAt = voalleTimestampToIso(row.created_at);
  const closedAt = voalleTimestampToIso(row.closed_at);
  const deliveryDeadline = voalleTimestampToIso(row.delivery_deadline);

  return {
    assignmentId: row.assignment_id,
    protocolNumber: row.protocol_number,
    title: row.title ?? '',
    statusLabel: row.status ?? '—',
    state,
    requestType: toRequestType(row.category_3),
    platformSlug: toPlatformSlug(row.category_2),
    category2: row.category_2,
    category3: row.category_3,
    category4: row.category_4,
    category5: row.category_5,
    solution: row.solution,
    team: row.team,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email?.trim().toLowerCase() || null,
    targetEmail: target.email,
    informedEmail: target.informedEmail,
    isInformedEmailValid: target.isInformedValid,
    requestedItems: parsed.requestedItems,
    descriptionText: parsed.text,
    responsibleName: row.responsible_name,
    createdAt,
    deadline: voalleTimestampToIso(row.deadline),
    deliveryDeadline,
    closedAt,
    gravity: row.gravity,
    tendency: row.tendency,
    urgency: row.urgency,
    linkedProtocols: row.linked_protocols ? row.linked_protocols.split(',').map((p) => p.trim()).filter(Boolean) : [],
    ...computeTiming(state, createdAt, closedAt, deliveryDeadline, now),
  };
}
