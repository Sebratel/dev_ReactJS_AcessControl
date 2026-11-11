import type { Request } from 'express';
import { z } from 'zod';
import { AppException } from '../errors/app.exception.js';

/** Id numérico do caminho (`/recurso/:id`) — 400 se não for um inteiro positivo. */
export function parseIdParam(req: Request, name = 'id'): number {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new AppException(400, 'VALIDATION_FAILED', `Parâmetro ${name} inválido.`);
  }
  return value;
}

/** Quem está agindo — o middleware de autenticação garante que existe. */
export function actorOf(req: Request): { email: string } {
  if (!req.user) throw new AppException(401, 'AUTH_TOKEN_MISSING', 'Faça login para continuar.');
  return { email: req.user.email };
}

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export function paginationMeta(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}

/** Texto curto de formulário: sem espaços nas pontas e com teto de tamanho. */
export const shortText = (max: number) => z.string().trim().max(max);

/** URL opcional — só http(s), para nada de `javascript:` virar link na tela. */
export const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), 'Informe um link começando com http:// ou https://');

export const emailSchema = z.string().trim().toLowerCase().max(254).email('E-mail inválido');

export const protocolNumberSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{1,20}$/.test(v), 'Número de protocolo inválido')
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));
