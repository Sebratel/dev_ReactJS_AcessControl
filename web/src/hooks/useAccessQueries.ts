import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { eventKeys, fetchAccessEvents, type EventFilters } from '../services/accessEventsService';
import { fetchGrants, grantKeys, type GrantFilters } from '../services/grantsService';
import { fetchPeople, fetchPeopleEmails, fetchPerson, peopleKeys, type PeopleFilters } from '../services/peopleService';
import { fetchResourceGrants, resourceKeys } from '../services/resourcesService';
import { fetchUsers, userKeys } from '../services/usersService';
import type { GrantStatus } from '../services/types';

export function useResourceGrants(resourceId: number | null, status?: GrantStatus) {
  return useQuery({
    queryKey: resourceKeys.grants(resourceId ?? 0, status),
    queryFn: () => fetchResourceGrants(resourceId!, status),
    enabled: resourceId !== null,
  });
}

export function useGrants(filters: GrantFilters, enabled = true) {
  return useQuery({ queryKey: grantKeys.list(filters), queryFn: () => fetchGrants(filters), enabled });
}

export function usePeople(filters: PeopleFilters) {
  return useQuery({ queryKey: peopleKeys.list(filters), queryFn: () => fetchPeople(filters), placeholderData: keepPreviousData });
}

/** Todos os e-mails do cadastro (relidos quando um acesso muda — a chave começa com 'people'). */
export function usePeopleEmails() {
  return useQuery({ queryKey: peopleKeys.emails, queryFn: fetchPeopleEmails, staleTime: 60_000 });
}

export function usePerson(id: number | null) {
  return useQuery({ queryKey: peopleKeys.detail(id ?? 0), queryFn: () => fetchPerson(id!), enabled: id !== null });
}

export function useAccessEvents(filters: EventFilters) {
  return useQuery({ queryKey: eventKeys.list(filters), queryFn: () => fetchAccessEvents(filters), placeholderData: keepPreviousData });
}

/** Usuários da aplicação (Administração) — relidos a cada 30 s para o "online" ficar em dia. */
export function useAppUsers(enabled: boolean) {
  return useQuery({ queryKey: userKeys.all, queryFn: fetchUsers, enabled, refetchInterval: 30_000 });
}
