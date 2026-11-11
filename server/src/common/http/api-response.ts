import type { Response } from 'express';

/** Envelope padrão de sucesso: `{ success, data, meta? }`. */
export function sendOk<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200): void {
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

/** Envelope padrão de erro: `{ success: false, error: { code, message, details } }`. */
export function sendError(res: Response, status: number, code: string, message: string, details: unknown[] = []): void {
  res.status(status).json({ success: false, error: { code, message, details } });
}
