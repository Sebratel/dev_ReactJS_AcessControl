import { postData } from './httpClient';
import type { ImportSummary, ImportTable } from './types';

export type ImportFormat = 'hub-bi-permissions' | 'upvalue-reports' | 'hub-apps';

/**
 * Envia as tabelas lidas das planilhas (uma ou várias, conforme o formato).
 * Com `dryRun`, só calcula a prévia (nada é gravado).
 */
export const importAccessExport = (
  format: ImportFormat,
  tables: ImportTable[],
  options: { dryRun: boolean; revokeMissing: boolean },
): Promise<ImportSummary> => postData<ImportSummary>(
  `/imports/${format}`,
  tables.length === 1 ? { table: tables[0], ...options } : { tables, ...options },
);
