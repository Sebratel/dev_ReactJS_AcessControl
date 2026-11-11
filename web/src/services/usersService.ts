import { getWithMeta, patchData } from './httpClient';
import type { AppUser, TeamRole } from './types';

export const userKeys = { all: ['users'] as const };

export const fetchUsers = () => getWithMeta<AppUser[], { total: number; online: number; onlineWindowMs: number }>('/users');

export const updateUserRole = (email: string, role: TeamRole): Promise<AppUser> =>
  patchData<AppUser>(`/users/${encodeURIComponent(email)}`, { role });
