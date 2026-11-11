import type { Actor } from '../people/people.service.js';
import {
  importAccessExport, type ImportOptions, type ImportStrategy, type ImportSummary, type ParsedImport,
} from './access-import.service.js';

/**
 * UpValue — "Controle UpValue": quem aparece no export tem conta na ferramenta
 * (acesso à raiz "Acesso ao UpValue") e cada relatório vira um item da árvore,
 * casado pelo nome (a planilha não traz id). Como o export lista todos os
 * usuários, quem sumiu dele também aparece em "não consta".
 */
const UPVALUE: ImportStrategy = {
  platformSlug: 'upvalue',
  sourceLabel: 'controle da UpValue',
  eventSource: 'UPVALUE_REPORTS',
  rootGrant: 'everyone',
  rootTracksExport: true,
  // dentro da plataforma UpValue o prefixo "[Up]" é redundante
  displayName: (name) => name.replace(/^\s*\[up\]\s*/i, '').trim() || name,
};

export function importUpvalueReports(parsed: ParsedImport, options: ImportOptions, actor: Actor): ImportSummary {
  return importAccessExport(parsed, UPVALUE, options, actor);
}
