import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import {
  actorOf, emailSchema, PaginationSchema, paginationMeta, parseIdParam, protocolNumberSchema, shortText,
} from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { revokeAllForPerson } from '../grants/grants.service.js';
import { findPlatformBySlug } from '../platforms/platforms.repository.js';
import { listPeople, listPeopleEmails } from './people.repository.js';
import { createPerson, editPerson, getPersonAccess } from './people.service.js';

export const peopleRouter = Router();

const ListQuerySchema = PaginationSchema.extend({
  search: shortText(120).optional(),
  platform: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  withAccess: z.enum(['true', 'false']).optional(),
  initial: z.string().regex(/^[a-zA-Z#]$/, 'Uma letra (A–Z) ou #').optional(),
});

peopleRouter.get('/', requireAuth(), (req, res, next) => {
  try {
    const q = ListQuerySchema.parse(req.query);
    const { items, totalItems, initials } = listPeople({
      search: q.search || undefined,
      platformSlug: q.platform,
      withAccessOnly: q.withAccess === 'true',
      initial: q.initial,
      page: q.page,
      pageSize: q.pageSize,
    });
    sendOk(res, items, { ...paginationMeta(q.page, q.pageSize, totalItems), initials });
  } catch (err) {
    next(err);
  }
});

// antes de '/:id' para não ser lida como id
peopleRouter.get('/emails', requireAuth(), (_req, res, next) => {
  try {
    sendOk(res, listPeopleEmails());
  } catch (err) {
    next(err);
  }
});

peopleRouter.get('/:id', requireAuth(), (req, res, next) => {
  try {
    sendOk(res, getPersonAccess(parseIdParam(req)));
  } catch (err) {
    next(err);
  }
});

const CreatePersonSchema = z.object({
  email: emailSchema,
  name: shortText(200).default(''),
  department: shortText(200).default(''),
  notes: shortText(1000).default(''),
});

peopleRouter.post('/', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const person = createPerson(CreatePersonSchema.parse(req.body), actorOf(req));
    res.setHeader('Location', `/api/v1/people/${person.id}`);
    sendOk(res, person, undefined, 201);
  } catch (err) {
    next(err);
  }
});

const UpdatePersonSchema = z.object({
  name: shortText(200).optional(),
  department: shortText(200).optional(),
  isActive: z.boolean().optional(),
  notes: shortText(1000).optional(),
});

peopleRouter.patch('/:id', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    sendOk(res, editPerson(parseIdParam(req), UpdatePersonSchema.parse(req.body), actorOf(req)));
  } catch (err) {
    next(err);
  }
});

const RevokeAllSchema = z.object({
  platformSlug: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable().optional(),
  protocolNumber: protocolNumberSchema,
  notes: shortText(1000).default(''),
});

/** Desligamento / troca de área: remove todos os acessos (de uma plataforma ou de todas). */
peopleRouter.post('/:id/revoke-all', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const body = RevokeAllSchema.parse(req.body);
    let platformId: number | null = null;
    if (body.platformSlug) {
      const platform = findPlatformBySlug(body.platformSlug);
      if (!platform) throw new AppException(404, 'PLATFORM_NOT_FOUND', 'Plataforma não encontrada.');
      platformId = platform.id;
    }
    const revoked = revokeAllForPerson(parseIdParam(req), platformId, { protocolNumber: body.protocolNumber, notes: body.notes }, actorOf(req));
    sendOk(res, { revoked });
  } catch (err) {
    next(err);
  }
});
