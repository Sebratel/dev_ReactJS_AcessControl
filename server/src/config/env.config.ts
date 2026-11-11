import { existsSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Carga das variáveis de ambiente — mesmo desenho das dashboards irmãs.
 *
 * Ordem de procura (o primeiro valor encontrado vence; dotenv nunca sobrescreve
 * o que já está no ambiente, então o Docker/Portainer sempre ganha):
 *
 *   1. `ENV_FILE`, quando definido;
 *   2. `.env` na raiz do projeto e em `server/`;
 *   3. FORA de produção, os `.env` dos diretórios acima do projeto (o `.env`
 *      compartilhado da pasta de trabalho, onde ficam as credenciais de dev).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// src/config (ou dist/config) -> server -> raiz do projeto
const SERVER_ROOT = resolve(HERE, '..', '..');
const PROJECT_ROOT = resolve(SERVER_ROOT, '..');

function envFileCandidates(): string[] {
  const files: string[] = [];
  if (process.env.ENV_FILE) files.push(resolve(process.env.ENV_FILE));
  files.push(join(PROJECT_ROOT, '.env'), join(SERVER_ROOT, '.env'));
  if (process.env.NODE_ENV !== 'production') {
    let dir = dirname(PROJECT_ROOT);
    const { root } = parse(dir);
    while (dir && dir !== root) {
      files.push(join(dir, '.env'));
      dir = dirname(dir);
    }
  }
  return files;
}

const loadedEnvFiles: string[] = [];
for (const file of envFileCandidates()) {
  if (existsSync(file)) {
    dotenv.config({ path: file, quiet: true } as dotenv.DotenvConfigOptions);
    loadedEnvFiles.push(file);
  }
}

/** Lê a primeira variável definida (e não vazia) de uma lista de nomes alternativos. */
function pick(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value.trim() !== '') return value.trim();
  }
  return undefined;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD');
const booleanFlag = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : !['false', '0', 'no', 'off'].includes(v.toLowerCase())));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8095),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  PUBLIC_DIR: z.string().optional(),

  // Voalle (PostgreSQL) — o "db_elleven". Somente leitura.
  DB_VOALLE_HOST: z.string().optional(),
  DB_VOALLE_PORT: z.coerce.number().int().default(5432),
  DB_VOALLE_DATABASE: z.string().optional(),
  DB_VOALLE_USER: z.string().optional(),
  DB_VOALLE_PASSWORD: z.string().optional(),
  DB_VOALLE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/i).optional(),
  DB_VOALLE_SSL: booleanFlag,
  DB_VOALLE_POOL_MAX: z.coerce.number().int().min(1).max(5).default(2),
  QUERY_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(60_000),

  // Fila de protocolos: releitura do Voalle (a consulta leva ~50 ms; piso de 15 s protege o ERP)
  PROTOCOLS_REFRESH_MS: z.coerce.number().int().min(15_000).default(180_000),
  // recorte de data dos protocolos (o mesmo da consulta original)
  PROTOCOLS_SINCE: isoDate.default('2026-01-01'),
  // categoria 1 do Voalle que define a fila
  PROTOCOLS_CATEGORY: z.string().min(1).default('Gestão de Acessos'),

  // Onde a aplicação grava o banco dela (SQLite). No Docker, um volume.
  DATA_PATH: z.string().optional(),

  // Integração direta com os hubs — SOMENTE LEITURA. Sem as credenciais, fica
  // desligada e as telas seguem com importação de export e cadastro manual.
  // HUB APPS: o MySQL do hub (DB_Hub_Apps). Use um usuário só com SELECT.
  HUB_APPS_DB_HOST: z.string().optional(),
  HUB_APPS_DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  HUB_APPS_DB_NAME: z.string().default('DB_Hub_Apps'),
  HUB_APPS_DB_USER: z.string().optional(),
  HUB_APPS_DB_PASSWORD: z.string().optional(),
  HUB_APPS_DB_SSL: booleanFlag,
  // DATETIME do hub é gravado no horário de Brasília (como o hub-api lê)
  HUB_APPS_DB_TIMEZONE: z.string().regex(/^[+-]\d{2}:\d{2}$/).default('-03:00'),
  // HUB BI: o Firestore do hub, com uma conta de serviço (papel "Cloud Datastore Viewer").
  // Ou o caminho do JSON da conta, ou o e-mail + a chave privada dela.
  HUB_BI_FIREBASE_CREDENTIALS_FILE: z.string().optional(),
  HUB_BI_FIREBASE_PROJECT_ID: z.string().optional(),
  HUB_BI_FIREBASE_CLIENT_EMAIL: z.string().optional(),
  HUB_BI_FIREBASE_PRIVATE_KEY: z.string().optional(),
  // de quanto em quanto tempo sincroniza (0 = só pelo botão). No Firestore cada
  // documento lido é cobrado: ~1 mil leituras por sincronização do HUB BI.
  HUB_SYNC_INTERVAL_MS: z.coerce.number().int().min(0).default(900_000)
    .refine((v) => v === 0 || v >= 60_000, 'use 0 (só manual) ou pelo menos 60000 (1 min)'),

  // Login com Google (mesmo projeto OAuth das outras dashboards)
  AUTH_ENABLED: booleanFlag,
  GOOGLE_CLIENT_ID: z.string().optional(),
  ALLOWED_DOMAIN: z.string().default('sebratel.com.br'),
  // Admin(s) de fábrica: só valem enquanto não houver NENHUM admin no cadastro da equipe.
  ADMIN_EMAILS: z.string().optional().transform((v) => (v?.trim() ? v : 'gustavo.santos@sebratel.com.br')),
});

const parsed = EnvSchema.safeParse({
  ...process.env,
  // só PORT: o API_PORT do .env compartilhado é de outro projeto
  PORT: pick('ACCESS_CONTROL_PORT', 'PORT'),
  DB_VOALLE_HOST: pick('DB_VOALLE_HOST', 'DB_ELLEVEN_HOST'),
  DB_VOALLE_PORT: pick('DB_VOALLE_PORT', 'DB_ELLEVEN_PORT'),
  DB_VOALLE_DATABASE: pick('DB_VOALLE_DATABASE', 'DB_ELLEVEN_DATABASE'),
  DB_VOALLE_USER: pick('DB_VOALLE_USER', 'DB_ELLEVEN_USER'),
  DB_VOALLE_PASSWORD: pick('DB_VOALLE_PASSWORD', 'DB_ELLEVEN_PASSWORD'),
  DB_VOALLE_SCHEMA: pick('DB_VOALLE_SCHEMA', 'DB_ELLEVEN_SCHEMA'),
  DB_VOALLE_SSL: pick('DB_VOALLE_SSL', 'DB_ELLEVEN_SSL'),
  // o ID do cliente OAuth é público; aceitar o nome VITE_ evita duplicar a chave
  GOOGLE_CLIENT_ID: pick('GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID'),
});

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Variáveis de ambiente inválidas — ${problems}`);
}

const env = parsed.data;

const emailList = (value: string): string[] => value.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

const authRequested = env.AUTH_ENABLED !== false;

export const appConfig = {
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  host: env.HOST,
  trustProxy: env.TRUST_PROXY,
  publicDir: env.PUBLIC_DIR ? resolve(env.PUBLIC_DIR) : join(SERVER_ROOT, 'public'),
  dataPath: env.DATA_PATH ? resolve(env.DATA_PATH) : join(SERVER_ROOT, 'data'),
  loadedEnvFiles,
  voalle: {
    host: env.DB_VOALLE_HOST,
    port: env.DB_VOALLE_PORT,
    database: env.DB_VOALLE_DATABASE,
    user: env.DB_VOALLE_USER,
    password: env.DB_VOALLE_PASSWORD,
    schema: env.DB_VOALLE_SCHEMA,
    ssl: env.DB_VOALLE_SSL === true,
    poolMax: env.DB_VOALLE_POOL_MAX,
    queryTimeoutMs: env.QUERY_TIMEOUT_MS,
  },
  protocols: {
    refreshMs: env.PROTOCOLS_REFRESH_MS,
    since: env.PROTOCOLS_SINCE,
    category: env.PROTOCOLS_CATEGORY,
  },
  auth: {
    /** pediu login (padrão) — mesmo que falte o client id */
    requested: authRequested,
    /** login realmente ativo: pedido E configurado */
    enabled: authRequested && Boolean(env.GOOGLE_CLIENT_ID),
    clientId: env.GOOGLE_CLIENT_ID ?? '',
    allowedDomain: env.ALLOWED_DOMAIN.trim().toLowerCase(),
    bootstrapAdmins: emailList(env.ADMIN_EMAILS),
  },
  integrations: {
    intervalMs: env.HUB_SYNC_INTERVAL_MS,
    hubApps: {
      host: env.HUB_APPS_DB_HOST,
      port: env.HUB_APPS_DB_PORT,
      database: env.HUB_APPS_DB_NAME,
      user: env.HUB_APPS_DB_USER,
      password: env.HUB_APPS_DB_PASSWORD,
      ssl: env.HUB_APPS_DB_SSL === true,
      timezone: env.HUB_APPS_DB_TIMEZONE,
    },
    hubBi: {
      credentialsFile: env.HUB_BI_FIREBASE_CREDENTIALS_FILE ? resolve(env.HUB_BI_FIREBASE_CREDENTIALS_FILE) : undefined,
      projectId: env.HUB_BI_FIREBASE_PROJECT_ID,
      clientEmail: env.HUB_BI_FIREBASE_CLIENT_EMAIL,
      // no .env a chave vem numa linha só, com "\n" escrito no lugar das quebras
      privateKey: env.HUB_BI_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  },
} as const;

export const hasVoalle = Boolean(appConfig.voalle.host && appConfig.voalle.database && appConfig.voalle.user);
export const hasHubApps = Boolean(appConfig.integrations.hubApps.host && appConfig.integrations.hubApps.user);
export const hasHubBi = Boolean(
  appConfig.integrations.hubBi.credentialsFile
  || (appConfig.integrations.hubBi.clientEmail && appConfig.integrations.hubBi.privateKey && appConfig.integrations.hubBi.projectId),
);
