import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'false';

const { initDatabase } = await import('../src/database/app-database.js');
const { grantAccess, revokeGrant, revokeAllForPerson } = await import('../src/modules/grants/grants.service.js');
const { createResource, editResource, removeResource } = await import('../src/modules/resources/resources.service.js');
const { findPlatformBySlug } = await import('../src/modules/platforms/platforms.repository.js');
const { listGrants } = await import('../src/modules/grants/grants.repository.js');
const { listPeople, listPeopleEmails } = await import('../src/modules/people/people.repository.js');
const { listAccessEvents } = await import('../src/modules/access-events/access-events.repository.js');
const { AppException } = await import('../src/common/errors/app.exception.js');

const actor = { email: 'gustavo.santos@sebratel.com.br' };

function seedTree() {
  const platform = findPlatformBySlug('hub-bi')!;
  const dashboard = createResource({ parentId: platform.rootResourceId, resourceType: 'DASHBOARD', name: 'Atendimento', url: null, description: '', owner: '', isAccessControlled: true }, actor);
  const tab = createResource({ parentId: dashboard.id, resourceType: 'TAB', name: 'Aba HSM', url: null, description: '', owner: '', isAccessControlled: true }, actor);
  const open = createResource({ parentId: dashboard.id, resourceType: 'TAB', name: 'Aba aberta', url: null, description: '', owner: '', isAccessControlled: false }, actor);
  const feature = createResource({ parentId: open.id, resourceType: 'FEATURE', name: 'Exportar', url: null, description: '', owner: '', isAccessControlled: true }, actor);
  return { platform, dashboard, tab, open, feature };
}

const grantInput = (email: string, resourceIds: number[], includeAncestors = true) => ({
  email, resourceIds, includeAncestors, accessLevel: '', protocolNumber: '123', notes: '', source: 'PROTOCOL' as const,
});

describe('árvore de acessos', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  it('conceder uma aba registra também dashboard e hub (níveis acima)', () => {
    const { tab } = seedTree();
    const result = grantAccess(grantInput('Ana@Sebratel.com.br', [tab.id]), actor);
    assert.deepEqual(result.created.map((g) => g.resourceName), ['Acesso ao HUB BI', 'Atendimento', 'Aba HSM']);
    assert.equal(result.created[0]!.personEmail, 'ana@sebratel.com.br');
  });

  it('nível acima sem controle próprio não ganha concessão', () => {
    const { feature } = seedTree();
    const result = grantAccess(grantInput('ana@sebratel.com.br', [feature.id]), actor);
    assert.deepEqual(result.created.map((g) => g.resourceName), ['Acesso ao HUB BI', 'Atendimento', 'Exportar']);
  });

  it('sem "níveis acima" concede só o item pedido', () => {
    const { tab } = seedTree();
    const result = grantAccess(grantInput('ana@sebratel.com.br', [tab.id], false), actor);
    assert.deepEqual(result.created.map((g) => g.resourceName), ['Aba HSM']);
  });

  it('lista os acessos ativos de uma pessoa pelo e-mail, sem diferença de maiúsculas e em todas as plataformas', () => {
    const { tab } = seedTree();
    const upvalue = findPlatformBySlug('upvalue')!;
    grantAccess(grantInput('ana@sebratel.com.br', [tab.id, upvalue.rootResourceId], false), actor);
    grantAccess(grantInput('bia@sebratel.com.br', [tab.id], false), actor);
    const ana = listGrants({ email: 'ANA@Sebratel.com.br', status: 'ACTIVE' });
    assert.deepEqual(ana.map((g) => g.resourceName).sort(), ['Aba HSM', 'Acesso ao UpValue']);
    assert.ok(ana.every((g) => g.personEmail === 'ana@sebratel.com.br'));
    assert.equal(listGrants({ email: 'ninguem@sebratel.com.br' }).length, 0);
  });

  it('lista de e-mails para escolher: todos, únicos, em ordem alfabética, sem importar quem tem nome', () => {
    const { tab } = seedTree();
    grantAccess({ ...grantInput('zeca@sebratel.com.br', [tab.id]), name: 'Ana Zeca' }, actor);
    grantAccess(grantInput('bruno@sebratel.com.br', [tab.id]), actor);
    grantAccess({ ...grantInput('Carla@sebratel.com.br', [tab.id]), name: 'Bia Carla' }, actor);
    grantAccess(grantInput('CARLA@sebratel.com.br', [tab.id]), actor);
    assert.deepEqual(listPeopleEmails(), ['bruno@sebratel.com.br', 'carla@sebratel.com.br', 'zeca@sebratel.com.br']);
  });

  it('pessoas por letra inicial do e-mail: filtra e conta por letra com os outros filtros', () => {
    const { tab } = seedTree();
    for (const email of ['ana@sebratel.com.br', 'Alex@sebratel.com.br', 'bia@sebratel.com.br', '1suporte@sebratel.com.br']) {
      grantAccess(grantInput(email, [tab.id], false), actor);
    }
    const a = listPeople({ initial: 'A', page: 1, pageSize: 10 });
    assert.deepEqual(a.items.map((p) => p.email), ['alex@sebratel.com.br', 'ana@sebratel.com.br']);
    // a lista vem em ordem alfabética de e-mail (sem importar o nome)
    assert.deepEqual(listPeople({ page: 1, pageSize: 10 }).items.map((p) => p.email), ['1suporte@sebratel.com.br', 'alex@sebratel.com.br', 'ana@sebratel.com.br', 'bia@sebratel.com.br']);
    assert.deepEqual(a.initials, { '#': 1, a: 2, b: 1 }); // a contagem não depende da letra escolhida
    assert.deepEqual(listPeople({ initial: '#', page: 1, pageSize: 10 }).items.map((p) => p.email), ['1suporte@sebratel.com.br']);
    assert.deepEqual(listPeople({ search: 'bia', page: 1, pageSize: 10 }).initials, { b: 1 });
  });

  it('conceder de novo não duplica: vai para "já tinha"', () => {
    const { tab } = seedTree();
    grantAccess(grantInput('ana@sebratel.com.br', [tab.id]), actor);
    const again = grantAccess(grantInput('ANA@sebratel.com.br', [tab.id]), actor);
    assert.equal(again.created.length, 0);
    assert.equal(again.alreadyActive.length, 3);
  });

  it('remover o dashboard remove junto as abas da mesma pessoa, e só dela', () => {
    const { dashboard, tab } = seedTree();
    const ana = grantAccess(grantInput('ana@sebratel.com.br', [tab.id]), actor);
    grantAccess(grantInput('bia@sebratel.com.br', [tab.id]), actor);
    const dashGrant = ana.created.find((g) => g.resourceId === dashboard.id)!;
    const revoked = revokeGrant(dashGrant.id, { includeDescendants: true, protocolNumber: '999', notes: 'saiu' }, actor);
    assert.deepEqual(revoked.map((g) => g.resourceName).sort(), ['Aba HSM', 'Atendimento']);
    assert.ok(revoked.every((g) => g.status === 'REVOKED' && g.revokeProtocolNumber === '999'));
    const biaActive = listGrants({ status: 'ACTIVE' }).filter((g) => g.personEmail === 'bia@sebratel.com.br');
    assert.equal(biaActive.length, 3);
  });

  it('remover um acesso já removido é 409', () => {
    const { tab } = seedTree();
    const { created } = grantAccess(grantInput('ana@sebratel.com.br', [tab.id], false), actor);
    revokeGrant(created[0]!.id, { includeDescendants: false, protocolNumber: null, notes: '' }, actor);
    assert.throws(
      () => revokeGrant(created[0]!.id, { includeDescendants: false, protocolNumber: null, notes: '' }, actor),
      (err: unknown) => err instanceof AppException && err.status === 409,
    );
  });

  it('remover todos os acessos de uma plataforma não mexe nas outras', () => {
    const { tab } = seedTree();
    const up = findPlatformBySlug('upvalue')!;
    const { personId } = grantAccess(grantInput('ana@sebratel.com.br', [tab.id, up.rootResourceId]), actor);
    const revoked = revokeAllForPerson(personId, findPlatformBySlug('hub-bi')!.id, { protocolNumber: null, notes: 'troca de área' }, actor);
    assert.equal(revoked.length, 3);
    assert.deepEqual(listGrants({ personId, status: 'ACTIVE' }).map((g) => g.platformSlug), ['upvalue']);
  });

  it('item com acessos ativos só sai da árvore se pedirem para revogar junto', () => {
    const { dashboard, tab } = seedTree();
    grantAccess(grantInput('ana@sebratel.com.br', [tab.id]), actor);
    assert.throws(() => removeResource(dashboard.id, { revokeGrants: false }, actor), (err: unknown) => err instanceof AppException && err.code === 'RESOURCE_HAS_ACTIVE_GRANTS');
    const result = removeResource(dashboard.id, { revokeGrants: true }, actor);
    assert.equal(result.revokedGrants, 2);
    assert.equal(listGrants({ status: 'ACTIVE' }).length, 1); // sobra o acesso ao hub
  });

  it('raiz não pode ser removida nem movida; item não pode ir para dentro dele mesmo', () => {
    const { platform, dashboard, tab } = seedTree();
    assert.throws(() => removeResource(platform.rootResourceId, { revokeGrants: true }, actor), (err: unknown) => err instanceof AppException && err.status === 422);
    assert.throws(() => editResource(dashboard.id, { parentId: tab.id }, actor), (err: unknown) => err instanceof AppException && err.code === 'RESOURCE_PARENT_INVALID');
    const other = findPlatformBySlug('upvalue')!;
    assert.throws(() => editResource(tab.id, { parentId: other.rootResourceId }, actor), (err: unknown) => err instanceof AppException && err.code === 'RESOURCE_PARENT_INVALID');
  });

  it('tudo vai para o log com caminho legível, protocolo e autor', () => {
    const { tab } = seedTree();
    grantAccess(grantInput('ana@sebratel.com.br', [tab.id]), actor);
    const { items } = listAccessEvents({ eventTypes: ['GRANT_ADDED'], page: 1, pageSize: 10 });
    assert.equal(items.length, 3);
    assert.ok(items.some((e) => e.resourcePath === 'HUB BI › Atendimento › Aba HSM' && e.protocolNumber === '123' && e.actorEmail === actor.email));
  });
});
