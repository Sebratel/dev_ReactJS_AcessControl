import { getData, getWithMeta, patchData, postData } from './httpClient';
import type { Protocol, ProtocolDetail, ProtocolListMeta, ProtocolState, RequestType } from './types';

export interface ProtocolFilters {
  state: ProtocolState | 'ALL';
  platform?: string;
  requestType?: RequestType;
  search?: string;
  unregistered?: boolean;
}

export const protocolKeys = {
  all: ['protocols'] as const,
  list: (filters: ProtocolFilters) => ['protocols', 'list', filters] as const,
  detail: (protocolNumber: string) => ['protocols', 'detail', protocolNumber] as const,
};

export function fetchProtocols(filters: ProtocolFilters, signal?: AbortSignal) {
  return getWithMeta<Protocol[], ProtocolListMeta>('/protocols', {
    state: filters.state,
    platform: filters.platform || undefined,
    requestType: filters.requestType || undefined,
    search: filters.search || undefined,
    unregistered: filters.unregistered ? 'true' : undefined,
  }, signal);
}

export const fetchProtocolDetail = (protocolNumber: string, signal?: AbortSignal): Promise<ProtocolDetail> =>
  getData<ProtocolDetail>(`/protocols/${encodeURIComponent(protocolNumber)}`, undefined, signal);

export const updateProtocolTracking = (
  protocolNumber: string,
  changes: { platformSlug?: string | null; note?: string; isHandled?: boolean },
): Promise<Protocol> => patchData<Protocol>(`/protocols/${encodeURIComponent(protocolNumber)}/tracking`, changes);

export const requestProtocolsRefresh = (): Promise<unknown> => postData('/protocols/refresh');
