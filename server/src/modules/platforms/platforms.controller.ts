import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import { actorOf, optionalUrl, shortText } from '../../common/http/request.helper.js';
import { nowIso } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import { listGrants } from '../grants/grants.repository.js';
import { countOpenByPlatform } from '../protocols/protocols.service.js';
import { listResourceNodes } from '../resources/resources.repository.js';
import {
  findPlatformBySlug, getPlatformStats, listPlatforms, updatePlatform, type Platform,
} from './platforms.repository.js';

export const platformsRouter = Router();

function platformOrThrow(slug: string | undefined): Platform {
  const platform = slug ? findPlatformBySlug(slug) : null;
  if (!platform) throw new AppException(404, 'PLATFORM_NOT_FOUND', 'Plataforma não encontrada.');
  return platform;
}

/** Contagem de protocolos abertos não pode derrubar a tela se o Voalle estiver fora. */
async function openProtocolsSafe(): Promise<Record<string, number>> {
  try {
    return await countOpenByPlatform();
  } catch {
    return {};
  }
}

platformsRouter.get('/', requireAuth(), async (_req, res, next) => {
  try {
    const open = await openProtocolsSafe();
    sendOk(res, listPlatforms().map((p) => ({
      ...p,
      stats: getPlatformStats(p.id, p.rootResourceId),
      openProtocols: open[p.slug] ?? 0,
    })));
  } catch (err) {
    next(err);
  }
});

platformsRouter.get('/:slug', requireAuth(), async (req, res, next) => {
  try {
    const platform = platformOrThrow(req.params.slug);
    const open = await openProtocolsSafe();
    sendOk(res, { ...platform, stats: getPlatformStats(platform.id, platform.rootResourceId), openProtocols: open[platform.slug] ?? 0 });
  } catch (err) {
    next(err);
  }
});

const UpdatePlatformSchema = z.object({
  url: optionalUrl.optional(),
  description: shortText(500).optional(),
});

platformsRouter.patch('/:slug', requireAuth({ role: 'EDITOR' }), (req, res, next) => {
  try {
    const platform = platformOrThrow(req.params.slug);
    const body = UpdatePlatformSchema.parse(req.body);
    updatePlatform(platform.id, body, nowIso());
    insertAccessEvent({
      eventType: 'RESOURCE_UPDATED', actorEmail: actorOf(req).email, platformId: platform.id,
      resourceId: platform.rootResourceId, resourcePath: platform.name, detail: { platform: body },
    });
    sendOk(res, platformOrThrow(platform.slug));
  } catch (err) {
    next(err);
  }
});

/** Árvore da plataforma, achatada (o front monta a hierarquia pelo parentId). */
platformsRouter.get('/:slug/resources', requireAuth(), (req, res, next) => {
  try {
    const platform = platformOrThrow(req.params.slug);
    sendOk(res, listResourceNodes(platform.id));
  } catch (err) {
    next(err);
  }
});

const GrantsQuerySchema = z.object({ status: z.enum(['ACTIVE', 'REVOKED']).optional() });

/** Todas as concessões da plataforma — a visão "quem tem acesso a quê". */
platformsRouter.get('/:slug/grants', requireAuth(), (req, res, next) => {
  try {
    const platform = platformOrThrow(req.params.slug);
    const { status } = GrantsQuerySchema.parse(req.query);
    sendOk(res, listGrants({ platformId: platform.id, ...(status ? { status } : {}) }));
  } catch (err) {
    next(err);
  }
});
