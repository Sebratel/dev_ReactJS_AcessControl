import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'false';

const { initDatabase } = await import('../src/database/app-database.js');
const { parseHubBiPermissions } = await import('../src/modules/imports/hub-bi-permissions.parser.js');
const { importHubBiPermissions } = await import('../src/modules/imports/hub-bi-import.service.js');
const { createResource } = await import('../src/modules/resources/resources.service.js');
const { grantAccess } = await import('../src/modules/grants/grants.service.js');
const { findPlatformBySlug } = await import('../src/modules/platforms/platforms.repository.js');
const { listGrants } = await import('../src/modules/grants/grants.repository.js');
const { listResourceNodes } = await import('../src/modules/resources/resources.repository.js');
const { listAccessEvents } = await import('../src/modules/access-events/access-events.repository.js');
const { AppException } = await import('../src/common/errors/app.exception.js');

const actor = { email: 'gustavo.santos@sebratel.com.br' };
const HEADER = ['id_dashboard', 'dashboard', 'email', 'usuario', 'nivel_usuario', 'ativa', 'criado_em', 'atualizado_em', 'id_permissao'];

type Row = (string | boolean | null)[];
const row = (dash: string, name: string, email: string, user: string | null, role: string | null, created = '2026-03-10T19:44:55.975Z'): Row =>
  [dash, name, email, user, role, true, created, created, `perm-${dash}-${email}`];

const BASE: Row[] = [
  row('d1', 'COM - Gestão Comercial', 'ana@sebratel.com.br', 'Ana', 'User'),
  row('d1', 'COM - Gestão Comercial', 'bia@sebratel.com.br', 'Bia', 'Admin'),
  row('d2', 'LOG - Saldo de Patrimônios', 'Ana@Sebratel.com.br', 'Ana', 'User'),
  row('d2', 'LOG - Saldo de Patrimônios', 'caio@sebratel.com.br', null, null),
];

const run = (rows: Row[], options = { dryRun: false, revokeMissing: false }) =>
  importHubBiPermissions(parseHubBiPermissions({ header: HEADER, rows }), options, actor);

const hubBi = () => findPlatformBySlug('hub-bi')!;

describe('leitura do export do HUB BI', () => {
  it('sem as colunas obrigatórias é 422 dizendo quais faltam', () => {
    assert.throws(
      () => parseHubBiPermissions({ header: ['dashboard', 'usuario'], rows: [] }),
      (err: unknown) => err instanceof AppException && err.status === 422 && /id_dashboard.*email/.test(err.message),
    );
  });

  it('ignora inativas, e-mail inválido e repetidas (inclusive por maiúscula), com o número da linha', () => {
    const parsed = parseHubBiPermissions({
      header: HEADER,
      rows: [
        row('d1', 'Dash', 'ana@sebratel.com.br', 'Ana', 'User'),
        ['d1', 'Dash', 'ANA@sebratel.com.br', 'Ana', 'User', true, null, null, 'x'],
        ['d1', 'Dash', 'bia@sebratel.com.br', 'Bia', 'User', false, null, null, 'y'],
        ['d1', 'Dash', 'não-é-email', null, null, true, null, null, 'z'],
        [null, null, null, null, null, null, null, null, null],
      ],
    });
    assert.equal(parsed.records.length, 1);
    assert.equal(parsed.rowsRead, 4);
    assert.deepEqual(parsed.ignored.map((i) => i.rowNumber), [3, 4, 5]);
    assert.match(parsed.ignored[0]!.reason, /repetida/);
    assert.match(parsed.ignored[1]!.reason, /inativa/);
  });
});

describe('importação do HUB BI', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  it('prévia (dryRun) calcula tudo e não grava nada', () => {
    const preview = run(BASE, { dryRun: true, revokeMissing: false });
    assert.equal(preview.applied, false);
    assert.deepEqual(preview.dashboards.created, ['COM - Gestão Comercial', 'LOG - Saldo de Patrimônios']);
    assert.equal(preview.grants.created, 4);
    assert.equal(listGrants({}).length, 0);
    assert.equal(listResourceNodes(hubBi().id).length, 1); // só a raiz
    assert.equal(listAccessEvents({ page: 1, pageSize: 10 }).totalItems, 0);
  });

  it('cria dashboards, pessoas, acesso ao hub com o nível e acessos com a data original', () => {
    const summary = run(BASE);
    assert.equal(summary.applied, true);
    assert.equal(summary.people.created, 3);
    assert.equal(summary.people.withoutHubAccount, 1);
    assert.equal(summary.hubAccess.created, 2);
    const grants = listGrants({ status: 'ACTIVE' });
    const root = grants.filter((g) => g.resourceParentId === null);
    assert.deepEqual(root.map((g) => `${g.personEmail}:${g.accessLevel}`).sort(), ['ana@sebratel.com.br:User', 'bia@sebratel.com.br:Admin']);
    const anaDash = grants.filter((g) => g.personEmail === 'ana@sebratel.com.br' && g.resourceParentId !== null);
    assert.equal(anaDash.length, 2);
    assert.ok(anaDash.every((g) => g.source === 'IMPORT' && g.grantedAt === '2026-03-10T19:44:55.975Z'));
    assert.equal(listAccessEvents({ eventTypes: ['IMPORT_APPLIED'], page: 1, pageSize: 5 }).totalItems, 1);
  });

  it('importar o mesmo arquivo de novo não muda nada', () => {
    run(BASE);
    const again = run(BASE);
    assert.equal(again.grants.created, 0);
    assert.equal(again.hubAccess.created, 0);
    assert.equal(again.dashboards.created.length, 0);
    assert.equal(again.dashboards.unchanged, 2);
    assert.equal(listGrants({ status: 'ACTIVE' }).length, 6);
  });

  it('liga ao dashboard cadastrado à mão com o mesmo nome (sem acento/caixa) em vez de duplicar', () => {
    const manual = createResource({ parentId: hubBi().rootResourceId, resourceType: 'DASHBOARD', name: 'com - gestao comercial', url: 'https://x', description: '', owner: '', isAccessControlled: true }, actor);
    const summary = run(BASE);
    assert.deepEqual(summary.dashboards.linked, ['COM - Gestão Comercial']);
    const node = listResourceNodes(hubBi().id).find((n) => n.id === manual.id)!;
    assert.equal(node.externalRef, 'd1');
    assert.equal(node.url, 'https://x');
  });

  it('dashboard renomeado no HUB é renomeado aqui', () => {
    run(BASE);
    const renamed = BASE.map((r) => (r[0] === 'd1' ? [r[0], 'COM - Gestão Comercial (Nova)', ...r.slice(2)] : r));
    const summary = run(renamed);
    assert.deepEqual(summary.dashboards.renamed, [{ from: 'COM - Gestão Comercial', to: 'COM - Gestão Comercial (Nova)' }]);
  });

  it('nível no hub alterado (User -> Admin) atualiza o acesso à raiz', () => {
    run(BASE);
    const promoted = BASE.map((r) => (r[2] === 'ana@sebratel.com.br' ? [...r.slice(0, 4), 'Admin', ...r.slice(5)] : r));
    const summary = run(promoted);
    assert.equal(summary.hubAccess.updated, 1);
    const root = listGrants({ status: 'ACTIVE' }).find((g) => g.personEmail === 'ana@sebratel.com.br' && g.resourceParentId === null)!;
    assert.equal(root.accessLevel, 'Admin');
  });

  it('acesso registrado aqui que sumiu do export é apontado e só sai se pedirem', () => {
    run(BASE);
    const withoutCaio = BASE.filter((r) => r[2] !== 'caio@sebratel.com.br');
    const preview = run(withoutCaio, { dryRun: true, revokeMissing: true });
    assert.equal(preview.notInExport.total, 1);
    assert.equal(preview.notInExport.sample[0]!.personEmail, 'caio@sebratel.com.br');

    const kept = run(withoutCaio);
    assert.equal(kept.notInExport.revoked, 0);
    assert.ok(listGrants({ status: 'ACTIVE' }).some((g) => g.personEmail === 'caio@sebratel.com.br'));

    const removed = run(withoutCaio, { dryRun: false, revokeMissing: true });
    assert.equal(removed.notInExport.revoked, 1);
    assert.ok(!listGrants({ status: 'ACTIVE' }).some((g) => g.personEmail === 'caio@sebratel.com.br'));
  });

  it('abas cadastradas aqui e acesso ao hub nunca são removidos pela importação', () => {
    run(BASE);
    const dash = listResourceNodes(hubBi().id).find((n) => n.externalRef === 'd1')!;
    const tab = createResource({ parentId: dash.id, resourceType: 'TAB', name: 'Aba Metas', url: null, description: '', owner: '', isAccessControlled: true }, actor);
    grantAccess({ email: 'ana@sebratel.com.br', resourceIds: [tab.id], includeAncestors: false, accessLevel: '', protocolNumber: null, notes: '', source: 'MANUAL' }, actor);
    const summary = run(BASE, { dryRun: false, revokeMissing: true });
    assert.equal(summary.notInExport.total, 0);
    assert.ok(listGrants({ status: 'ACTIVE' }).some((g) => g.resourceId === tab.id));
  });
});
