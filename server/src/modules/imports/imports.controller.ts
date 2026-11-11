import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/auth/auth.middleware.js';
import { AppException } from '../../common/errors/app.exception.js';
import { sendOk } from '../../common/http/api-response.js';
import { actorOf } from '../../common/http/request.helper.js';
import { writeRateLimit } from '../../common/middlewares/security.middleware.js';
import type { Actor } from '../people/people.service.js';
import type { ImportOptions, ImportSummary } from './access-import.service.js';
import { importHubAppsExport } from './hub-apps-import.service.js';
import { parseHubAppsExport } from './hub-apps.parser.js';
import { importHubBiPermissions } from './hub-bi-import.service.js';
import { parseHubBiPermissions, type ImportTable } from './hub-bi-permissions.parser.js';
import { importUpvalueReports } from './upvalue-import.service.js';
import { parseUpvalueReports } from './upvalue-reports.parser.js';

/**
 * Importações. As planilhas são lidas no NAVEGADOR e chegam aqui como tabelas
 * JSON (cabeçalho + linhas): o servidor nunca abre arquivo enviado. Estas rotas
 * têm parser JSON próprio com teto maior (o global é de 32 kB), depois da autenticação.
 */
export const importsRouter = Router();

const MAX_ROWS = 20_000;
const cell = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);
const tableSchema = z.object({
  header: z.array(cell).min(1).max(60),
  rows: z.array(z.array(cell).max(60)).max(MAX_ROWS, `No máximo ${MAX_ROWS} linhas por arquivo.`),
});

const ImportSchema = z.object({
  /** formatos de um arquivo só */
  table: tableSchema.optional(),
  /** formatos de vários arquivos (HUB APPS) */
  tables: z.array(tableSchema).min(1).max(6).optional(),
  dryRun: z.boolean().default(true),
  revokeMissing: z.boolean().default(false),
});

type Importer = (tables: ImportTable[], options: ImportOptions, actor: Actor) => ImportSummary;

const single = (run: (table: ImportTable, options: ImportOptions, actor: Actor) => ImportSummary): Importer => (tables, options, actor) => {
  if (tables.length !== 1) throw new AppException(422, 'IMPORT_SINGLE_FILE', 'Este formato é de um arquivo só.');
  return run(tables[0]!, options, actor);
};

/** Cada formato de export: leitor próprio + o núcleo comum. */
const IMPORTERS: Record<string, Importer> = {
  'hub-bi-permissions': single((table, options, actor) => importHubBiPermissions(parseHubBiPermissions(table), options, actor)),
  'upvalue-reports': single((table, options, actor) => importUpvalueReports(parseUpvalueReports(table), options, actor)),
  'hub-apps': (tables, options, actor) => importHubAppsExport(parseHubAppsExport(tables), options, actor),
};

function handler(importer: Importer): RequestHandler {
  return (req, res, next) => {
    try {
      const body = ImportSchema.parse(req.body);
      const tables = body.tables ?? (body.table ? [body.table] : []);
      if (!tables.length) throw new AppException(400, 'VALIDATION_FAILED', 'Envie a tabela da planilha (table ou tables).');
      sendOk(res, importer(tables, { dryRun: body.dryRun, revokeMissing: body.revokeMissing }, actorOf(req)));
    } catch (err) {
      next(err);
    }
  };
}

Object.entries(IMPORTERS).forEach(([format, importer]) => {
  importsRouter.post(`/${format}`, requireAuth({ role: 'EDITOR' }), writeRateLimit, express.json({ limit: '5mb' }), handler(importer));
});
