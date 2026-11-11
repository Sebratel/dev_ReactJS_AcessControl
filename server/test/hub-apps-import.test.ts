import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'false';

const { initDatabase } = await import('../src/database/app-database.js');
const { parseHubAppsExport } = await import('../src/modules/imports/hub-apps.parser.js');
const { importHubAppsExport } = await import('../src/modules/imports/hub-apps-import.service.js');
const { findPlatformBySlug, listPlatforms } = await import('../src/modules/platforms/platforms.repository.js');
const { listGrants } = await import('../src/modules/grants/grants.repository.js');
const { listResourceNodes } = await import('../src/modules/resources/resources.repository.js');
const { findPersonByEmail } = await import('../src/modules/people/people.repository.js');
const { AppException } = await import('../src/common/errors/app.exception.js');

const actor = { email: 'gustavo.santos@sebratel.com.br' };
type Row = (string | null)[];

const USERS = {
  header: ['id', 'name', 'email', 'perfil', 'equipe', 'is_admin', 'ativo', 'cadastrado_em', 'ultimo_acesso'],
  rows: [
    ['u1', 'Ana Souza', 'Ana@Sebratel.com.br', 'tecnica', 'Suporte', '0', '1', '07/02/2026', '25/09/2026 04:41'],
    ['u2', '‎ ‎', 'diego.teste@sebratel.com.br', 'tecnica', 'Suporte', '0', '1', '07/02/2026', ''],
    ['u3', 'Bruno Admin', 'bruno@sebratel.com.br', 'tecnica', 'Desenvolvimento', '1', '1', '10/06/2026', ''],
    ['u4', 'Alex Inativo', 'alex@sebratel.com.br', 'tecnica', 'Suporte', '0', '0', '26/01/2026', ''],
    ['u5', 'Só Hub', 'sohub@sebratel.com.br', '', '', '0', '1', '01/03/2026', ''],
  ] as Row[],
};
const APPS = {
  header: ['id', 'name', 'url', 'ativo', 'cadastrado_em'],
  rows: [
    ['app-chamados', 'Controle de Chamados', 'https://chamados.sebratel.com.br', '0', '03/07/2026'],
    ['app-splitters', 'Monitoramento Splitters', 'https://splitters.sebratel.net.br/', '1', '11/06/2026'],
  ] as Row[],
};
const ACCESSES = {
  header: ['usuario', 'email', 'perfil', 'equipe', 'app', 'url', 'motivo_acesso'],
  rows: [
    ['Ana Souza', 'ana@sebratel.com.br', 'tecnica', 'Suporte', 'Controle de Chamados', 'https://chamados.sebratel.com.br', 'perfil'],
    ['Ana Souza', 'ana@sebratel.com.br', 'tecnica', 'Suporte', 'Monitoramento Splitters', 'https://splitters.sebratel.net.br/', 'equipe+perfil'],
    ['‎ ‎', 'diego.teste@sebratel.com.br', 'tecnica', 'Suporte', 'Monitoramento Splitters', 'x', 'usuario_direto'],
    ['Bruno Admin', 'bruno@sebratel.com.br', 'tecnica', 'Desenvolvimento', 'Monitoramento Splitters', 'x', 'perfil'],
    ['Alex Inativo', 'alex@sebratel.com.br', 'tecnica', 'Suporte', 'Monitoramento Splitters', 'x', 'perfil'],
  ] as Row[],
};
const BY_APP = { header: ['app', 'url', 'total_usuarios', 'usuarios'], rows: [['Monitoramento Splitters', 'x', '3', 'Ana Souza | Bruno Admin']] as Row[] };

const run = (tables: { header: string[]; rows: Row[] }[], options = { dryRun: false, revokeMissing: false }) =>
  importHubAppsExport(parseHubAppsExport(tables), options, actor);
const apps = () => findPlatformBySlug('aplicacoes')!;

describe('leitura dos exports do HUB APPS', () => {
  it('reconhece cada arquivo pelas colunas, em qualquer ordem, e ignora o "por app"', () => {
    const parsed = parseHubAppsExport([BY_APP, ACCESSES, APPS, USERS]);
    assert.equal(parsed.records.length, 4);
    assert.equal(parsed.items!.length, 2);
    assert.equal(parsed.members!.length, 4);
    assert.ok(parsed.notices!.some((n) => n.includes('Usuários por app')));
  });

  it('inativo no HUB fica de fora (acesso e hub); nome só com caracteres invisíveis vira vazio; motivo vira observação', () => {
    const parsed = parseHubAppsExport([USERS, APPS, ACCESSES]);
    assert.ok(parsed.ignored.some((i) => /alex@sebratel.com.br está inativo/.test(i.reason)));
    assert.ok(!parsed.members!.some((m) => m.email === 'alex@sebratel.com.br'));
    assert.equal(parsed.members!.find((m) => m.email === 'diego.teste@sebratel.com.br')!.userName, null);
    assert.equal(parsed.members!.find((m) => m.email === 'bruno@sebratel.com.br')!.rootLevel, 'Admin');
    assert.equal(parsed.members!.find((m) => m.email === 'ana@sebratel.com.br')!.rootLevel, 'Técnica');
    assert.equal(parsed.records.find((r) => r.email === 'diego.teste@sebratel.com.br')!.note, 'via usuário direto');
    assert.equal(parsed.records.find((r) => r.resourceKey === 'app-splitters' && r.email === 'ana@sebratel.com.br')!.note, 'via equipe + perfil');
  });

  it('sem o export de acessos é 422; arquivo desconhecido é 422', () => {
    assert.throws(() => parseHubAppsExport([USERS, APPS]), (err: unknown) => err instanceof AppException && err.status === 422);
    assert.throws(
      () => parseHubAppsExport([ACCESSES, { header: ['foo', 'bar'], rows: [] }]),
      (err: unknown) => err instanceof AppException && err.code === 'IMPORT_TABLE_UNKNOWN',
    );
  });
});

describe('importação do HUB APPS', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  it('aplicações viram itens com link; usuário ativo ganha o hub (Admin ou perfil), mesmo sem aplicação', () => {
    const summary = run([USERS, APPS, ACCESSES]);
    assert.deepEqual(summary.dashboards.created.sort(), ['Controle de Chamados', 'Monitoramento Splitters']);
    assert.equal(summary.hubAccess.created, 4); // Ana, Gustavo, Bruno, Só Hub
    assert.equal(summary.grants.created, 4);
    const nodes = listResourceNodes(apps().id);
    const chamados = nodes.find((n) => n.externalRef === 'app-chamados')!;
    assert.equal(chamados.resourceType, 'APPLICATION');
    assert.equal(chamados.url, 'https://chamados.sebratel.com.br');
    assert.equal(chamados.description, 'Desativada no HUB APPS');
    const root = listGrants({ status: 'ACTIVE' }).filter((g) => g.resourceParentId === null);
    assert.equal(root.find((g) => g.personEmail === 'bruno@sebratel.com.br')!.accessLevel, 'Admin');
    assert.ok(root.some((g) => g.personEmail === 'sohub@sebratel.com.br'));
    assert.equal(findPersonByEmail('ana@sebratel.com.br')!.department, 'Suporte');
    const via = listGrants({ status: 'ACTIVE' }).find((g) => g.personEmail === 'diego.teste@sebratel.com.br' && g.resourceParentId !== null)!;
    assert.equal(via.notes, 'Importado do HUB APPS (via usuário direto)');
  });

  it('importar de novo não muda nada', () => {
    run([USERS, APPS, ACCESSES]);
    const again = run([USERS, APPS, ACCESSES]);
    assert.equal(again.grants.created + again.hubAccess.created + again.dashboards.created.length + again.people.created, 0);
    assert.equal(again.notInExport.total, 0);
  });

  it('usuário que sumiu do export de usuários aparece em "não consta" (hub e aplicações)', () => {
    run([USERS, APPS, ACCESSES]);
    const withoutAna = {
      users: { ...USERS, rows: USERS.rows.filter((r) => r[0] !== 'u1') },
      accesses: { ...ACCESSES, rows: ACCESSES.rows.filter((r) => r[1] !== 'ana@sebratel.com.br') },
    };
    const preview = run([withoutAna.users, APPS, withoutAna.accesses], { dryRun: true, revokeMissing: false });
    assert.equal(preview.notInExport.total, 3); // hub + 2 aplicações
  });
});

describe('troca do nome "Aplicações" para HUB APPS', () => {
  it('banco antigo: a migration renomeia a aba, a raiz e os textos da importação; o slug fica', async () => {
    const db = initDatabase(':memory:');
    run([USERS, APPS, ACCESSES]);
    // volta o banco ao estado de antes da troca
    db.exec(`
      UPDATE platforms SET name = 'Aplicações', description = 'HUB Apps: acesso ao hub, a cada aplicação e aos controles internos de cada uma.' WHERE slug = 'aplicacoes';
      UPDATE resources SET name = 'Acesso ao HUB Apps' WHERE resource_type = 'PLATFORM' AND name = 'Acesso ao HUB APPS';
      UPDATE resources SET description = REPLACE(description, 'HUB APPS', 'HUB Apps');
      UPDATE grants SET notes = REPLACE(notes, 'HUB APPS', 'HUB Apps');
    `);
    const { MIGRATIONS } = await import('../src/database/migrations.js');
    db.exec(MIGRATIONS.find((m) => m.id === 'V20261111150000__rename_aplicacoes_to_hub_apps')!.sql);

    assert.equal(apps().name, 'HUB APPS');
    const nodes = listResourceNodes(apps().id);
    assert.equal(nodes.find((n) => n.parentId === null)!.name, 'Acesso ao HUB APPS');
    assert.equal(nodes.find((n) => n.externalRef === 'app-chamados')!.description, 'Desativada no HUB APPS');
    assert.ok(listGrants({ status: 'ACTIVE' }).every((g) => !g.notes.includes('HUB Apps')));
  });
});

describe('ordem das abas das plataformas', () => {
  const ORDER = ['hub-bi', 'aplicacoes', 'upvalue', 'appsheet', 'datahub'];

  it('banco novo já nasce na ordem HUB BI, HUB APPS, UpValue, AppSheet, DataHub', () => {
    initDatabase(':memory:');
    assert.deepEqual(listPlatforms().map((p) => p.slug), ORDER);
  });

  it('banco antigo: a migration reordena', async () => {
    const db = initDatabase(':memory:');
    db.exec(`UPDATE platforms SET sort_order = CASE slug WHEN 'hub-bi' THEN 0 WHEN 'datahub' THEN 1 WHEN 'aplicacoes' THEN 2 WHEN 'appsheet' THEN 3 ELSE 4 END`);
    const { MIGRATIONS } = await import('../src/database/migrations.js');
    db.exec(MIGRATIONS.find((m) => m.id === 'V20261111170000__reorder_platform_tabs')!.sql);
    assert.deepEqual(listPlatforms().map((p) => p.slug), ORDER);
  });
});
