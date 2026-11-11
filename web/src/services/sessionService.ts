import { getData, httpClient } from './httpClient';
import type { AuthConfig, SessionUser } from './types';

export const fetchAuthConfig = (): Promise<AuthConfig> => getData<AuthConfig>('/auth/config');

export const fetchCurrentUser = (): Promise<SessionUser> => getData<SessionUser>('/auth/me');

/** Avisa o servidor do clique em "Entrar" — é o "último login" da tela de Administração. */
export async function recordLogin(): Promise<void> {
  await httpClient.post('/auth/logins');
}
