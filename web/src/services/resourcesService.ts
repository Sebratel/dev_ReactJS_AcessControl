import { deleteResource, getData, patchData, postData } from './httpClient';
import type { Grant, GrantStatus, ResourceNode, ResourceType } from './types';

export interface ResourceInput {
  parentId: number;
  resourceType: Exclude<ResourceType, 'PLATFORM'>;
  name: string;
  url: string | null;
  description: string;
  owner: string;
  isAccessControlled: boolean;
}

export const resourceKeys = {
  grants: (id: number, status?: GrantStatus) => ['resources', id, 'grants', status ?? 'ALL'] as const,
};

export const createResource = (input: ResourceInput): Promise<ResourceNode> => postData<ResourceNode>('/resources', input);

export const updateResource = (id: number, changes: Partial<ResourceInput>): Promise<ResourceNode> =>
  patchData<ResourceNode>(`/resources/${id}`, changes);

export const removeResource = (id: number, revokeGrants: boolean): Promise<void> =>
  deleteResource(`/resources/${id}`, { revokeGrants: String(revokeGrants) });

export const fetchResourceGrants = (id: number, status?: GrantStatus): Promise<Grant[]> =>
  getData<Grant[]>(`/resources/${id}/grants`, status ? { status } : undefined);
