import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'false';

const { initDatabase } = await import('../src/database/app-database.js');
const { hubAppsTables, jsonList } = await import('../src/modules/integrations/hub-apps.source.js');
const { hubBiImport } = await import('../src/modules/integrations/hub-bi.source.js');
const { parseHubAppsExport } = await import('../src/modules/imports/hub-apps.parser.js');
const {
  describeError, listIntegrationStatus, setIntegrationLoaderForTests, syncIntegration, SYSTEM_ACTOR,
} = await import('../src/modules/integrations/integrations.service.js');
const { findPlatformBySlug } = await import('../src/modules/platforms/platforms.repository.js');
const { listGrants } = await import('../src/modules/grants/grants.repository.js');
const { grantAccess } = await import('../src/modules/grants/grants.service.js');
const { listResourceNodes } = await import('../src/modules/resources/resources.repository.js');
const { listAccessEvents } = await import('../src/modules/access-events/access-events.repository.js');
const { AppException } = await import('../src/common/errors/app.exception.js');

type HubAppsSnapshot = Parameters<typeof hubAppsTables>[0];
type HubBiSnapshot = Parameters<typeof hubBiImport>[0];

const actor = { email: 'gustavo.santos@sebratel.com.br' };
const day = (s: string) => new Date(`${s}T12:00:00-03:00`);

const appsSnapshot = (): HubAppsSnapshot => ({
  teams: [{ id: 't-sup', name: 'Suporte' }],
  users: [
    { id: 'u1', name: 'Ana', email: 'Ana@sebratel.com.br', profile: 'tecnica', team: 't-sup', isAdmin: false, isActive: true, createdAt: day('2026-02-07') },
    { id: 'u2', name: 'Bruno', email: 'bruno@sebratel.com.br', profile: 'comercial', team: null, isAdmin: true, isActive: true, createdAt: day('2026-03-01') },
    { id: 'u3', name: 'Caio', email: 'caio@sebratel.com.br', profile: 'tecnica', team: 't-sup', isAdmin: false, isActive: false, createdAt: null },
  ],
  apps: [
    { id: 'a-split', name: 'Splitters', url: 'https://splitters.sebratel.net.br', isActive: true, allowedUsers: ['u2'], allowedTeams: ['t-sup'], allowedProfiles: ['tecnica'] },
    { id: 'a-isa', name: 'ISA', url: 'https://isa.sebratel.net.br', isActive: true, allowedUsers: [], allowedTeams: [], allowedProfiles: [] },
  ],
});

describe('HUB APPS direto do banco: a regra do hub vira as tabelas do export', () => {
  it('usuário direto, equipe e perfil viram o motivo; inativo não entra; app sem regra é aberta a todos', () => {
    const [users, apps, accesses] = hubAppsTables(appsSnapshot());
    assert.deepEqual(users!.rows[0], ['u1', 'Ana', 'ana@sebratel.com.br', 'tecnica', 'Suporte', '0', '1', '07/02/2026']);
    assert.deepEqual(apps!.rows.map((r) => [r[0], r[4]]), [['a-split', '0'], ['a-isa', '1']]);
    assert.deepEqual(accesses!.rows.map((r) => [r[1], r[4], r[6]]), [
      ['ana@sebratel.com.br', 'Splitters', 'equipe+perfil'],
      ['bruno@sebratel.com.br', 'Splitters', 'usuario_direto'],
    ]);
  });

  it('o leitor do export entende as tabelas: casa pelo id da app e marca a aberta a todos', () => {
    const parsed = parseHubAppsExport(hubAppsTables(appsSnapshot()));
    assert.deepEqual(parsed.records.map((r) => [r.email, r.resourceKey, r.note]), [
      ['ana@sebratel.com.br', 'a-split', 'via equipe + perfil'],
      ['bruno@sebratel.com.br', 'a-split', 'via usuário direto'],
    ]);
    assert.equal(parsed.items!.find((i) => i.key === 'a-isa')!.accessControlled, false);
    assert.equal(parsed.members!.find((m) => m.email === 'bruno@sebratel.com.br')!.rootLevel, 'Admin');
  });

  it('listas JSON chegam como array (MySQL) ou texto (MariaDB); lixo vira lista vazia', () => {
    assert.deepEqual(jsonList(['a', 1]), ['a', '1']);
    assert.deepEqual(jsonList('["x","y"]'), ['x', 'y']);
    assert.deepEqual(jsonList('{"a":1}'), []);
    assert.deepEqual(jsonList('não é json'), []);
    assert.deepEqual(jsonList(null), []);
  });
});

const biSnapshot = (): HubBiSnapshot => ({
  dashboards: [
    { id: 'd1', title: 'Atendimento', url: 'https://storage.example.com/d1.html', description: 'HSM' },
    { id: 'd2', title: 'Vendas', url: 'javascript:alert(1)', description: null },
  ],
  accesses: [
    { id: 'p1', dashboardId: 'd1', email: 'ana@sebratel.com.br', createdAt: day('2026-01-10') },
    { id: 'p2', dashboardId: 'd1', email: 'ANA@sebratel.com.br', createdAt: day('2026-01-11') },
    { id: 'p3', dashboardId: 'd9', email: 'bia@sebratel.com.br', createdAt: null },
    { id: 'p4', dashboardId: 'd2', email: 'bia@sebratel.com.br', createdAt: null },
  ],
  users: [
    { email: 'ana@sebratel.com.br', name: 'Ana', accessLevel: 'Admin', createdAt: day('2025-12-01') },
    { email: 'zeca@sebratel.com.br', name: 'Zeca', accessLevel: 'user', createdAt: null },
  ],
});

describe('HUB BI direto do Firestore: do retrato para a importação', () => {
  it('dashboards viram itens (link só http/https); permissões repetidas e de dashboard apagado saem', () => {
    const parsed = hubBiImport(biSnapshot());
    assert.deepEqual(parsed.items!.map((i) => [i.key, i.url]), [['d1', 'https://storage.example.com/d1.html'], ['d2', null]]);
    assert.deepEqual(parsed.records.map((r) => [r.email, r.resourceKey, r.sourceRef]), [
      ['ana@sebratel.com.br', 'd1', 'p1'],
      ['bia@sebratel.com.br', 'd2', 'p4'],
    ]);
    assert.equal(parsed.ignored.length, 1);
    assert.deepEqual(parsed.members!.map((m) => [m.email, m.rootLevel]), [['ana@sebratel.com.br', 'Admin'], ['zeca@sebratel.com.br', 'User']]);
  });
});

describe('sincronização direta', () => {
  beforeEach(() => {
    initDatabase(':memory:');
    setIntegrationLoaderForTests('aplicacoes', null);
    setIntegrationLoaderForTests('hub-bi', null);
  });

  const apps = () => findPlatformBySlug('aplicacoes')!;
  const activeOn = (platformId: number) => listGrants({ platformId, status: 'ACTIVE' });

  it('sem credencial é 409 e o status diz "não configurada"', async () => {
    await assert.rejects(syncIntegration('aplicacoes', actor, { dryRun: false }), (err: unknown) =>
      err instanceof AppException && err.status === 409 && err.code === 'INTEGRATION_NOT_CONFIGURED');
    assert.equal(listIntegrationStatus().find((s) => s.slug === 'aplicacoes')!.configured, false);
    await assert.rejects(syncIntegration('upvalue', actor, { dryRun: false }), (err: unknown) =>
      err instanceof AppException && err.status === 404);
  });

  it('HUB APPS: cria apps (a aberta sem controle próprio), acesso ao hub e às apps; de novo não muda nada nem enche o log', async () => {
    let snapshot = appsSnapshot();
    setIntegrationLoaderForTests('aplicacoes', async () => parseHubAppsExport(hubAppsTables(snapshot)));

    const first = await syncIntegration('aplicacoes', SYSTEM_ACTOR, { dryRun: false });
    assert.equal(first.hubAccess.created, 2); // Ana e Bruno (Caio está inativo)
    assert.equal(first.grants.created, 2);
    const nodes = listResourceNodes(apps().id);
    assert.equal(nodes.find((n) => n.externalRef === 'a-isa')!.isAccessControlled, false);
    const status = listIntegrationStatus().find((s) => s.slug === 'aplicacoes')!;
    assert.equal(status.configured, true);
    assert.equal(status.lastResult!.grantsCreated, 4);
    assert.ok(status.lastSuccessAt);

    const eventsBefore = listAccessEvents({ page: 1, pageSize: 500 }).items.length;
    const again = await syncIntegration('aplicacoes', SYSTEM_ACTOR, { dryRun: false });
    assert.equal(again.grants.created + again.hubAccess.created + again.notInExport.revoked, 0);
    assert.equal(listAccessEvents({ page: 1, pageSize: 500 }).items.length, eventsBefore);

    // Bruno sai da lista direta; alguém registrou aqui, por protocolo, a Ana numa app nova sem ela no hub
    snapshot = appsSnapshot();
    snapshot.apps[0]!.allowedUsers = [];
    snapshot.apps.push({ id: 'a-sst', name: 'SST', url: null, isActive: true, allowedUsers: ['u2'], allowedTeams: [], allowedProfiles: [] });
    await syncIntegration('aplicacoes', SYSTEM_ACTOR, { dryRun: false });
    const sst = listResourceNodes(apps().id).find((n) => n.externalRef === 'a-sst')!;
    grantAccess({ email: 'ana@sebratel.com.br', resourceIds: [sst.id], includeAncestors: false, accessLevel: '', protocolNumber: '1886260', notes: '', source: 'PROTOCOL' }, actor);

    const third = await syncIntegration('aplicacoes', SYSTEM_ACTOR, { dryRun: false });
    assert.equal(third.notInExport.revoked, 0);
    assert.equal(third.notInExport.registeredHere, 1); // a da Ana por protocolo fica
    const split = listResourceNodes(apps().id).find((n) => n.externalRef === 'a-split')!;
    const onSplit = activeOn(apps().id).filter((g) => g.resourceId === split.id).map((g) => g.personEmail);
    assert.deepEqual(onSplit, ['ana@sebratel.com.br']); // a do Bruno (veio do hub) saiu
    assert.ok(activeOn(apps().id).some((g) => g.resourceId === sst.id && g.personEmail === 'ana@sebratel.com.br'));
  });

  it('HUB BI: o nível vira o acesso ao hub; quem sai do DHO_users perde o hub (o que veio de lá)', async () => {
    let snapshot = biSnapshot();
    setIntegrationLoaderForTests('hub-bi', async () => hubBiImport(snapshot));
    await syncIntegration('hub-bi', SYSTEM_ACTOR, { dryRun: false });
    const hub = findPlatformBySlug('hub-bi')!;
    const root = () => activeOn(hub.id).filter((g) => g.resourceId === hub.rootResourceId).map((g) => `${g.personEmail}:${g.accessLevel}`).sort();
    assert.deepEqual(root(), ['ana@sebratel.com.br:Admin', 'zeca@sebratel.com.br:User']);

    snapshot = biSnapshot();
    snapshot.users = snapshot.users.filter((u) => u.email !== 'zeca@sebratel.com.br');
    const summary = await syncIntegration('hub-bi', SYSTEM_ACTOR, { dryRun: false });
    assert.equal(summary.notInExport.revoked, 1);
    assert.deepEqual(root(), ['ana@sebratel.com.br:Admin']);
  });

  it('prévia (dryRun) não grava nem mexe no status', async () => {
    setIntegrationLoaderForTests('aplicacoes', async () => parseHubAppsExport(hubAppsTables(appsSnapshot())));
    const preview = await syncIntegration('aplicacoes', actor, { dryRun: true });
    assert.equal(preview.applied, false);
    assert.equal(preview.grants.created, 2);
    assert.equal(activeOn(apps().id).length, 0);
    assert.equal(listIntegrationStatus().find((s) => s.slug === 'aplicacoes')!.lastRunAt, null);
  });

  it('falha na origem vira 502 com mensagem limpa (sem endereço, usuário ou senha)', async () => {
    const leak = Object.assign(new Error("Access denied for user 'hub_reader'@'10.0.0.5' (using password: YES)"), { code: 'ER_ACCESS_DENIED_ERROR' });
    setIntegrationLoaderForTests('aplicacoes', async () => { throw leak; });
    await assert.rejects(syncIntegration('aplicacoes', actor, { dryRun: false }), (err: unknown) =>
      err instanceof AppException && err.status === 502 && !err.message.includes('hub_reader') && !err.message.includes('10.0.0.5'));
    const status = listIntegrationStatus().find((s) => s.slug === 'aplicacoes')!;
    assert.match(status.lastError!, /credencial foi recusada/);
    assert.equal(status.running, false);
    assert.match(describeError('HUB BI', Object.assign(new Error('x'), { code: 7 })), /permissão de leitura/);
    assert.match(describeError('HUB BI', Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), /sem conexão/);
  });

  it('duas sincronizações do mesmo hub ao mesmo tempo: a segunda é 409', async () => {
    let release!: () => void;
    setIntegrationLoaderForTests('aplicacoes', () => new Promise((resolve) => {
      release = () => resolve(parseHubAppsExport(hubAppsTables(appsSnapshot())));
    }));
    const first = syncIntegration('aplicacoes', actor, { dryRun: false });
    await assert.rejects(syncIntegration('aplicacoes', actor, { dryRun: false }), (err: unknown) =>
      err instanceof AppException && err.code === 'SYNC_RUNNING');
    release();
    await first;
  });
});
