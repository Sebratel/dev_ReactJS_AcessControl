import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_ENABLED = 'false';

const { initDatabase } = await import('../src/database/app-database.js');
const { parseUpvalueReports } = await import('../src/modules/imports/upvalue-reports.parser.js');
const { importUpvalueReports } = await import('../src/modules/imports/upvalue-import.service.js');
const { createResource } = await import('../src/modules/resources/resources.service.js');
const { findPlatformBySlug } = await import('../src/modules/platforms/platforms.repository.js');
const { listGrants } = await import('../src/modules/grants/grants.repository.js');
const { listResourceNodes } = await import('../src/modules/resources/resources.repository.js');
const { AppException } = await import('../src/common/errors/app.exception.js');

const actor = { email: 'gustavo.santos@sebratel.com.br' };
const HEADER = ['Usuário', 'email', 'Relatório'];
type Row = (string | null)[];

// formato agrupado do "Controle UpValue": nome/e-mail só na primeira linha da pessoa
const BASE: Row[] = [
  ['Carla', 'carla.teste@sebratel.com.br', '[Up] Atendimento'],
  [null, null, '[Up] Cancelamento'],
  [null, null, '[Up] Cobrança'],
  ['Ana', 'Ana@Sebratel.com.br', '[Up] Atendimento'],
  ['Fornecedor', 'compras.sebratel@upvalue.com.br', '[Up] Estoque & Aquisição'],
];

const run = (rows: Row[], options = { dryRun: false, revokeMissing: false }) =>
  importUpvalueReports(parseUpvalueReports({ header: HEADER, rows }), options, actor);

const upvalue = () => findPlatformBySlug('upvalue')!;

describe('leitura do Controle UpValue', () => {
  it('as linhas de baixo herdam a pessoa de cima', () => {
    const parsed = parseUpvalueReports({ header: HEADER, rows: BASE });
    assert.equal(parsed.records.length, 5);
    assert.deepEqual(parsed.records.filter((r) => r.email === 'carla.teste@sebratel.com.br').map((r) => r.resourceName), [
      '[Up] Atendimento', '[Up] Cancelamento', '[Up] Cobrança',
    ]);
    assert.equal(parsed.records[3]!.email, 'ana@sebratel.com.br');
  });

  it('sem as colunas email e Relatório é 422', () => {
    assert.throws(
      () => parseUpvalueReports({ header: ['Nome', 'Setor'], rows: [] }),
      (err: unknown) => err instanceof AppException && err.status === 422 && /email.*relatorio/i.test(err.message),
    );
  });

  it('e-mail inválido derruba os relatórios daquela pessoa (e não os passa para a de cima); repetidos saem', () => {
    const parsed = parseUpvalueReports({
      header: HEADER,
      rows: [
        ['Carla', 'carla.teste@sebratel.com.br', '[Up] Atendimento'],
        ['Sem e-mail', null, '[Up] CRM'],
        [null, null, '[Up] Faturamento'],
        ['Bia', 'bia@sebratel.com.br', '[Up] CRM'],
        [null, null, '[Up]  crm'],
      ],
    });
    assert.deepEqual(parsed.records.map((r) => `${r.email}:${r.resourceName}`), [
      'carla.teste@sebratel.com.br:[Up] Atendimento',
      'bia@sebratel.com.br:[Up] CRM',
    ]);
    assert.deepEqual(parsed.ignored.map((i) => i.rowNumber), [3, 4, 6]);
  });
});

describe('importação da UpValue', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  it('todo mundo do export ganha acesso à ferramenta; relatórios viram itens sem o prefixo [Up]', () => {
    const summary = run(BASE);
    assert.deepEqual(summary.dashboards.created.sort(), ['Atendimento', 'Cancelamento', 'Cobrança', 'Estoque & Aquisição']);
    assert.equal(summary.hubAccess.created, 3);
    assert.equal(summary.people.withoutHubAccount, 0);
    assert.equal(summary.grants.created, 5);
    const node = listResourceNodes(upvalue().id).find((n) => n.name === 'Atendimento')!;
    assert.equal(node.externalRef, '[Up] Atendimento');
  });

  it('importar de novo não muda nada', () => {
    run(BASE);
    const again = run(BASE);
    assert.equal(again.grants.created + again.hubAccess.created + again.dashboards.created.length, 0);
    assert.equal(again.notInExport.total, 0);
  });

  it('liga a um relatório cadastrado à mão com ou sem o prefixo', () => {
    const manual = createResource({ parentId: upvalue().rootResourceId, resourceType: 'DASHBOARD', name: 'Cancelamento', url: null, description: '', owner: '', isAccessControlled: true }, actor);
    const summary = run(BASE);
    assert.ok(summary.dashboards.linked.includes('Cancelamento'));
    assert.equal(listResourceNodes(upvalue().id).find((n) => n.id === manual.id)!.externalRef, '[Up] Cancelamento');
  });

  it('quem sumiu do export aparece em "não consta" — relatório e acesso à ferramenta — e só sai se pedirem', () => {
    run(BASE);
    const withoutAna = BASE.filter((r) => r[1] !== 'Ana@Sebratel.com.br');
    const preview = run(withoutAna, { dryRun: true, revokeMissing: true });
    assert.equal(preview.notInExport.total, 2); // Atendimento + Acesso ao UpValue
    const removed = run(withoutAna, { dryRun: false, revokeMissing: true });
    assert.equal(removed.notInExport.revoked, 2);
    assert.ok(!listGrants({ status: 'ACTIVE' }).some((g) => g.personEmail === 'ana@sebratel.com.br'));
  });
});
