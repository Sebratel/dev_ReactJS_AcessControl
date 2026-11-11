import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import {
  actorOf, emailSchema, parseIdParam, protocolNumberSchema, shortText,
} from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { listGrants } from './grants.repository.js';
import { editGrant, grantAccess, grantAccessToMany, revokeGrant } from './grants.service.js';

export const grantsRouter = Router();

const ListQuerySchema = z.object({
  protocolNumber: z.string().regex(/^\d{1,20}$/).optional(),
  personId: z.coerce.number().int().positive().optional(),
  email: emailSchema.optional(),
  resourceId: z.coerce.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
});

grantsRouter.get('/', requireAuth(), (req, res, next) => {
  try {
    const q = ListQuerySchema.parse(req.query);
    sendOk(res, listGrants(q));
  } catch (err) {
    next(err);
  }
});

const CreateGrantSchema = z.object({
  email: emailSchema,
  name: shortText(200).optional(),
  resourceIds: z.array(z.number().int().positive()).min(1, 'Escolha ao menos um recurso').max(200),
  includeAncestors: z.boolean().default(true),
  accessLevel: shortText(100).default(''),
  protocolNumber: protocolNumberSchema,
  notes: shortText(1000).default(''),
});

grantsRouter.post('/', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const body = CreateGrantSchema.parse(req.body);
    const result = grantAccess({ ...body, source: body.protocolNumber ? 'PROTOCOL' : 'MANUAL' }, actorOf(req));
    sendOk(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
});

const UpdateGrantSchema = z.object({
  accessLevel: shortText(100).optional(),
  notes: shortText(1000).optional(),
});

// Várias pessoas de uma vez; aqui o protocolo é obrigatório (é o que justifica a liberação).
const BatchGrantSchema = z.object({
  emails: z.array(emailSchema).min(1, 'Escolha ao menos uma pessoa').max(50, 'No máximo 50 pessoas por vez'),
  resourceIds: z.array(z.number().int().positive()).min(1, 'Escolha ao menos um recurso').max(200),
  includeAncestors: z.boolean().default(true),
  accessLevel: shortText(100).default(''),
  protocolNumber: z.string().trim().regex(/^\d{1,20}$/, 'Informe o número do protocolo'),
  notes: shortText(1000).default(''),
});

grantsRouter.post('/batch', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const { emails, ...body } = BatchGrantSchema.parse(req.body);
    sendOk(res, grantAccessToMany(emails, { ...body, source: 'PROTOCOL' }, actorOf(req)), undefined, 201);
  } catch (err) {
    next(err);
  }
});

grantsRouter.patch('/:id', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    sendOk(res, editGrant(parseIdParam(req), UpdateGrantSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

const RevokeSchema = z.object({
  includeDescendants: z.boolean().default(true),
  protocolNumber: protocolNumberSchema,
  notes: shortText(1000).default(''),
});

grantsRouter.post('/:id/revoke', requireAuth({ role: 'EDITOR' }), writeRateLimit, (req, res, next) => {
  try {
    const revoked = revokeGrant(parseIdParam(req), RevokeSchema.parse(req.body ?? {}), actorOf(req));
    sendOk(res, { revoked });
  } catch (err) {
    next(err);
  }
});
