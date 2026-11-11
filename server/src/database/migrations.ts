/**
 * Migrations do banco da aplicação (SQLite). Cada uma roda uma única vez, em
 * ordem, dentro de uma transação; o id fica gravado em `schema_migrations`.
 *
 * Nunca edite uma migration já aplicada em produção — crie a próxima.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 'V20261110120000__create_core_tables',
    sql: `
      CREATE TABLE platforms (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX uq_platforms_slug ON platforms (slug);

      -- Árvore de acessos: a raiz (PLATFORM) é o acesso à ferramenta; abaixo dela
      -- dashboards/aplicações; abaixo, abas/funcionalidades/papéis internos.
      CREATE TABLE resources (
        id INTEGER PRIMARY KEY,
        platform_id INTEGER NOT NULL REFERENCES platforms (id),
        parent_id INTEGER REFERENCES resources (id),
        resource_type TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        description TEXT NOT NULL DEFAULT '',
        owner TEXT NOT NULL DEFAULT '',
        is_access_controlled INTEGER NOT NULL DEFAULT 1,
        external_ref TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_resources_platform_id ON resources (platform_id);
      CREATE INDEX idx_resources_parent_id ON resources (parent_id);
      CREATE UNIQUE INDEX uq_resources_external_ref ON resources (platform_id, external_ref)
        WHERE external_ref IS NOT NULL AND deleted_at IS NULL;

      CREATE TABLE people (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL DEFAULT '',
        department TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX uq_people_email ON people (email);

      CREATE TABLE grants (
        id INTEGER PRIMARY KEY,
        resource_id INTEGER NOT NULL REFERENCES resources (id),
        person_id INTEGER NOT NULL REFERENCES people (id),
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
        access_level TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'PROTOCOL', 'IMPORT')),
        protocol_number TEXT,
        notes TEXT NOT NULL DEFAULT '',
        granted_by TEXT NOT NULL,
        granted_at TEXT NOT NULL,
        revoked_by TEXT,
        revoked_at TEXT,
        revoke_protocol_number TEXT,
        revoke_notes TEXT NOT NULL DEFAULT ''
      );
      CREATE UNIQUE INDEX uq_grants_active ON grants (resource_id, person_id) WHERE status = 'ACTIVE';
      CREATE INDEX idx_grants_person_id ON grants (person_id);
      CREATE INDEX idx_grants_protocol_number ON grants (protocol_number);
      CREATE INDEX idx_grants_revoke_protocol_number ON grants (revoke_protocol_number);

      -- Log de adições e remoções (e das mudanças no cadastro). Guarda um retrato
      -- legível (caminho do recurso, e-mail) para continuar fazendo sentido depois
      -- de renomeações e exclusões.
      CREATE TABLE access_events (
        id INTEGER PRIMARY KEY,
        event_type TEXT NOT NULL,
        platform_id INTEGER,
        resource_id INTEGER,
        person_id INTEGER,
        grant_id INTEGER,
        resource_path TEXT NOT NULL DEFAULT '',
        person_email TEXT NOT NULL DEFAULT '',
        protocol_number TEXT,
        actor_email TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_access_events_created_at ON access_events (created_at);
      CREATE INDEX idx_access_events_platform_id ON access_events (platform_id, created_at);
      CREATE INDEX idx_access_events_person_email ON access_events (person_email);

      -- O que é NOSSO sobre um protocolo do Voalle (o protocolo em si vem do ERP).
      CREATE TABLE protocol_trackings (
        protocol_number TEXT PRIMARY KEY,
        platform_slug TEXT,
        note TEXT NOT NULL DEFAULT '',
        is_handled INTEGER NOT NULL DEFAULT 0,
        handled_by TEXT,
        handled_at TEXT,
        updated_by TEXT,
        updated_at TEXT NOT NULL
      );

      -- Quem usa ESTA aplicação (o time).
      CREATE TABLE team_members (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
        last_seen_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX uq_team_members_email ON team_members (email);
    `,
  },
  {
    // Login no mesmo modelo da logisticDashboard: qualquer conta do domínio entra
    // como "Padrão" e um admin promove na tela de Administração.
    id: 'V20261111090000__create_app_users_from_team_members',
    sql: `
      CREATE TABLE app_users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL DEFAULT '',
        picture TEXT,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE UNIQUE INDEX uq_app_users_email ON app_users (email);
      INSERT INTO app_users (email, name, picture, role, first_seen_at, last_seen_at, last_login_at)
        SELECT email, name, NULL, role, created_at, COALESCE(last_seen_at, created_at), NULL FROM team_members;
      DROP TABLE team_members;
      UPDATE access_events SET event_type = 'USER_ROLE_CHANGED' WHERE event_type = 'TEAM_MEMBER_CHANGED';
    `,
  },
  {
    // A aba "Aplicações" passa a se chamar HUB APPS (nome, raiz e textos da
    // importação). O slug `aplicacoes` fica, para não quebrar links. O log
    // (access_events) é histórico e não é reescrito. Num banco novo não há
    // nada para trocar: o seed já nasce com o nome novo.
    id: 'V20261111150000__rename_aplicacoes_to_hub_apps',
    sql: `
      UPDATE platforms
         SET name = 'HUB APPS',
             description = 'Acesso ao hub, a cada aplicação e aos controles internos de cada uma.',
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE slug = 'aplicacoes' AND name = 'Aplicações';
      UPDATE resources
         SET name = 'Acesso ao HUB APPS', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE resource_type = 'PLATFORM' AND parent_id IS NULL AND name = 'Acesso ao HUB Apps'
         AND platform_id IN (SELECT id FROM platforms WHERE slug = 'aplicacoes');
      UPDATE resources
         SET description = REPLACE(description, 'HUB Apps', 'HUB APPS')
       WHERE description IN ('Importado do HUB Apps', 'Desativada no HUB Apps')
         AND platform_id IN (SELECT id FROM platforms WHERE slug = 'aplicacoes');
      UPDATE grants
         SET notes = REPLACE(notes, 'Importado do HUB Apps', 'Importado do HUB APPS')
       WHERE instr(notes, 'Importado do HUB Apps') = 1;
    `,
  },
  {
    // ordem das abas: HUB BI, HUB APPS, UpValue, AppSheet, DataHub
    id: 'V20261111170000__reorder_platform_tabs',
    sql: `
      UPDATE platforms
         SET sort_order = CASE slug
               WHEN 'hub-bi' THEN 0 WHEN 'aplicacoes' THEN 1 WHEN 'upvalue' THEN 2
               WHEN 'appsheet' THEN 3 WHEN 'datahub' THEN 4 ELSE sort_order END
       WHERE slug IN ('hub-bi', 'aplicacoes', 'upvalue', 'appsheet', 'datahub');
    `,
  },
];

/** Plataformas de fábrica — uma aba para cada. A raiz de cada uma é criada junto. */
export const SEED_PLATFORMS = [
  {
    slug: 'hub-bi',
    name: 'HUB BI',
    description: 'Dashboards de BI: acesso ao hub, a cada dashboard e, quando houver, às abas internas.',
    rootName: 'Acesso ao HUB BI',
  },
  {
    slug: 'aplicacoes',
    name: 'HUB APPS',
    description: 'Acesso ao hub, a cada aplicação e aos controles internos de cada uma.',
    rootName: 'Acesso ao HUB APPS',
  },
  {
    slug: 'upvalue',
    name: 'UpValue',
    description: 'Acesso à ferramenta UpValue e a cada dashboard dela.',
    rootName: 'Acesso ao UpValue',
  },
  {
    slug: 'appsheet',
    name: 'AppSheet',
    description: 'Aplicativos AppSheet e seus controles internos.',
    rootName: 'Acesso ao AppSheet',
  },
  {
    slug: 'datahub',
    name: 'DataHub',
    description: 'Data Hub Sebratel: conjuntos de dados, dashboards e permissões internas.',
    rootName: 'Acesso ao DataHub',
  },
] as const;
