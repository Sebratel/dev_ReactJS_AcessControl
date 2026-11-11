import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { PaginationSchema, paginationMeta, shortText } from '../../common/http/request.helper.js';
import { listAccessEvents, type AccessEventType } from './access-events.repository.js';

export const accessEventsRouter = Router();

const EVENT_TYPES = [
  'GRANT_ADDED', 'GRANT_REVOKED', 'GRANT_UPDATED', 'IMPORT_APPLIED', 'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'RESOURCE_REMOVED',
  'PERSON_CREATED', 'PERSON_UPDATED', 'PROTOCOL_UPDATED', 'USER_ROLE_CHANGED',
] as const satisfies readonly AccessEventType[];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD');

const QuerySchema = PaginationSchema.extend({
  platform: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  // aceita repetido (?eventType=A&eventType=B) ou separado por vírgula
  eventType: z.union([z.string(), z.array(z.string())]).optional()
    .transform((v) => (v === undefined ? undefined : (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean)))
    .pipe(z.array(z.enum(EVENT_TYPES)).optional()),
  search: shortText(120).optional(),
  personId: z.coerce.number().int().positive().optional(),
  resourceId: z.coerce.number().int().positive().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

/** Datas do filtro são dias civis de Brasília; o log guarda UTC. */
const brtStart = (day: string): string => new Date(`${day}T00:00:00-03:00`).toISOString();

accessEventsRouter.get('/', requireAuth(), (req, res, next) => {
  try {
    const q = QuerySchema.parse(req.query);
    const endExclusive = q.endDate ? new Date(Date.parse(brtStart(q.endDate)) + 86_400_000).toISOString() : undefined;
    const { items, totalItems } = listAccessEvents({
      platformSlug: q.platform,
      eventTypes: q.eventType,
      search: q.search || undefined,
      personId: q.personId,
      resourceId: q.resourceId,
      startDate: q.startDate ? brtStart(q.startDate) : undefined,
      endDate: endExclusive,
      page: q.page,
      pageSize: q.pageSize,
    });
    sendOk(res, items, paginationMeta(q.page, q.pageSize, totalItems));
  } catch (err) {
    next(err);
  }
});
