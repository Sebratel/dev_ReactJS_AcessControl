import { AppException } from '../../common/errors/app.exception.js';
import { nowIso, transaction } from '../../database/app-database.js';
import { insertAccessEvent } from '../access-events/access-events.repository.js';
import { listGrants, type GrantView } from '../grants/grants.repository.js';
import {
  findPersonByEmail, findPersonById, insertPerson, updatePerson, type Person,
} from './people.repository.js';

export interface Actor {
  email: string;
}

/** Acha a pessoa pelo e-mail ou cadastra (o e-mail é a identidade em todos os hubs). */
export function ensurePerson(email: string, name: string | undefined, actor: Actor): Person {
  const normalized = email.trim().toLowerCase();
  const existing = findPersonByEmail(normalized);
  if (existing) {
    // completa o nome que faltava (ex.: cadastrada por importação só com o e-mail)
    if (name?.trim() && !existing.name) {
      updatePerson(existing.id, { name: name.trim() }, nowIso());
      return findPersonById(existing.id) ?? existing;
    }
    return existing;
  }
  const id = insertPerson({ email: normalized, name: name?.trim() ?? '', department: '', notes: '' }, nowIso());
  insertAccessEvent({ eventType: 'PERSON_CREATED', actorEmail: actor.email, personId: id, personEmail: normalized });
  const created = findPersonById(id);
  if (!created) throw new Error('pessoa recém-criada não encontrada');
  return created;
}

export function createPerson(input: { email: string; name: string; department: string; notes: string }, actor: Actor): Person {
  if (findPersonByEmail(input.email)) {
    throw new AppException(409, 'PERSON_EMAIL_ALREADY_EXISTS', 'Já existe uma pessoa com esse e-mail.');
  }
  return transaction(() => {
    const id = insertPerson(input, nowIso());
    insertAccessEvent({ eventType: 'PERSON_CREATED', actorEmail: actor.email, personId: id, personEmail: input.email.toLowerCase() });
    return getPersonOrThrow(id);
  });
}

export function editPerson(
  id: number,
  changes: { name?: string; department?: string; isActive?: boolean; notes?: string },
  actor: Actor,
): Person {
  const current = getPersonOrThrow(id);
  return transaction(() => {
    updatePerson(id, changes, nowIso());
    const updated = getPersonOrThrow(id);
    const diff = diffFields(current, updated, ['name', 'department', 'isActive', 'notes']);
    if (Object.keys(diff).length) {
      insertAccessEvent({
        eventType: 'PERSON_UPDATED', actorEmail: actor.email, personId: id, personEmail: updated.email, detail: { changes: diff },
      });
    }
    return updated;
  });
}

export function getPersonOrThrow(id: number): Person {
  const person = findPersonById(id);
  if (!person) throw new AppException(404, 'PERSON_NOT_FOUND', 'Pessoa não encontrada.');
  return person;
}

export function getPersonAccess(id: number): { person: Person; grants: GrantView[] } {
  const person = getPersonOrThrow(id);
  return { person, grants: listGrants({ personId: id }) };
}

export function diffFields<T extends object>(before: T, after: T, keys: (keyof T)[]): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  keys.forEach((key) => {
    if (before[key] !== after[key]) diff[String(key)] = { from: before[key], to: after[key] };
  });
  return diff;
}
