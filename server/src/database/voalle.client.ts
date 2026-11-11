import pg from 'pg';
import { appConfig, hasVoalle } from '../config/env.config.js';
import { logger } from '../common/helpers/logger.helper.js';

/**
 * Cliente do Voalle (db_elleven — PostgreSQL de produção de OUTRO sistema).
 *
 * Mesmos cuidados das dashboards irmãs, todos contra o risco de atrapalhar o ERP:
 *   - pool pequeno (padrão 2): a fila de protocolos é UMA consulta leve;
 *   - toda consulta roda em `BEGIN READ ONLY` — nem por engano esta aplicação escreve lá;
 *   - `application_name` próprio, para reconhecer a carga no pg_stat_activity.
 */

// timestamps chegam como texto: a conversão para ISO UTC é feita no repositório
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!hasVoalle) throw new Error('Voalle não configurado (DB_VOALLE_* / DB_ELLEVEN_*)');
  if (!pool) {
    const { voalle } = appConfig;
    pool = new pg.Pool({
      host: voalle.host,
      port: voalle.port,
      database: voalle.database,
      user: voalle.user,
      password: voalle.password,
      max: voalle.poolMax,
      // com TLS ligado o certificado é verificado — sem atalho de aceitar qualquer um
      ssl: voalle.ssl ? { rejectUnauthorized: true } : undefined,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      keepAlive: true,
      application_name: 'access-control',
      ...(voalle.schema ? { options: `-c search_path=${voalle.schema}` } : {}),
    });
    pool.on('error', (err) => logger.error('voalle', `erro no pool: ${err.message}`));
  }
  return pool;
}

/**
 * Consulta de leitura com teto de tempo próprio. Conexão que cai no meio da
 * consulta é descartada (não volta ao pool) e o erro vira falha da consulta,
 * nunca exceção não capturada.
 */
export async function queryVoalle<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await getPool().connect();
  let broken: Error | undefined;
  const onError = (err: Error) => {
    broken = err;
    logger.warn('voalle', `conexão caiu durante a consulta: ${err.message}`);
  };
  client.on('error', onError);
  let discard: Error | undefined;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${Math.max(1000, Math.round(appConfig.voalle.queryTimeoutMs))}`);
    const result = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    if (!broken) await client.query('ROLLBACK').catch((e: Error) => { discard = e; });
    throw err;
  } finally {
    if (!broken) client.removeListener('error', onError);
    client.release(broken ?? discard);
  }
}

export async function closeVoalle(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
