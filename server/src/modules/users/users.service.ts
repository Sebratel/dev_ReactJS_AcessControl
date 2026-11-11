import { AppException } from '../../common/errors/app.exception.js';
import { logger } from '../../common/helpers/logger.helper.js';
import { appConfig } from '../../config/env.config.js';
import { nowIso, transaction } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import {
  countAdmins, findAppUser, insertAppUser, listAppUsers, ROLE_LABELS, updateLastLogin, updateRole, updateSeen,
  type AppUser, type UserRole,
} from './users.repository.js';

/**
 * "Online": alguma requisição autenticada nos últimos 2,5 min. A fila de
 * protocolos é relida a cada 30 s, então uma aba aberta sempre aparece online.
 */
export const ONLINE_WINDOW_MS = 150_000;

/** Grava o "visto por último" no banco no máximo a cada 30 s por pessoa. */
const PERSIST_EVERY_MS = 30_000;

const seenAt = new Map<string, number>();
const persistedAt = new Map<string, number>();

const isBootstrapAdmin = (email: string) => appConfig.auth.bootstrapAdmins.includes(email);

/**
 * Papel de quem entra pela primeira vez: Padrão. A lista ADMIN_EMAILS só vale
 * enquanto não existir NENHUM admin (instalação nova) — se valesse sempre, um
 * e-mail dela que entrasse meses depois cairia direto como admin.
 */
function initialRole(email: string): UserRole {
  return countAdmins() === 0 && isBootstrapAdmin(email) ? 'ADMIN' : 'VIEWER';
}

/**
 * Registra o acesso de quem fez a requisição e devolve o papel dela.
 *
 * Nunca lança: cadastro ilegível não pode trancar todo mundo do lado de fora.
 * Nesse caso vale um papel provisório (admin de fábrica = Admin, o resto =
 * Padrão) e nada é gravado.
 */
export function touchUser(identity: { email: string; name: string; picture: string | null }): UserRole {
  const email = identity.email.toLowerCase();
  const now = Date.now();
  seenAt.set(email, now);
  try {
    const existing = findAppUser(email);
    const fresh = now - (persistedAt.get(email) ?? 0) < PERSIST_EVERY_MS;
    if (existing && fresh && existing.name === identity.name && existing.picture === identity.picture) return existing.role;

    const iso = new Date(now).toISOString();
    if (existing) {
      updateSeen(email, identity, iso);
      persistedAt.set(email, now);
      return existing.role;
    }
    const role = initialRole(email);
    insertAppUser({
      email, name: identity.name || email, picture: identity.picture, role, firstSeenAt: iso, lastSeenAt: iso, lastLoginAt: null,
    });
    persistedAt.set(email, now);
    logger.info('users', `primeiro acesso de ${email} — permissão ${ROLE_LABELS[role]}`);
    return role;
  } catch (err) {
    logger.error('users', `cadastro de usuários indisponível (${err instanceof Error ? err.message : String(err)}) — permissão provisória para ${email}`);
    return isBootstrapAdmin(email) ? 'ADMIN' : 'VIEWER';
  }
}

/** O clique em "Entrar com Google" (o front avisa logo depois do login). */
export function recordLogin(email: string): void {
  const key = email.toLowerCase();
  if (!findAppUser(key)) return;
  updateLastLogin(key, nowIso());
  persistedAt.set(key, Date.now());
}

export interface UserView extends AppUser {
  online: boolean;
}

/** Todos os usuários, online primeiro e depois pelo acesso mais recente. */
export function listUsers(): UserView[] {
  const now = Date.now();
  return listAppUsers()
    .map((u): UserView => {
      // o "visto por último" em memória é mais novo que o do banco (que só grava a cada 30 s)
      const lastSeen = Math.max(new Date(u.lastSeenAt).getTime(), seenAt.get(u.email) ?? 0);
      return { ...u, lastSeenAt: new Date(lastSeen).toISOString(), online: now - lastSeen <= ONLINE_WINDOW_MS };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/**
 * Troca a permissão de quem já entrou. Não deixa tirar o último
 * administrador — a tela que decide isso ficaria sem ninguém para abri-la.
 */
export function setUserRole(target: string, role: UserRole, actor: { email: string }): UserView {
  const email = target.toLowerCase();
  const current = findAppUser(email);
  if (!current) throw new AppException(404, 'USER_NOT_FOUND', 'Essa pessoa ainda não entrou na aplicação.');
  if (current.role !== role) {
    if (current.role === 'ADMIN' && countAdmins() <= 1) {
      throw new AppException(422, 'USER_LAST_ADMIN', 'Não dá para tirar o último administrador. Promova outra pessoa antes.');
    }
    transaction(() => {
      updateRole(email, role);
      insertAccessEvent({
        eventType: 'USER_ROLE_CHANGED', actorEmail: actor.email, personEmail: email,
        detail: { from: ROLE_LABELS[current.role], to: ROLE_LABELS[role] },
      });
    });
    logger.info('users', `${email}: ${ROLE_LABELS[current.role]} -> ${ROLE_LABELS[role]} por ${actor.email}`);
  }
  const view = listUsers().find((u) => u.email === email);
  if (!view) throw new AppException(404, 'USER_NOT_FOUND', 'Essa pessoa ainda não entrou na aplicação.');
  return view;
}
