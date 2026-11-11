import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { sendError } from '../http/api-response.js';

/**
 * Cabeçalhos de segurança da SPA e da API.
 *
 * A CSP libera só o que o login com Google precisa (script e iframe do GIS,
 * foto do perfil). `same-origin-allow-popups` no COOP é obrigatório: o fluxo
 * de token do Google abre um popup e conversa com a janela de origem — com o
 * `same-origin` padrão do helmet o login simplesmente não volta.
 */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
        'img-src': ["'self'", 'data:', 'https://*.googleusercontent.com'],
        'connect-src': ["'self'", 'https://accounts.google.com/gsi/'],
        'frame-src': ['https://accounts.google.com/gsi/'],
        'font-src': ["'self'", 'data:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

/**
 * Teto geral por IP. Um painel aberto faz poucas chamadas por minuto; um
 * recorte novo custa até ~0,5 s de CPU sobre 700 mil linhas, então o teto
 * também impede que um script de filtros aleatórios ocupe o processo.
 */
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Muitas requisições. Aguarde um instante.'),
});

/** Exportação CSV percorre a tabela inteira: teto bem menor. */
export const exportRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Muitas exportações seguidas. Aguarde um minuto.'),
});

/** Gravação no cadastro: uma pessoa editando faz poucas por minuto; script em loop esbarra aqui. */
export const writeRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Muitas alterações seguidas. Aguarde um minuto.'),
});
