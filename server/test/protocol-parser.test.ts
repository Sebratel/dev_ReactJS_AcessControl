import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  htmlToText, parseRequest, pickTargetEmail, similarity, subjectFromTitle, toPlatformSlug, toRequestType,
} from '../src/modules/protocols/protocol-parser.js';
import { computeTiming, voalleTimestampToIso } from '../src/modules/protocols/protocol.mapper.js';

const TEMPLATE = '<p>Olá, solicitante! </p><p><br></p><p>Por favor, acrescente abaixo algumas informações para solicitar acesso: </p>'
  + '<p><br></p><p>Nome da dashboard ou aplicativo: </p><p>Relatórios Analíticos de Atendimento e HSM</p>'
  + '<p>GERAL - Relatório Canais Atendimento &quot;Análises Tags Matrix (Nova)&quot;</p><p><br></p>'
  + '<p>Email do solicitante do acesso: joao.teste@sebratel.com.br</p>';

describe('leitura da descrição do protocolo', () => {
  it('extrai o pedido em várias linhas e o e-mail do modelo do Voalle', () => {
    const parsed = parseRequest(TEMPLATE);
    assert.deepEqual(parsed.requestedItems, [
      'Relatórios Analíticos de Atendimento e HSM',
      'GERAL - Relatório Canais Atendimento "Análises Tags Matrix (Nova)"',
    ]);
    assert.deepEqual(parsed.emails, ['joao.teste@sebratel.com.br']);
    assert.ok(!parsed.text.includes('Olá, solicitante'));
  });

  it('pedido na mesma linha do rótulo', () => {
    const parsed = parseRequest('<p>Nome da dashboard ou aplicativo: GERAL - Vendas</p><p>E-mail do solicitante do acesso: a@sebratel.com.br</p>');
    assert.deepEqual(parsed.requestedItems, ['GERAL - Vendas']);
  });

  it('modelo antigo: usa a primeira linha depois de "Descreva abaixo"', () => {
    const parsed = parseRequest('<p>Descreva abaixo com detalhes a sua solicitação para o tipo de categoria Correção/ Ajuste (Categoria 3):</p><p>Liberar acesso ao BI de Integradoras.</p><p>------------</p>');
    assert.deepEqual(parsed.requestedItems, ['Liberar acesso ao BI de Integradoras.']);
  });

  it('remove imagens, scripts e tags — só texto chega ao navegador', () => {
    const text = htmlToText('<p>oi<img src="data:image/png;base64,AAAA" onerror="alert(1)"></p><script>alert(1)</script><b>x</b> &lt;b&gt;');
    assert.ok(!text.includes('<img'));
    assert.ok(!text.includes('alert(1)'));
    assert.ok(!text.includes('<b>x'));
    assert.match(text, /\[imagem\]/);
    // entidades viram texto literal (o React escapa na renderização)
    assert.match(text, /<b>$/);
  });

  it('descrição vazia ou nula não quebra', () => {
    assert.deepEqual(parseRequest(null), { requestedItems: [], emails: [], text: '' });
  });
});

describe('e-mail de quem recebe o acesso', () => {
  it('usa o e-mail informado quando é do domínio', () => {
    assert.equal(pickTargetEmail(['ana@sebratel.com.br'], 'outra@sebratel.com.br', 'sebratel.com.br').email, 'ana@sebratel.com.br');
  });

  it('e-mail digitado errado cai no cadastro do solicitante e é sinalizado', () => {
    const result = pickTargetEmail(['fabio.teste@sebratel.com.bnr'], 'fabio.teste@sebratel.com.br', 'sebratel.com.br');
    assert.equal(result.email, 'fabio.teste@sebratel.com.br');
    assert.equal(result.isInformedValid, false);
  });

  it('sem e-mail no texto usa o do solicitante', () => {
    assert.equal(pickTargetEmail([], 'Ana@Sebratel.com.br', 'sebratel.com.br').email, 'ana@sebratel.com.br');
  });
});

describe('categorias do Voalle', () => {
  it('tipo do pedido pela categoria 3', () => {
    assert.equal(toRequestType('Inclusão'), 'INCLUSION');
    assert.equal(toRequestType('Exclusão'), 'EXCLUSION');
    assert.equal(toRequestType(null), 'OTHER');
  });

  it('plataforma pela categoria 2', () => {
    assert.equal(toPlatformSlug('Hub BI'), 'hub-bi');
    assert.equal(toPlatformSlug('UpValue'), 'upvalue');
    assert.equal(toPlatformSlug('AppSheet /Aplicativos'), 'appsheet');
    assert.equal(toPlatformSlug('DataHub'), 'datahub');
    assert.equal(toPlatformSlug('Outra coisa'), null);
  });

  it('assunto do título vira pedido, mas não o nome genérico da fila', () => {
    assert.equal(subjectFromTitle('Protocolo 1747218 - Solicito acesso a dashboard [UP] Cancelamentos - ANA MARGONI', 'ANA MARGONI'), 'Solicito acesso a dashboard [UP] Cancelamentos');
    assert.equal(subjectFromTitle('Protocolo 1885063 - DADOS - Requisições de Acessos / TI/Inteligência de Dados - JULIO', 'JULIO'), null);
    assert.equal(subjectFromTitle('Protocolo 1885030 - HUB - BI  - FABIO', 'FABIO'), null);
  });

  it('semelhança sugere o recurso certo e ignora acento/caixa', () => {
    assert.ok(similarity('Relatórios Analíticos de Atendimento e HSM', 'relatorios analiticos de atendimento e hsm') === 1);
    assert.ok(similarity('Dash Cancelamentos da UpValue', 'Cancelamentos') >= 0.85);
    assert.ok(similarity('Financeiro', 'Estoque & Aquisição') < 0.35);
  });
});

describe('datas e atraso (mesma regra da consulta original)', () => {
  it('converte o horário de Brasília do Voalle para UTC', () => {
    assert.equal(voalleTimestampToIso('2026-11-10 13:30:19.536867'), '2026-11-10T16:30:19.536Z');
    assert.equal(voalleTimestampToIso(null), null);
    assert.equal(voalleTimestampToIso('lixo'), null);
  });

  it('aberto e passado do prazo de entrega é atrasado', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    const t = computeTiming('OPEN', '2026-11-10T12:00:00Z', null, '2026-11-16T12:00:00Z', now);
    assert.deepEqual(t, { totalDays: 10, isLate: true, daysLate: 4 });
  });

  it('encerrado dentro do prazo não é atrasado e conta dias até o encerramento', () => {
    const now = new Date('2026-12-31T00:00:00Z');
    const t = computeTiming('CLOSED', '2026-11-10T12:00:00Z', '2026-11-12T12:00:00Z', '2026-11-16T12:00:00Z', now);
    assert.deepEqual(t, { totalDays: 2, isLate: false, daysLate: null });
  });

  it('encerrado depois do prazo conta o atraso até o encerramento', () => {
    const t = computeTiming('CLOSED', '2026-11-10T12:00:00Z', '2026-11-19T12:00:00Z', '2026-11-16T12:00:00Z', new Date('2027-01-01'));
    assert.equal(t.daysLate, 3);
  });
});
