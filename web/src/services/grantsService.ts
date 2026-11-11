import { getData, patchData, postData } from './httpClient';
import type { BatchGrantResult, Grant, GrantResult, GrantStatus } from './types';

export interface GrantInput {
  email: string;
  name?: string;
  resourceIds: number[];
  includeAncestors: boolean;
  accessLevel: string;
  protocolNumber: string | null;
  notes: string;
}

/** A mesma liberação para várias pessoas — o protocolo é obrigatório aqui. */
export interface BatchGrantInput {
  emails: string[];
  resourceIds: number[];
  includeAncestors: boolean;
  protocolNumber: string;
  notes: string;
}

export interface RevokeInput {
  includeDescendants: boolean;
  protocolNumber: string | null;
  notes: string;
}

export interface GrantFilters {
  protocolNumber?: string;
  personId?: number;
  /** e-mail da pessoa (o servidor ignora maiúsculas) */
  email?: string;
  resourceId?: number;
  status?: GrantStatus;
}

export const grantKeys = {
  list: (filters: GrantFilters) => ['grants', filters] as const,
};

export const fetchGrants = (filters: GrantFilters): Promise<Grant[]> => getData<Grant[]>('/grants', { ...filters });

export const grantAccess = (input: GrantInput): Promise<GrantResult> => postData<GrantResult>('/grants', input);

export const grantAccessBatch = (input: BatchGrantInput): Promise<BatchGrantResult> => postData<BatchGrantResult>('/grants/batch', input);

export const revokeGrant = (id: number, input: RevokeInput): Promise<{ revoked: Grant[] }> =>
  postData<{ revoked: Grant[] }>(`/grants/${id}/revoke`, input);

export const updateGrant = (id: number, changes: { accessLevel?: string; notes?: string }): Promise<Grant> =>
  patchData<Grant>(`/grants/${id}`, changes);
