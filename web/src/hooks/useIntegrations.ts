import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIntegrations, integrationKeys, syncIntegration } from '../services/integrationsService';

/** Situação das conexões diretas — relida a cada minuto (a sincronização roda no servidor). */
export function useIntegrations() {
  return useQuery({ queryKey: integrationKeys.all, queryFn: fetchIntegrations, refetchInterval: 60_000 });
}

/** Sincronizar agora: no fim, tudo que depende de acesso é relido. */
export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => syncIntegration(slug),
    onSettled: () => Promise.all(
      ['integrations', 'platforms', 'resources', 'grants', 'people', 'protocols', 'access-events']
        .map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    ),
  });
}
