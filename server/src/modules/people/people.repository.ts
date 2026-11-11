import { getDb, type SqlParams } from '../../database/app-database.js';
import { escapeLike } from '../access-events/access-events.repository.js';

export interface Person {
  id: number;
  email: string;
  name: string;
  department: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Pessoa na listagem: com o total de acessos ativos e em quais plataformas. */
export interface PersonSummary extends Person {
  activeGrants: number;
  platforms: string[];
}

function toPerson(row: Record<string, unknown>): Person {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name ?? ''),
    department: String(row.department ?? ''),
    isActive: Number(row.is_active) === 1,
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function findPersonById(id: number): Person | null {
  const row = getDb().prepare('SELECT * FROM people WHERE id = ?').get(id);
  return row ? toPerson(row) : null;
}

export function findPersonByEmail(email: string): Person | null {
  const row = getDb().prepare('SELECT * FROM people WHERE email = ?').get(email.trim().toLowerCase());
  return row ? toPerson(row) : null;
}

export function insertPerson(input: { email: string; name: string; department: string; notes: string }, now: string): number {
  const result = getDb().prepare(
    `INSERT INTO people (email, name, department, is_active, notes, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`,
  ).run(input.email.trim().toLowerCase(), input.name, input.department, input.notes, now, now);
  return Number(result.lastInsertRowid);
}

export function updatePerson(
  id: number,
  changes: { name?: string; department?: string; isActive?: boolean; notes?: string },
  now: string,
): void {
  const current = findPersonById(id);
  if (!current) return;
  getDb().prepare('UPDATE people SET name = ?, department = ?, is_active = ?, notes = ?, updated_at = ? WHERE id = ?').run(
    changes.name ?? current.name,
    changes.department ?? current.department,
    (changes.isActive ?? current.isActive) ? 1 : 0,
    changes.notes ?? current.notes,
    now,
    id,
  );
}

export interface PeopleFilter {
  search?: string;
  platformSlug?: string;
  withAccessOnly?: boolean;
  /** letra inicial do e-mail (a–z) ou '#' para o que não começa com letra */
  initial?: string;
  page: number;
  pageSize: number;
}

// primeira letra do e-mail; o que não for a–z cai em '#'
const INITIAL_SQL = "CASE WHEN lower(substr(p.email, 1, 1)) BETWEEN 'a' AND 'z' THEN lower(substr(p.email, 1, 1)) ELSE '#' END";

/** Todos os e-mails do cadastro, únicos e em ordem alfabética (lista de escolha ao conceder). */
export function listPeopleEmails(): string[] {
  return getDb()
    .prepare('SELECT DISTINCT lower(email) AS email FROM people ORDER BY email')
    .all()
    .map((row) => String(row.email));
}

export function listPeople(filter: PeopleFilter): { items: PersonSummary[]; totalItems: number; initials: Record<string, number> } {
  const where: string[] = [];
  const params: SqlParams = {};
  if (filter.search) {
    where.push(`(p.email LIKE $search ESCAPE '\\' OR p.name LIKE $search ESCAPE '\\' OR p.department LIKE $search ESCAPE '\\')`);
    params.search = `%${escapeLike(filter.search)}%`;
  }
  if (filter.platformSlug) {
    where.push(`EXISTS (SELECT 1 FROM grants g JOIN resources r ON r.id = g.resource_id JOIN platforms pl ON pl.id = r.platform_id
      WHERE g.person_id = p.id AND g.status = 'ACTIVE' AND r.deleted_at IS NULL AND pl.slug = $platformSlug)`);
    params.platformSlug = filter.platformSlug;
  } else if (filter.withAccessOnly) {
    where.push(`EXISTS (SELECT 1 FROM grants g WHERE g.person_id = p.id AND g.status = 'ACTIVE')`);
  }
  const db = getDb();
  // quantas pessoas por letra com os mesmos filtros, menos a própria letra (a barra de letras usa)
  const initials = Object.fromEntries(
    db.prepare(`SELECT ${INITIAL_SQL} AS letter, COUNT(*) AS n FROM people p ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY letter`)
      .all(params)
      .map((row) => [String(row.letter), Number(row.n)]),
  );
  if (filter.initial) {
    where.push(`${INITIAL_SQL} = $initial`);
    params.initial = filter.initial.toLowerCase();
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalItems = Number(db.prepare(`SELECT COUNT(*) AS n FROM people p ${whereSql}`).get(params)?.n ?? 0);
  const rows = db.prepare(
    `SELECT p.*,
       (SELECT COUNT(*) FROM grants g JOIN resources r ON r.id = g.resource_id
          WHERE g.person_id = p.id AND g.status = 'ACTIVE' AND r.deleted_at IS NULL) AS active_grants,
       (SELECT GROUP_CONCAT(DISTINCT pl.slug) FROM grants g
          JOIN resources r ON r.id = g.resource_id JOIN platforms pl ON pl.id = r.platform_id
          WHERE g.person_id = p.id AND g.status = 'ACTIVE' AND r.deleted_at IS NULL) AS platforms
     FROM people p ${whereSql}
     ORDER BY p.email COLLATE NOCASE
     LIMIT $limit OFFSET $offset`,
  ).all({ ...params, limit: filter.pageSize, offset: (filter.page - 1) * filter.pageSize });
  return {
    totalItems,
    initials,
    items: rows.map((row) => ({
      ...toPerson(row),
      activeGrants: Number(row.active_grants ?? 0),
      platforms: row.platforms ? String(row.platforms).split(',') : [],
    })),
  };
}
