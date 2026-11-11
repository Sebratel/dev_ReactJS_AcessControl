import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { actorOf } from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { listIntegrationStatus, syncIntegration } from './integrations.service.js';

export const integrationsRouter = Router();

/** Situação da conexão direta de cada hub (configurada? última sincronização? erro?). */
integrationsRouter.get('/', requireAuth(), (_req, res, next) => {
  try {
    sendOk(res, listIntegrationStatus());
  } catch (err) {
    next(err);
  }
});

const SyncSchema = z.object({ dryRun: z.boolean().default(false) });
const SlugSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

/** "Sincronizar agora" — Edição ou Admin. Com `dryRun`, só a prévia. */
integrationsRouter.post('/:slug/sync', requireAuth({ role: 'EDITOR' }), writeRateLimit, async (req, res, next) => {
  try {
    const slug = SlugSchema.parse(req.params.slug);
    const body = SyncSchema.parse(req.body ?? {});
    sendOk(res, await syncIntegration(slug, actorOf(req), body));
  } catch (err) {
    next(err);
  }
});
