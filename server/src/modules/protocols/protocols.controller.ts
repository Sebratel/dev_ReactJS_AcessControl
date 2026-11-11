import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import { actorOf, shortText } from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { getProtocolDetail, listProtocols, refreshProtocols, updateProtocolTracking } from './protocols.service.js';

export const protocolsRouter = Router();

const ListQuerySchema = z.object({
  state: z.enum(['OPEN', 'CLOSED', 'CANCELED', 'ALL']).default('OPEN'),
  platform: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  requestType: z.enum(['INCLUSION', 'EXCLUSION', 'OTHER']).optional(),
  search: shortText(120).optional(),
  unregistered: z.enum(['true', 'false']).optional(),
});

protocolsRouter.get('/', requireAuth(), async (req, res, next) => {
  try {
    const q = ListQuerySchema.parse(req.query);
    const result = await listProtocols({
      state: q.state,
      platformSlug: q.platform,
      requestType: q.requestType,
      search: q.search || undefined,
      unregisteredOnly: q.unregistered === 'true',
    });
    sendOk(res, result.items, {
      totalItems: result.items.length,
      summary: result.summary,
      fetchedAt: result.fetchedAt,
      lastError: result.lastError,
      refreshMs: result.refreshMs,
    });
  } catch (err) {
    next(err);
  }
});

/** Pede uma releitura imediata do Voalle (a automática já roda a cada PROTOCOLS_REFRESH_MS). */
protocolsRouter.post('/refresh', requireAuth({ role: 'ADMIN' }), writeRateLimit, async (_req, res, next) => {
  try {
    await refreshProtocols();
    res.status(202).json({ success: true, data: { requested: true } });
  } catch (err) {
    next(err);
  }
});

function protocolParam(value: string | undefined): string {
  if (!value || !/^\d{1,20}$/.test(value)) throw new AppException(400, 'VALIDATION_FAILED', 'Número de protocolo inválido.');
  return value;
}

protocolsRouter.get('/:protocolNumber', requireAuth(), async (req, res, next) => {
  try {
    sendOk(res, await getProtocolDetail(protocolParam(req.params.protocolNumber)));
  } catch (err) {
    next(err);
  }
});

const TrackingSchema = z.object({
  platformSlug: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable().optional(),
  note: shortText(2000).optional(),
  isHandled: z.boolean().optional(),
});

protocolsRouter.patch('/:protocolNumber/tracking', requireAuth({ role: 'EDITOR' }), writeRateLimit, async (req, res, next) => {
  try {
    const body = TrackingSchema.parse(req.body);
    sendOk(res, await updateProtocolTracking(protocolParam(req.params.protocolNumber), body, actorOf(req)));
  } catch (err) {
    next(err);
  }
});
