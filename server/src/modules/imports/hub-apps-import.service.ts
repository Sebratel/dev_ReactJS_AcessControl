import type { Actor } from '../people/people.service.js';
import { importAccessExport, type ImportOptions, type ImportSummary, type ParsedImport } from './access-import.service.js';

/**
 * HUB APPS — exports do `DB_Hub_Apps`: cada aplicação vira um item da árvore
 * "Aplicações" (casada pelo id do HUB); cada usuário ativo ganha o acesso ao
 * hub (Admin ou o perfil); cada linha de acesso vira o acesso à aplicação, com
 * o motivo (perfil, equipe, usuário direto). Com o export de usuários, quem
 * sumiu do hub também aparece em "não consta".
 */
export function importHubAppsExport(parsed: ParsedImport, options: ImportOptions, actor: Actor): ImportSummary {
  return importAccessExport(parsed, {
    platformSlug: 'aplicacoes',
    sourceLabel: 'HUB APPS',
    eventSource: 'HUB_APPS_EXPORT',
    rootGrant: 'everyone',
    rootTracksExport: parsed.members !== undefined,
    resourceType: 'APPLICATION',
  }, options, actor);
}
