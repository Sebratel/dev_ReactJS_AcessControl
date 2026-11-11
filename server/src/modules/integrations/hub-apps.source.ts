import { appConfig } from '../../config/env.config.js';
import type { ImportTable } from '../imports/hub-bi-permissions.parser.js';

/**
 * HUB APPS direto do MySQL (`DB_Hub_Apps`), SOMENTE LEITURA.
 *
 * A regra de acesso é a do próprio hub (hub-api, rota de launch-token): a
 * pessoa vê a aplicação se o id dela está em `allowed_users`, a equipe em
 * `allowed_teams` ou o perfil em `allowed_profiles`; aplicação sem nenhuma das
 * três listas é aberta a todos. Daqui saem as mesmas tabelas dos exports em
 * CSV, então o resto (casar, gravar, prévia) é a importação que já existe.
 */
export interface HubAppsUserRow {
  id: string;
  name: string | null;
  email: string;
  profile: string | null;
  team: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date | null;
}

export interface HubAppsAppRow {
  id: string;
  name: string;
  url: string | null;
  isActive: boolean;
  allowedUsers: string[];
  allowedTeams: string[];
  allowedProfiles: string[];
}

export interface HubAppsSnapshot {
  users: HubAppsUserRow[];
  teams: { id: string; name: string }[];
  apps: HubAppsAppRow[];
}

/** "07/02/2026" no horário de Brasília (o formato que o leitor dos exports entende). */
const brDate = (date: Date | null): string => (date && !Number.isNaN(date.getTime())
  ? date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  : '');

/** Monta as tabelas usuários / aplicações / acessos — função pura, testada sem banco. */
export function hubAppsTables(snapshot: HubAppsSnapshot): ImportTable[] {
  const teamName = new Map(snapshot.teams.map((t) => [String(t.id), t.name]));
  const teamOf = (u: HubAppsUserRow) => (u.team ? teamName.get(String(u.team)) ?? String(u.team) : '');

  const users: ImportTable = {
    header: ['id', 'name', 'email', 'perfil', 'equipe', 'is_admin', 'ativo', 'cadastrado_em'],
    rows: snapshot.users.map((u) => [
      u.id, u.name ?? '', u.email.trim().toLowerCase(), u.profile ?? '', teamOf(u), u.isAdmin ? '1' : '0', u.isActive ? '1' : '0', brDate(u.createdAt),
    ]),
  };

  const isOpen = (a: HubAppsAppRow) => !a.allowedUsers.length && !a.allowedTeams.length && !a.allowedProfiles.length;
  const apps: ImportTable = {
    header: ['id', 'name', 'url', 'ativo', 'livre'],
    rows: snapshot.apps.map((a) => [a.id, a.name, a.url ?? '', a.isActive ? '1' : '0', isOpen(a) ? '1' : '0']),
  };

  // só quem está ativo no hub; aplicação aberta a todos não gera linha (vira "sem controle próprio")
  const rows: ImportTable['rows'] = [];
  const activeUsers = snapshot.users.filter((u) => u.isActive);
  snapshot.apps.filter((a) => !isOpen(a)).forEach((app) => {
    const direct = new Set(app.allowedUsers.map(String));
    const teams = new Set(app.allowedTeams.map(String));
    const profiles = new Set(app.allowedProfiles.map(String));
    activeUsers.forEach((u) => {
      const motives = [
        direct.has(String(u.id)) && 'usuario_direto',
        u.team && teams.has(String(u.team)) && 'equipe',
        u.profile && profiles.has(u.profile) && 'perfil',
      ].filter(Boolean);
      if (!motives.length) return;
      rows.push([u.name ?? '', u.email.trim().toLowerCase(), u.profile ?? '', teamOf(u), app.name, app.url ?? '', motives.join('+'), app.id]);
    });
  });
  const accesses: ImportTable = { header: ['usuario', 'email', 'perfil', 'equipe', 'app', 'url', 'motivo_acesso', 'app_id'], rows };

  return [users, apps, accesses];
}

/** Lista JSON do MySQL/MariaDB: vem como array (MySQL) ou como texto (MariaDB). */
export function jsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

type Pool = import('mysql2/promise').Pool;
let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const mysql = await import('mysql2/promise');
  const cfg = appConfig.integrations.hubApps;
  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    timezone: cfg.timezone,
    ssl: cfg.ssl ? { rejectUnauthorized: true } : undefined,
    connectionLimit: 2,
    connectTimeout: 15_000,
    waitForConnections: true,
    queueLimit: 10,
    // só SELECT fixos daqui; nada de vários comandos numa string
    multipleStatements: false,
  });
  return pool;
}

/** Lê usuários, equipes e aplicações do hub — consultas fixas, sessão só de leitura. */
export async function fetchHubAppsSnapshot(): Promise<HubAppsSnapshot> {
  const conn = await (await getPool()).getConnection();
  try {
    await conn.query('SET SESSION TRANSACTION READ ONLY');
    const timeout = 60_000;
    const [users] = await conn.query({
      sql: 'SELECT id, name, email, profile, team, is_admin, is_active, created_at FROM users', timeout,
    });
    const [teams] = await conn.query({ sql: 'SELECT id, name FROM teams', timeout });
    const [apps] = await conn.query({
      sql: 'SELECT id, name, url, is_active, allowed_users, allowed_teams, allowed_profiles FROM apps', timeout,
    });
    type Row = Record<string, unknown>;
    return {
      users: (users as Row[]).map((r) => ({
        id: String(r.id),
        name: r.name === null ? null : String(r.name),
        email: String(r.email ?? ''),
        profile: r.profile ? String(r.profile) : null,
        team: r.team ? String(r.team) : null,
        isAdmin: Number(r.is_admin) === 1,
        isActive: Number(r.is_active) === 1,
        createdAt: r.created_at instanceof Date ? r.created_at : null,
      })),
      teams: (teams as Row[]).map((r) => ({ id: String(r.id), name: String(r.name ?? '') })),
      apps: (apps as Row[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        url: r.url ? String(r.url) : null,
        isActive: Number(r.is_active) === 1,
        allowedUsers: jsonList(r.allowed_users),
        allowedTeams: jsonList(r.allowed_teams),
        allowedProfiles: jsonList(r.allowed_profiles),
      })),
    };
  } finally {
    conn.release();
  }
}

export async function closeHubApps(): Promise<void> {
  if (pool) await pool.end().catch(() => undefined);
  pool = null;
}
