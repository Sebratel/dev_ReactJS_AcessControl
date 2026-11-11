import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { actorOf } from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import { USER_ROLES } from './users.repository.js';
import { listUsers, ONLINE_WINDOW_MS, setUserRole } from './users.service.js';

/** Usuários e permissões — só administradores (tela de Administração). */
export const usersRouter = Router();

usersRouter.get('/', requireAuth({ role: 'ADMIN' }), (_req, res) => {
  const users = listUsers();
  res.setHeader('Cache-Control', 'no-store');
  sendOk(res, users, { total: users.length, online: users.filter((u) => u.online).length, onlineWindowMs: ONLINE_WINDOW_MS });
});

const EmailParamSchema = z.string().trim().toLowerCase().max(254).email('E-mail inválido.');
const RolePatchSchema = z.strictObject({ role: z.enum(USER_ROLES, { error: 'Escolha Padrão, Edição ou Admin.' }) });

usersRouter.patch('/:email', requireAuth({ role: 'ADMIN' }), writeRateLimit, (req, res, next) => {
  try {
    const email = EmailParamSchema.parse(req.params.email);
    const { role } = RolePatchSchema.parse(req.body);
    sendOk(res, setUserRole(email, role, actorOf(req)));
  } catch (err) {
    next(err);
  }
});
