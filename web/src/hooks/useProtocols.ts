import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PROTOCOLS_POLL_MS } from '../config';
import {
  fetchProtocolDetail, fetchProtocols, protocolKeys, requestProtocolsRefresh, updateProtocolTracking, type ProtocolFilters,
} from '../services/protocolsService';

/** Fila de protocolos: conferida a cada 30 s (o servidor relê o Voalle a cada 3 min). */
export function useProtocols(filters: ProtocolFilters) {
  return useQuery({
    queryKey: protocolKeys.list(filters),
    queryFn: ({ signal }) => fetchProtocols(filters, signal),
    refetchInterval: PROTOCOLS_POLL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  });
}

export function useProtocolDetail(protocolNumber: string | null) {
  return useQuery({
    queryKey: protocolKeys.detail(protocolNumber ?? ''),
    queryFn: ({ signal }) => fetchProtocolDetail(protocolNumber!, signal),
    enabled: Boolean(protocolNumber),
  });
}

export function useUpdateProtocolTracking(protocolNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: { platformSlug?: string | null; note?: string; isHandled?: boolean }) =>
      updateProtocolTracking(protocolNumber, changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: protocolKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['access-events'] });
      void queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
  });
}

export function useRefreshProtocols() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestProtocolsRefresh,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: protocolKeys.all }),
  });
}
