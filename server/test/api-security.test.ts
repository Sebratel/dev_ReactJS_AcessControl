import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';

/**
 * Testes de HTTP com o login LIGADO: o Google é simulado trocando o `fetch`
 * global (só a URL do userinfo responde), e o Voalle por uma fonte em memória.
 */
process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.ALLOWED_DOMAIN = 'sebratel.com.br';
process.env.ADMIN_EMAILS = 'admin@sebratel.com.br';

const TOKENS: Record<string, { email: string; name: string }> = {
  'token-admin-0000000000000': { email: 'admin@sebratel.com.br', name: 'Admin' },
  'token-editor-000000000000': { email: 'editor@sebratel.com.br', name: 'Editor' },
  'token-viewer-000000000000': { email: 'viewer@sebratel.com.br', name: 'Viewer' },
  'token-stranger-0000000000': { email: 'stranger@sebratel.com.br', name: 'Fora do time' },
  'token-gmail-0000000000000': { email: 'alguem@gmail.com', name: 'Gmail' },
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    const user = TOKENS[auth.replace('Bearer ', '')];
    return user
      ? new Response(JSON.stringify({ ...user, email_verified: true }), { status: 200 })
      : new Response('{}', { status: 401 });
  }
  return realFetch(input, init);
}) as typeof fetch;

const { initDatabase } = await import('../src/database/app-database.js');
const { createApp } = await import('../src/app.js');
const { setProtocolSourceForTests } = await import('../src/modules/protocols/protocols.service.js');
const { insertAppUser } = await import('../src/modules/users/users.repository.js');
const { setIntegrationLoaderForTests } = await import('../src/modules/integrations/integrations.service.js');

let base = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

async function call(method: string, path: string, token?: string, body?: unknown) {
  const response = await realFetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe('API — autenticação, autorização e validação', () => {
  before(async () => {
    server = createApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
    globalThis.fetch = realFetch;
  });

  beforeEach(() => {
    initDatabase(':memory:');
    const now = new Date().toISOString();
    const seed = (email: string, role: 'EDITOR' | 'VIEWER') => insertAppUser({
      email, name: email.split('@')[0]!, picture: null, role, firstSeenAt: now, lastSeenAt: now, lastLoginAt: null,
    });
    seed('editor@sebratel.com.br', 'EDITOR');
    seed('viewer@sebratel.com.br', 'VIEWER');
    setProtocolSourceForTests(async () => [{
      assignment_id: 1,
      protocol_number: '1885041',
      title: 'Protocolo 1885041 - DADOS - Requisições de Acessos - CAMILA',
      status: 'Andamento',
      requester_name: 'CAMILA',
      requester_email: 'camila@sebratel.com.br',
      created_at: '2026-11-10 13:20:26.292',
      deadline: null,
      closed_at: null,
      delivery_deadline: '2026-11-16 18:18:00',
      responsible_name: 'GUSTAVO',
      gravity: 1, tendency: 1, urgency: 1,
      team: 'Inteligência de Dados',
      category_2: 'Hub BI',
      category_3: 'Inclusão',
      category_4: null, category_5: null, solution: null,
      description: '<p>Nome da dashboard ou aplicativo: Vendas<img src=x onerror=alert(1)></p><p>E-mail do solicitante do acesso: camila@sebratel.com.br</p>',
      linked_protocols: null,
    }]);
  });

  it('health responde sem login e sem dado sensível', async () => {
    const r = await call('GET', '/health');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.data).sort(), ['status', 'voalleConfigured']);
  });

  it('sem token é 401; token inválido é 401', async () => {
    assert.equal((await call('GET', '/protocols')).status, 401);
    const invalid = await call('GET', '/protocols', 'token-que-o-google-nao-conhece');
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.error.code, 'AUTH_TOKEN_EXPIRED');
  });

  it('conta fora do domínio é 403', async () => {
    const r = await call('GET', '/auth/me', 'token-gmail-0000000000000');
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'AUTH_DOMAIN_NOT_ALLOWED');
  });

  it('conta do domínio entra pela primeira vez como Padrão (só consulta) e fica cadastrada', async () => {
    const me = await call('GET', '/auth/me', 'token-stranger-0000000000');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.role, 'VIEWER');
    assert.equal((await call('GET', '/protocols', 'token-stranger-0000000000')).status, 200);
    const platforms = (await call('GET', '/platforms', 'token-stranger-0000000000')).body.data;
    const root = platforms.find((p: { slug: string }) => p.slug === 'hub-bi').rootResourceId;
    assert.equal((await call('POST', '/grants', 'token-stranger-0000000000', { email: 'x@sebratel.com.br', resourceIds: [root] })).status, 403);
  });

  it('administração: só admin lista e muda papel; último admin não sai; login fica registrado', async () => {
    await call('GET', '/auth/me', 'token-admin-0000000000000'); // vira admin de fábrica
    await call('GET', '/auth/me', 'token-stranger-0000000000');
    assert.equal((await call('GET', '/users', 'token-editor-000000000000')).status, 403);
    assert.equal((await call('PATCH', '/users/stranger@sebratel.com.br', 'token-editor-000000000000', { role: 'ADMIN' })).status, 403);

    const promoted = await call('PATCH', '/users/stranger@sebratel.com.br', 'token-admin-0000000000000', { role: 'EDITOR' });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.data.role, 'EDITOR');
    assert.equal((await call('GET', '/auth/me', 'token-stranger-0000000000')).body.data.role, 'EDITOR');

    const lastAdmin = await call('PATCH', '/users/admin@sebratel.com.br', 'token-admin-0000000000000', { role: 'VIEWER' });
    assert.equal(lastAdmin.status, 422);
    assert.equal(lastAdmin.body.error.code, 'USER_LAST_ADMIN');
    assert.equal((await call('PATCH', '/users/admin@sebratel.com.br', 'token-admin-0000000000000', { role: 'DONO' })).status, 400);

    assert.equal((await call('POST', '/auth/logins', 'token-admin-0000000000000')).status, 204);
    const users = await call('GET', '/users', 'token-admin-0000000000000');
    const admin = users.body.data.find((u: { email: string }) => u.email === 'admin@sebratel.com.br');
    assert.ok(admin.lastLoginAt);
    assert.equal(admin.online, true);
    assert.ok(users.body.meta.online >= 2);
  });

  it('admin de fábrica entra como ADMIN enquanto não há admin no cadastro', async () => {
    const r = await call('GET', '/auth/me', 'token-admin-0000000000000');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.role, 'ADMIN');
  });

  it('leitura consulta mas não concede acesso (403)', async () => {
    assert.equal((await call('GET', '/platforms', 'token-viewer-000000000000')).status, 200);
    const platforms = (await call('GET', '/platforms', 'token-viewer-000000000000')).body.data;
    const root = platforms.find((p: { slug: string }) => p.slug === 'hub-bi').rootResourceId;
    const r = await call('POST', '/grants', 'token-viewer-000000000000', { email: 'x@sebratel.com.br', resourceIds: [root] });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'AUTH_FORBIDDEN');
  });

  it('edição concede acesso, mas não relê o Voalle à força (só admin)', async () => {
    const platforms = (await call('GET', '/platforms', 'token-editor-000000000000')).body.data;
    const root = platforms.find((p: { slug: string }) => p.slug === 'hub-bi').rootResourceId;
    const granted = await call('POST', '/grants', 'token-editor-000000000000', { email: 'x@sebratel.com.br', resourceIds: [root], protocolNumber: '1885041' });
    assert.equal(granted.status, 201);
    assert.equal(granted.body.data.created[0].grantedBy, 'editor@sebratel.com.br');
    assert.equal((await call('POST', '/protocols/refresh', 'token-editor-000000000000')).status, 403);
  });

  it('várias pessoas de uma vez: protocolo obrigatório, leitura é 403, edição concede a todas', async () => {
    const platforms = (await call('GET', '/platforms', 'token-editor-000000000000')).body.data;
    const root = platforms.find((p: { slug: string }) => p.slug === 'hub-bi').rootResourceId;
    const emails = ['ana@sebratel.com.br', 'BIA@sebratel.com.br', 'ana@sebratel.com.br'];
    const noProtocol = await call('POST', '/grants/batch', 'token-editor-000000000000', { emails, resourceIds: [root] });
    assert.equal(noProtocol.status, 400);
    assert.ok(noProtocol.body.error.details.some((d: { field: string }) => d.field === 'protocolNumber'));
    assert.equal((await call('POST', '/grants/batch', 'token-viewer-000000000000', { emails, resourceIds: [root], protocolNumber: '1885041' })).status, 403);
    const ok = await call('POST', '/grants/batch', 'token-editor-000000000000', { emails, resourceIds: [root], protocolNumber: '1885041', notes: 'Pedido do gestor' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.peopleCount, 2);
    assert.deepEqual(ok.body.data.created.map((g: { personEmail: string }) => g.personEmail).sort(), ['ana@sebratel.com.br', 'bia@sebratel.com.br']);
    assert.ok(ok.body.data.created.every((g: { protocolNumber: string; source: string }) => g.protocolNumber === '1885041' && g.source === 'PROTOCOL'));
    const again = await call('POST', '/grants/batch', 'token-editor-000000000000', { emails, resourceIds: [root], protocolNumber: '1885041' });
    assert.equal(again.body.data.created.length, 0);
    assert.equal(again.body.data.alreadyActive.length, 2);
  });

  it('lista de e-mails: exige login e traz todos (a rota não é confundida com /people/:id)', async () => {
    assert.equal((await call('GET', '/people/emails')).status, 401);
    const platforms = (await call('GET', '/platforms', 'token-editor-000000000000')).body.data;
    const root = platforms.find((p: { slug: string }) => p.slug === 'hub-bi').rootResourceId;
    await call('POST', '/grants', 'token-editor-000000000000', { email: 'zz@sebratel.com.br', resourceIds: [root] });
    await call('POST', '/grants', 'token-editor-000000000000', { email: 'aa@sebratel.com.br', resourceIds: [root] });
    const r = await call('GET', '/people/emails', 'token-viewer-000000000000');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data, ['aa@sebratel.com.br', 'zz@sebratel.com.br']);
  });

  it('integração direta: status exige login; leitura não sincroniza; edição sincroniza', async () => {
    setIntegrationLoaderForTests('aplicacoes', async () => ({ records: [], ignored: [], rowsRead: 0, items: [], members: [] }));
    try {
      assert.equal((await call('GET', '/integrations')).status, 401);
      const status = await call('GET', '/integrations', 'token-viewer-000000000000');
      assert.equal(status.status, 200);
      assert.deepEqual(status.body.data.map((s: { slug: string }) => s.slug), ['hub-bi', 'aplicacoes']);
      assert.equal((await call('POST', '/integrations/aplicacoes/sync', 'token-viewer-000000000000', {})).status, 403);
      const ok = await call('POST', '/integrations/aplicacoes/sync', 'token-editor-000000000000', {});
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.applied, true);
      assert.equal((await call('POST', '/integrations/hub-bi/sync', 'token-editor-000000000000', {})).status, 409);
      assert.equal((await call('POST', '/integrations/upvalue/sync', 'token-editor-000000000000', {})).status, 404);
    } finally {
      setIntegrationLoaderForTests('aplicacoes', null);
    }
  });

  it('payload fora do schema é 400 com os campos, sem stack trace', async () => {
    const r = await call('POST', '/grants', 'token-editor-000000000000', { email: 'não é e-mail', resourceIds: ['1; DROP TABLE grants'], protocolNumber: "1' OR '1'='1" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_FAILED');
    const fields = r.body.error.details.map((d: { field: string }) => d.field);
    assert.ok(fields.includes('email') && fields.includes('protocolNumber'));
    assert.ok(!JSON.stringify(r.body).includes('at '));
  });

  it('link de recurso só aceita http(s) — nada de javascript:', async () => {
    const platforms = (await call('GET', '/platforms', 'token-editor-000000000000')).body.data;
    const root = platforms.find((p: { slug: string }) => p.slug === 'hub-bi').rootResourceId;
    const r = await call('POST', '/resources', 'token-editor-000000000000', { parentId: root, resourceType: 'DASHBOARD', name: 'X', url: 'javascript:alert(1)' });
    assert.equal(r.status, 400);
  });

  it('id inválido no caminho é 400 e recurso inexistente é 404', async () => {
    assert.equal((await call('GET', '/people/abc', 'token-viewer-000000000000')).status, 400);
    assert.equal((await call('GET', '/people/999999', 'token-viewer-000000000000')).status, 404);
    assert.equal((await call('GET', '/protocols/123abc', 'token-viewer-000000000000')).status, 400);
  });

  it('protocolo chega sem HTML (a imagem com onerror vira texto)', async () => {
    const r = await call('GET', '/protocols/1885041', 'token-viewer-000000000000');
    assert.equal(r.status, 200);
    const { protocol } = r.body.data;
    assert.deepEqual(protocol.requestedItems, ['Vendas']);
    assert.ok(!protocol.descriptionText.includes('<img'));
    assert.ok(!protocol.descriptionText.includes('onerror'));
  });

  it('importação: leitura é 403; edição recebe tabela grande (> 32 kB) e a prévia não grava', async () => {
    const header = ['id_dashboard', 'dashboard', 'email'];
    const rows = Array.from({ length: 1500 }, (_, i) => [`d${i % 40}`, `Dashboard ${i % 40}`, `pessoa${i}@sebratel.com.br`]);
    const body = { table: { header, rows }, dryRun: true };
    assert.ok(JSON.stringify(body).length > 32_000);
    assert.equal((await call('POST', '/imports/hub-bi-permissions', 'token-viewer-000000000000', body)).status, 403);
    const preview = await call('POST', '/imports/hub-bi-permissions', 'token-editor-000000000000', body);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.applied, false);
    assert.equal(preview.body.data.grants.created, 1500);
    const people = await call('GET', '/people?withAccess=false', 'token-editor-000000000000');
    assert.equal(people.body.meta.totalItems, 0);
  });

  it('outras rotas continuam recusando corpo acima de 32 kB (413)', async () => {
    const r = await call('POST', '/people', 'token-editor-000000000000', { email: 'a@sebratel.com.br', notes: 'x'.repeat(40_000) });
    assert.equal(r.status, 413);
  });

  it('rota inexistente da API é 404 no envelope', async () => {
    const r = await call('GET', '/nao-existe', 'token-viewer-000000000000');
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
  });
});
