import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { actorOf, optionalUrl, parseIdParam, shortText } from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { listGrants } from '../grants/grants.repository.js';
import { RESOURCE_TYPES } from './resources.repository.js';
import { createResource, editResource, getResourceOrThrow, removeResource } from './resources.service.js';

export const resourcesRouter = Router();

const ChildType = z.enum(RESOURCE_TYPES.filter((t) => t !== 'PLATFORM') as [string, ...string[]]);

const CreateResourceSchema = z.object({
  parentId: z.number().int().positive(),
  resourceType: ChildType,
  name: shortText(200).min(1, 'Informe o nome'),
  url: optionalUrl.default(null),
  description: shortText(1000).default(''),
  owner: shortText(200).default(''),
  isAccessControlled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

resourcesRouter.post('/', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const body = CreateResourceSchema.parse(req.body);
    const created = createResource({ ...body, resourceType: body.resourceType as never }, actorOf(req));
    res.setHeader('Location', `/api/v1/resources/${created.id}`);
    sendOk(res, created, undefined, 201);
  } catch (err) {
    next(err);
  }
});

const UpdateResourceSchema = z.object({
  parentId: z.number().int().positive().optional(),
  resourceType: ChildType.optional(),
  name: shortText(200).min(1, 'Informe o nome').optional(),
  url: optionalUrl.optional(),
  description: shortText(1000).optional(),
  owner: shortText(200).optional(),
  isAccessControlled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

resourcesRouter.get('/:id', requireAuth(), (req, res, next) => {
  try {
    sendOk(res, getResourceOrThrow(parseIdParam(req)));
  } catch (err) {
    next(err);
  }
});

resourcesRouter.patch('/:id', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const body = UpdateResourceSchema.parse(req.body);
    sendOk(res, editResource(parseIdParam(req), { ...body, resourceType: body.resourceType as never }, actorOf(req)));
  } catch (err) {
    next(err);
  }
});

const DeleteQuerySchema = z.object({ revokeGrants: z.enum(['true', 'false']).default('false') });

resourcesRouter.delete('/:id', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const { revokeGrants } = DeleteQuerySchema.parse(req.query);
    removeResource(parseIdParam(req), { revokeGrants: revokeGrants === 'true' }, actorOf(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const GrantsQuerySchema = z.object({ status: z.enum(['ACTIVE', 'REVOKED']).optional() });

resourcesRouter.get('/:id/grants', requireAuth(), (req, res, next) => {
  try {
    const id = parseIdParam(req);
    getResourceOrThrow(id);
    const { status } = GrantsQuerySchema.parse(req.query);
    sendOk(res, listGrants({ resourceId: id, ...(status ? { status } : {}) }));
  } catch (err) {
    next(err);
  }
});
