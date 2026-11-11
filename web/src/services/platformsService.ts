import { getData, patchData } from './httpClient';
import type { Grant, GrantStatus, Platform, ResourceNode } from './types';

export const platformKeys = {
  all: ['platforms'] as const,
  detail: (slug: string) => ['platforms', slug] as const,
  resources: (slug: string) => ['platforms', slug, 'resources'] as const,
  grants: (slug: string, status?: GrantStatus) => ['platforms', slug, 'grants', status ?? 'ALL'] as const,
};

export const fetchPlatforms = (): Promise<Platform[]> => getData<Platform[]>('/platforms');

export const fetchPlatform = (slug: string): Promise<Platform> => getData<Platform>(`/platforms/${encodeURIComponent(slug)}`);

export const fetchPlatformResources = (slug: string): Promise<ResourceNode[]> =>
  getData<ResourceNode[]>(`/platforms/${encodeURIComponent(slug)}/resources`);

export const fetchPlatformGrants = (slug: string, status?: GrantStatus): Promise<Grant[]> =>
  getData<Grant[]>(`/platforms/${encodeURIComponent(slug)}/grants`, status ? { status } : undefined);

export const updatePlatform = (slug: string, changes: { url?: string | null; description?: string }): Promise<Platform> =>
  patchData<Platform>(`/platforms/${encodeURIComponent(slug)}`, changes);
