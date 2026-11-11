import { createHash } from 'node:crypto';
import { logger } from '../helpers/logger.helper.js';

/**
 * Validação do access_token do Google — mesmo desenho das outras dashboards:
 * o front obtém o token pelo Google Identity Services e o servidor confere no
 * endpoint `userinfo`. Não existe senha nossa em lugar nenhum.
 *
 * Cache de 5 minutos para não ir ao Google a cada requisição. A chave do cache
 * é o HASH do token, não o token: um dump de memória não entrega credencial.
 */
export interface GoogleUser {
  email: string;
  name: string;
  picture: string | null;
}

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 1000;
const cache = new Map<string, { user: GoogleUser; expiresAt: number }>();

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function verifyGoogleAccessToken(token: string): Promise<GoogleUser | null> {
  const key = hashToken(token);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  let response: Response;
  try {
    response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.warn('auth', `falha de rede ao validar token no Google: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  if (!response.ok) return null;

  const profile = (await response.json().catch(() => ({}))) as {
    email?: string; email_verified?: boolean; name?: string; picture?: string;
  };
  if (!profile.email || profile.email_verified === false) return null;

  const user: GoogleUser = {
    email: profile.email.toLowerCase(),
    name: profile.name ?? profile.email,
    picture: profile.picture ?? null,
  };
  cache.set(key, { user, expiresAt: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
    // ainda cheio: descarta os mais antigos (ordem de inserção do Map)
    while (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  return user;
}
