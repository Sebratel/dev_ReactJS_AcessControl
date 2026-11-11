import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PROTOCOLS_POLL_MS } from '../config';
import {
  fetchPlatform, fetchPlatformGrants, fetchPlatformResources, fetchPlatforms, platformKeys, updatePlatform,
} from '../services/platformsService';
import type { GrantStatus } from '../services/types';

/** Plataformas com contadores (inclui protocolos abertos — por isso o mesmo ritmo da fila). */
export function usePlatforms() {
  return useQuery({
    queryKey: platformKeys.all,
    queryFn: fetchPlatforms,
    refetchInterval: PROTOCOLS_POLL_MS,
    staleTime: 15_000,
  });
}

export function usePlatform(slug: string) {
  return useQuery({ queryKey: platformKeys.detail(slug), queryFn: () => fetchPlatform(slug) });
}

export function usePlatformResources(slug: string | null | undefined) {
  return useQuery({
    queryKey: platformKeys.resources(slug ?? ''),
    queryFn: () => fetchPlatformResources(slug!),
    enabled: Boolean(slug),
  });
}

export function usePlatformGrants(slug: string, status?: GrantStatus) {
  return useQuery({ queryKey: platformKeys.grants(slug, status), queryFn: () => fetchPlatformGrants(slug, status) });
}

export function useUpdatePlatform(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: { url?: string | null; description?: string }) => updatePlatform(slug, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.all }),
  });
}
