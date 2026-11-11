import type { NextFunction, Request, Response } from 'express';
import { appConfig } from '../../config/env.config.js';
import type { UserRole } from '../../modules/users/users.repository.js';
import { touchUser } from '../../modules/users/users.service.js';
import { AppException } from '../errors/app.exception.js';
import { verifyGoogleAccessToken } from './google-token.verifier.js';

/** Ordem dos papéis: Padrão < Edição < Admin. */
const RANK: Record<UserRole, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2 };

export interface AuthenticatedUser {
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

const FORBIDDEN_MESSAGE: Record<UserRole, string> = {
  ADMIN: 'Ação restrita a administradores.',
  EDITOR: 'Você não tem permissão para alterar acessos. Peça a permissão de Edição a um administrador.',
  VIEWER: 'Acesso negado.',
};

/**
 * Autenticação de toda rota de dados; com `role`, também a autorização —
 * mesmo desenho da logisticDashboard: login com Google, só o domínio permitido,
 * e o papel vem do cadastro de usuários (quem entra pela primeira vez é
 * "Padrão"; um admin promove na tela de Administração). Cada requisição
 * atualiza o "visto por último".
 *
 * Com o login desligado (AUTH_ENABLED=false ou sem GOOGLE_CLIENT_ID, só para
 * rodar local) entra um usuário fictício, que não vai para o cadastro. Em
 * produção o servidor se recusa a subir assim — ver `main.ts`.
 */
export function requireAuth(options: { role?: UserRole } = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!appConfig.auth.enabled) {
        req.user = { email: 'dev@local', name: 'Modo sem autenticação', picture: null, role: 'ADMIN' };
        next();
        return;
      }

      const match = /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(req.headers.authorization ?? '');
      if (!match?.[1]) throw new AppException(401, 'AUTH_TOKEN_MISSING', 'Faça login para continuar.');

      const googleUser = await verifyGoogleAccessToken(match[1]);
      if (!googleUser) throw new AppException(401, 'AUTH_TOKEN_EXPIRED', 'Sessão expirada. Entre novamente.');

      const domain = appConfig.auth.allowedDomain;
      if (domain && !googleUser.email.endsWith(`@${domain}`)) {
        throw new AppException(403, 'AUTH_DOMAIN_NOT_ALLOWED', `Acesso restrito a contas @${domain}.`);
      }

      req.user = { ...googleUser, role: touchUser(googleUser) };
      if (options.role && RANK[req.user.role] < RANK[options.role]) {
        throw new AppException(403, 'AUTH_FORBIDDEN', FORBIDDEN_MESSAGE[options.role]);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
