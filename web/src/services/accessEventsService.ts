import { getWithMeta } from './httpClient';
import type { AccessEvent, AccessEventType, PageMeta } from './types';

export interface EventFilters {
  platform?: string;
  eventType?: AccessEventType[];
  search?: string;
  personId?: number;
  resourceId?: number;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export const eventKeys = {
  all: ['access-events'] as const,
  list: (filters: EventFilters) => ['access-events', filters] as const,
};

export const fetchAccessEvents = (filters: EventFilters) => getWithMeta<AccessEvent[], PageMeta>('/access-events', {
  ...filters,
  eventType: filters.eventType?.length ? filters.eventType.join(',') : undefined,
  search: filters.search || undefined,
});
