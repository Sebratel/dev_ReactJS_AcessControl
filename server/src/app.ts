import { existsSync } from 'node:fs';
import { join } from 'node:path';
import compression from 'compression';
import express, { type Express } from 'express';
import { appConfig, hasVoalle } from './config/env.config.js';
import { sendOk } from './common/http/api-response.js';
import { logger } from './common/helpers/logger.helper.js';
import { apiNotFoundHandler, errorHandler } from './common/middlewares/error-handler.middleware.js';
import { apiRateLimit, securityHeaders } from './common/middlewares/security.middleware.js';
import { accessEventsRouter } from './modules/access-events/access-events.controller.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { grantsRouter } from './modules/grants/grants.controller.js';
import { importsRouter } from './modules/imports/imports.controller.js';
import { integrationsRouter } from './modules/integrations/integrations.controller.js';
import { peopleRouter } from './modules/people/people.controller.js';
import { platformsRouter } from './modules/platforms/platforms.controller.js';
import { protocolsRouter } from './modules/protocols/protocols.controller.js';
import { resourcesRouter } from './modules/resources/resources.controller.js';
import { usersRouter } from './modules/users/users.controller.js';

/**
 * Monta a aplicação sem abrir porta — `main.ts` sobe o servidor; os testes
 * usam isto direto. Sem CORS: a SPA é servida por este mesmo servidor (em
 * desenvolvimento o Vite faz proxy de /api).
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (appConfig.trustProxy > 0) app.set('trust proxy', appConfig.trustProxy);

  app.use(securityHeaders());
  app.use(compression());
  // corpo JSON pequeno em tudo, menos nas importações (parser próprio, depois da autenticação)
  const smallJson = express.json({ limit: '32kb' });
  app.use((req, res, next) => (req.path.startsWith('/api/v1/imports/') ? next() : smallJson(req, res, next)));

  const api = express.Router();
  // health sem autenticação e sem dado nenhum além de "está de pé" e da versão (o Portainer/CI conferem)
  api.get('/health', (_req, res) => sendOk(res, { status: 'UP', version: appConfig.version, voalleConfigured: hasVoalle }));
  api.use(apiRateLimit);
  api.use('/auth', authRouter);
  api.use('/protocols', protocolsRouter);
  api.use('/platforms', platformsRouter);
  api.use('/resources', resourcesRouter);
  api.use('/people', peopleRouter);
  api.use('/grants', grantsRouter);
  api.use('/access-events', accessEventsRouter);
  api.use('/users', usersRouter);
  api.use('/imports', importsRouter);
  api.use('/integrations', integrationsRouter);
  api.use(apiNotFoundHandler);
  app.use('/api/v1', api);
  app.use('/api', apiNotFoundHandler);

  // SPA (build do Vite copiado para /app/public na imagem Docker)
  if (existsSync(appConfig.publicDir)) {
    app.use(express.static(appConfig.publicDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(appConfig.publicDir, 'index.html'));
    });
  } else if (!appConfig.isTest) {
    logger.warn('web', `pasta ${appConfig.publicDir} não encontrada — servindo só a API`);
  }

  app.use(errorHandler);
  return app;
}
