import { getData, getWithMeta, patchData, postData } from './httpClient';
import type { Grant, PeopleListMeta, Person, PersonSummary } from './types';

export interface PeopleFilters {
  search?: string;
  platform?: string;
  withAccess?: boolean;
  /** letra inicial do e-mail (a–z) ou '#' */
  initial?: string;
  page: number;
  pageSize: number;
}

export const peopleKeys = {
  all: ['people'] as const,
  list: (filters: PeopleFilters) => ['people', 'list', filters] as const,
  detail: (id: number) => ['people', 'detail', id] as const,
  emails: ['people', 'emails'] as const,
};

export const fetchPeople = (filters: PeopleFilters) => getWithMeta<PersonSummary[], PeopleListMeta>('/people', {
  search: filters.search || undefined,
  platform: filters.platform || undefined,
  withAccess: filters.withAccess ? 'true' : undefined,
  initial: filters.initial || undefined,
  page: filters.page,
  pageSize: filters.pageSize,
});

/** Todos os e-mails do cadastro, únicos e em ordem alfabética (lista de escolha ao conceder). */
export const fetchPeopleEmails = (): Promise<string[]> => getData<string[]>('/people/emails');

export const fetchPerson = (id: number): Promise<{ person: Person; grants: Grant[] }> =>
  getData<{ person: Person; grants: Grant[] }>(`/people/${id}`);

export const createPerson = (input: { email: string; name: string; department: string; notes: string }): Promise<Person> =>
  postData<Person>('/people', input);

export const updatePerson = (id: number, changes: Partial<Pick<Person, 'name' | 'department' | 'isActive' | 'notes'>>): Promise<Person> =>
  patchData<Person>(`/people/${id}`, changes);

export const revokeAllAccess = (
  id: number,
  input: { platformSlug: string | null; protocolNumber: string | null; notes: string },
): Promise<{ revoked: Grant[] }> => postData<{ revoked: Grant[] }>(`/people/${id}/revoke-all`, input);
