import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { appConfig } from '../config/env.config.js';
import { logger } from '../common/helpers/logger.helper.js';
import { MIGRATIONS, SEED_PLATFORMS } from './migrations.js';

/**
 * Banco da própria aplicação: SQLite embutido no Node (`node:sqlite`), num
 * arquivo dentro de DATA_PATH (no Docker, um volume). Sem servidor de banco
 * para manter — o volume de dados é pequeno (cadastros, concessões e log) e só
 * o time escreve nele.
 */
export type SqlParams = Record<string, SQLInputValue>;

let database: DatabaseSync | null = null;

export const nowIso = (): string => new Date().toISOString();

/** Abre (ou recria, nos testes) o banco e aplica migrations e sementes. */
export function initDatabase(file?: string): DatabaseSync {
  closeDatabase();
  const path = file ?? defaultPath();
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
  }
  runMigrations(db);
  seedPlatforms(db);
  database = db;
  return db;
}

function defaultPath(): string {
  mkdirSync(appConfig.dataPath, { recursive: true });
  return join(appConfig.dataPath, 'access-control.db');
}

export function getDb(): DatabaseSync {
  return database ?? initDatabase();
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}

/**
 * Executa `fn` numa transação. Aninhada, reaproveita a de fora (o SQLite não
 * aninha BEGIN) — quem abriu é quem confirma ou desfaz.
 */
let depth = 0;
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  if (depth > 0) return fn();
  db.exec('BEGIN IMMEDIATE');
  depth += 1;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    depth -= 1;
  }
}

function runMigrations(db: DatabaseSync): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row) => String(row.id)),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(migration.id, nowIso());
      db.exec('COMMIT');
      logger.info('banco', `migration aplicada: ${migration.id}`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** Garante as plataformas de fábrica e a raiz de cada uma (idempotente). */
function seedPlatforms(db: DatabaseSync): void {
  const now = nowIso();
  const findPlatform = db.prepare('SELECT id FROM platforms WHERE slug = ?');
  const insertPlatform = db.prepare(
    `INSERT INTO platforms (slug, name, description, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const findRoot = db.prepare(
    "SELECT id FROM resources WHERE platform_id = ? AND parent_id IS NULL AND resource_type = 'PLATFORM' AND deleted_at IS NULL",
  );
  const insertRoot = db.prepare(
    `INSERT INTO resources (platform_id, parent_id, resource_type, name, description, is_access_controlled, created_at, updated_at)
     VALUES (?, NULL, 'PLATFORM', ?, ?, 1, ?, ?)`,
  );
  SEED_PLATFORMS.forEach((seed, index) => {
    let platform = findPlatform.get(seed.slug);
    if (!platform) {
      insertPlatform.run(seed.slug, seed.name, seed.description, index, now, now);
      platform = findPlatform.get(seed.slug);
    }
    const platformId = Number(platform?.id);
    if (!findRoot.get(platformId)) {
      insertRoot.run(platformId, seed.rootName, 'Acesso à ferramenta em si (login no hub/plataforma).', now, now);
    }
  });
}
