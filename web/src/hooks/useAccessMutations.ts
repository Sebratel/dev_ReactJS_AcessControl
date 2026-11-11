import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  grantAccess, grantAccessBatch, revokeGrant, type BatchGrantInput, type GrantInput, type RevokeInput,
} from '../services/grantsService';
import { revokeAllAccess, updatePerson } from '../services/peopleService';
import {
  createResource, removeResource, updateResource, type ResourceInput,
} from '../services/resourcesService';
import type { Person } from '../services/types';

/**
 * Toda alteração de acesso mexe em várias telas ao mesmo tempo (árvore,
 * contadores, pessoa, protocolo, log) — invalida tudo que depende disso.
 */
function useInvalidateAccess() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['platforms'] }),
    queryClient.invalidateQueries({ queryKey: ['resources'] }),
    queryClient.invalidateQueries({ queryKey: ['grants'] }),
    queryClient.invalidateQueries({ queryKey: ['people'] }),
    queryClient.invalidateQueries({ queryKey: ['protocols'] }),
    queryClient.invalidateQueries({ queryKey: ['access-events'] }),
  ]);
}

export function useGrantAccess() {
  const invalidate = useInvalidateAccess();
  return useMutation({ mutationFn: (input: GrantInput) => grantAccess(input), onSuccess: invalidate });
}

export function useGrantAccessBatch() {
  const invalidate = useInvalidateAccess();
  return useMutation({ mutationFn: (input: BatchGrantInput) => grantAccessBatch(input), onSuccess: invalidate });
}

export function useRevokeGrant() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RevokeInput }) => revokeGrant(id, input),
    onSuccess: invalidate,
  });
}

export function useRevokeAll() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ personId, input }: { personId: number; input: { platformSlug: string | null; protocolNumber: string | null; notes: string } }) =>
      revokeAllAccess(personId, input),
    onSuccess: invalidate,
  });
}

export function useCreateResource() {
  const invalidate = useInvalidateAccess();
  return useMutation({ mutationFn: (input: ResourceInput) => createResource(input), onSuccess: invalidate });
}

export function useUpdateResource() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<ResourceInput> }) => updateResource(id, changes),
    onSuccess: invalidate,
  });
}

export function useRemoveResource() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, revokeGrants }: { id: number; revokeGrants: boolean }) => removeResource(id, revokeGrants),
    onSuccess: invalidate,
  });
}

export function useUpdatePerson() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<Pick<Person, 'name' | 'department' | 'isActive' | 'notes'>> }) =>
      updatePerson(id, changes),
    onSuccess: invalidate,
  });
}
