import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppException } from '../errors/app.exception.js';
import { sendError } from '../http/api-response.js';
import { logger } from '../helpers/logger.helper.js';

/** Rota de API que não existe: 404 no envelope, e não a página da SPA. */
export function apiNotFoundHandler(_req: Request, res: Response): void {
  sendError(res, 404, 'ROUTE_NOT_FOUND', 'Recurso não encontrado.');
}

/**
 * Último middleware. Nunca devolve stack trace nem mensagem interna ao cliente:
 * erro inesperado vira 500 genérico e o detalhe fica só no log do servidor.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppException) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    sendError(res, 400, 'VALIDATION_FAILED', 'Parâmetros inválidos.', details);
    return;
  }
  // corpo JSON malformado (express.json)
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    sendError(res, 400, 'REQUEST_MALFORMED', 'Corpo da requisição inválido.');
    return;
  }
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    sendError(res, 413, 'REQUEST_TOO_LARGE', 'Conteúdo grande demais para esta operação.');
    return;
  }
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  logger.error('api', `${req.method} ${req.path} — ${message}`);
  sendError(res, 500, 'INTERNAL_ERROR', 'Erro interno. Tente novamente em instantes.');
}
