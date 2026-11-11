import { getDb } from '../../database/app-database.js';

/**
 * Quem já entrou na aplicação e o que pode fazer — mesmo modelo da
 * logisticDashboard. Papéis, do menor para o maior:
 *   VIEWER ("Padrão") — consulta tudo;
 *   EDITOR ("Edição") — também concede/remove acessos e edita o cadastro;
 *   ADMIN  ("Admin")  — tudo, mais a tela de Administração e a releitura manual do Voalle.
 */
export const USER_ROLES = ['VIEWER', 'EDITOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = { VIEWER: 'Padrão', EDITOR: 'Edição', ADMIN: 'Admin' };

export interface AppUser {
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  firstSeenAt: string;
  /** última requisição autenticada (gravada no máximo a cada 30 s) */
  lastSeenAt: string;
  /** último clique em "Entrar com Google" */
  lastLoginAt: string | null;
}

function toUser(row: Record<string, unknown>): AppUser {
  return {
    email: String(row.email),
    name: String(row.name ?? ''),
    picture: (row.picture as string | null) ?? null,
    role: String(row.role) as UserRole,
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  };
}

export function listAppUsers(): AppUser[] {
  return getDb().prepare('SELECT * FROM app_users').all().map(toUser);
}

export function findAppUser(email: string): AppUser | null {
  const row = getDb().prepare('SELECT * FROM app_users WHERE email = ?').get(email.toLowerCase());
  return row ? toUser(row) : null;
}

export function countAdmins(): number {
  return Number(getDb().prepare("SELECT COUNT(*) AS n FROM app_users WHERE role = 'ADMIN'").get()?.n ?? 0);
}

export function insertAppUser(user: AppUser): void {
  getDb().prepare(
    `INSERT INTO app_users (email, name, picture, role, first_seen_at, last_seen_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.email.toLowerCase(), user.name, user.picture, user.role, user.firstSeenAt, user.lastSeenAt, user.lastLoginAt);
}

export function updateSeen(email: string, identity: { name: string; picture: string | null }, seenAt: string): void {
  getDb().prepare(
    "UPDATE app_users SET name = CASE WHEN ? <> '' THEN ? ELSE name END, picture = ?, last_seen_at = ? WHERE email = ?",
  ).run(identity.name, identity.name, identity.picture, seenAt, email.toLowerCase());
}

export function updateLastLogin(email: string, at: string): void {
  getDb().prepare('UPDATE app_users SET last_login_at = ?, last_seen_at = ? WHERE email = ?').run(at, at, email.toLowerCase());
}

export function updateRole(email: string, role: UserRole): void {
  getDb().prepare('UPDATE app_users SET role = ? WHERE email = ?').run(role, email.toLowerCase());
}
