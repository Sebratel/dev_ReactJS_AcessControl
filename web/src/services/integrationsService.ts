import { getData, postData } from './httpClient';
import type { ImportSummary, IntegrationStatus } from './types';

export const integrationKeys = { all: ['integrations'] as const };

/** Situação da conexão direta com cada hub (HUB BI, HUB APPS). */
export const fetchIntegrations = (): Promise<IntegrationStatus[]> => getData<IntegrationStatus[]>('/integrations');

/** "Sincronizar agora": lê o hub e aplica (com `dryRun`, só a prévia). */
export const syncIntegration = (slug: string, dryRun = false): Promise<ImportSummary> =>
  postData<ImportSummary>(`/integrations/${encodeURIComponent(slug)}/sync`, { dryRun });
