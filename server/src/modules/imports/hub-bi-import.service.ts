import type { Actor } from '../people/people.service.js';
import { importAccessExport, type ImportOptions, type ImportStrategy, type ImportSummary } from './access-import.service.js';
import type { ParsedHubBiPermissions } from './hub-bi-permissions.parser.js';

export type { ImportOptions, ImportSummary } from './access-import.service.js';

/**
 * HUB BI — export "permissões ativas por dashboard" (Firestore):
 * dashboard casado pelo id do Firestore; o nível do HUB (Admin/User) vira o
 * acesso à raiz "Acesso ao HUB BI" (quem não tem nível nunca entrou no HUB).
 */
const HUB_BI: ImportStrategy = {
  platformSlug: 'hub-bi',
  sourceLabel: 'HUB BI',
  eventSource: 'HUB_BI_PERMISSIONS',
  rootGrant: 'withLevel',
  rootTracksExport: false,
};

export function importHubBiPermissions(parsed: ParsedHubBiPermissions, options: ImportOptions, actor: Actor): ImportSummary {
  return importAccessExport({
    rowsRead: parsed.rowsRead,
    ignored: parsed.ignored,
    records: parsed.records.map((r) => ({
      rowNumber: r.rowNumber,
      resourceKey: r.dashboardId,
      resourceName: r.dashboardName,
      email: r.email,
      userName: r.userName,
      rootLevel: r.hubRole,
      grantedAt: r.grantedAt,
      sourceRef: r.permissionId,
    })),
  }, HUB_BI, options, actor);
}
