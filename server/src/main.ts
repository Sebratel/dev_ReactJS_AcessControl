import { appConfig, hasHubApps, hasHubBi, hasVoalle } from './config/env.config.js';
import { logger } from './common/helpers/logger.helper.js';
import { closeDatabase, initDatabase } from './database/app-database.js';
import { closeVoalle } from './database/voalle.client.js';
import { startIntegrationsScheduler, stopIntegrationsScheduler } from './modules/integrations/integrations.service.js';
import { startProtocolsScheduler, stopProtocolsScheduler } from './modules/protocols/protocols.service.js';
import { createApp } from './app.js';

/**
 * Em produção, subir SEM login é falha de configuração, não opção silenciosa:
 * sem GOOGLE_CLIENT_ID qualquer um que alcance a URL veria e alteraria quem tem
 * acesso a quê. Quem realmente quiser isso declara AUTH_ENABLED=false.
 */
if (appConfig.isProduction && !appConfig.auth.enabled) {
  if (appConfig.auth.requested) {
    logger.error('auth', 'GOOGLE_CLIENT_ID não definido — sem ele não há login. Defina-o (e ADMIN_EMAILS) na stack.');
    process.exit(1);
  }
  logger.warn('auth', 'AUTH_ENABLED=false em produção: a aplicação está ABERTA para quem alcançar a URL.');
}

process.on('unhandledRejection', (reason) => {
  logger.error('processo', `promessa rejeitada sem tratamento: ${reason instanceof Error ? reason.stack : String(reason)}`);
});
process.on('uncaughtException', (err) => {
  logger.error('processo', `exceção não capturada — encerrando: ${err.stack ?? err.message}`);
  process.exit(1);
});

initDatabase();
logger.info('config', `banco da aplicação em ${appConfig.dataPath}`);
logger.info('config', `arquivos .env carregados: ${appConfig.loadedEnvFiles.length ? appConfig.loadedEnvFiles.join(', ') : 'nenhum'}`);
logger.info('config', `Voalle: ${hasVoalle ? 'ok' : 'NÃO configurado'} · login: ${appConfig.auth.enabled ? 'Google' : 'DESLIGADO'} · fila relida a cada ${appConfig.protocols.refreshMs / 1000}s`);

const server = createApp().listen(appConfig.port, appConfig.host, () => {
  logger.info('web', `Controle de Acessos em http://${appConfig.host === '0.0.0.0' ? 'localhost' : appConfig.host}:${appConfig.port}`);
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

startProtocolsScheduler();
startIntegrationsScheduler();
{
  const every = appConfig.integrations.intervalMs ? `a cada ${appConfig.integrations.intervalMs / 60_000} min` : 'só pelo botão';
  logger.info('config', `conexão direta — HUB BI: ${hasHubBi ? 'ok' : 'não configurada'} · HUB APPS: ${hasHubApps ? 'ok' : 'não configurada'} · sincroniza ${every}`);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('web', `${signal} recebido, encerrando…`);
    stopProtocolsScheduler();
    server.close(() => {
      void Promise.all([closeVoalle(), stopIntegrationsScheduler()]).finally(() => {
        closeDatabase();
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
