import { Router } from 'express';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { sendOk } from '../../common/http/api-response.js';
import { appConfig } from '../../config/env.config.js';
import { recordLogin } from '../users/users.service.js';

export const authRouter = Router();

/** Configuração pública do login: o ID do cliente OAuth não é segredo. */
authRouter.get('/config', (_req, res) => {
  sendOk(res, {
    enabled: appConfig.auth.enabled,
    clientId: appConfig.auth.clientId,
    allowedDomain: appConfig.auth.allowedDomain,
  });
});

/** Quem está logado e a permissão (Padrão, Edição ou Admin). */
authRouter.get('/me', requireAuth(), (req, res) => {
  sendOk(res, req.user);
});

/**
 * O front avisa logo depois do clique em "Entrar com Google": é o "último
 * login" da tela de Administração (abrir com a sessão ainda válida não conta).
 */
authRouter.post('/logins', requireAuth(), (req, res) => {
  if (appConfig.auth.enabled) recordLogin(req.user!.email);
  res.status(204).end();
});
