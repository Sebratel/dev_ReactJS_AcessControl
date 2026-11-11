/**
 * Leitura da descrição dos protocolos de "Gestão de Acessos".
 *
 * A descrição vem do Voalle em HTML, preenchida em cima de um modelo:
 *
 *   Nome da dashboard ou aplicativo: <texto, às vezes na linha de baixo>
 *   E-mail do solicitante do acesso: fulano@sebratel.com.br
 *
 * …e às vezes com prints colados (imagens base64 enormes). Daqui sai só TEXTO:
 * nada de HTML chega ao navegador, então não há como a descrição injetar script.
 */

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>',
  '&aacute;': 'á', '&agrave;': 'à', '&atilde;': 'ã', '&acirc;': 'â', '&eacute;': 'é', '&ecirc;': 'ê',
  '&iacute;': 'í', '&oacute;': 'ó', '&otilde;': 'õ', '&ocirc;': 'ô', '&uacute;': 'ú', '&ccedil;': 'ç',
  '&Aacute;': 'Á', '&Atilde;': 'Ã', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú', '&Ccedil;': 'Ç',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d{1,6});/g, (_m, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_m, code: string) => safeCodePoint(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity] ?? entity);
}

function safeCodePoint(code: number): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

/** HTML do Voalle -> texto puro, com quebras de linha onde havia parágrafos. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  const text = html
    // imagens coladas (base64) e blocos que não são conteúdo
    .replace(/<img\b[^>]*>/gi, ' [imagem] ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line, i, lines) => line !== '' || (i > 0 && lines[i - 1] !== ''))
    .join('\n')
    .trim();
}

const ITEM_LABEL = /nome d[oa]s?\s+(?:dashboard|aplica\w*|ferramenta|relat\w*|app\w*)[^:\n]*:/i;
const EMAIL_LABEL = /e-?\s?mail[^:\n]*:/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DESCRIBE_LABEL = /^descreva abaixo com detalhes a sua solicita/i;
const SEPARATOR = /^-{5,}$/;
const BOILERPLATE = [/^olá,?\s*solicitante!?$/i, /^por favor, acrescente abaixo/i, /^\[imagem\]$/i];

/** Assuntos de título que são só o nome da fila, não o pedido. */
const GENERIC_SUBJECTS = [/requisi\w+ de (acessos|atividades)/i, /^hub\s*-?\s*bi$/i, /^dados$/i, /^acessos?$/i];

/**
 * Assunto do título ("Protocolo 123 - <assunto> - NOME DO SOLICITANTE"), quando
 * diz o que foi pedido. Serve de pedido para os protocolos de texto livre.
 */
export function subjectFromTitle(title: string | null | undefined, requesterName: string | null | undefined): string | null {
  if (!title) return null;
  let subject = title.replace(/^protocolo\s+\d+\s*-\s*/i, '').trim();
  const name = requesterName?.trim();
  if (name && subject.toUpperCase().endsWith(name.toUpperCase())) {
    subject = subject.slice(0, subject.length - name.length).replace(/\s*-\s*$/, '').trim();
  }
  if (!subject || GENERIC_SUBJECTS.some((re) => re.test(subject)) || /^dados\s*-\s*requisi/i.test(subject)) return null;
  return subject;
}

export interface ParsedRequest {
  /** o que foi pedido ("Nome da dashboard ou aplicativo") — pode ter várias linhas */
  requestedItems: string[];
  /** e-mails informados no texto, na ordem em que aparecem */
  emails: string[];
  /** texto limpo da descrição, sem o cabeçalho do modelo */
  text: string;
}

/** Extrai o pedido e os e-mails do texto já limpo. */
export function parseRequest(descriptionHtml: string | null | undefined): ParsedRequest {
  const text = htmlToText(descriptionHtml);
  const lines = text.split('\n');

  const requestedItems: string[] = [];
  const itemStart = lines.findIndex((line) => ITEM_LABEL.test(line));
  if (itemStart >= 0) {
    const sameLine = lines[itemStart]!.replace(ITEM_LABEL, '').trim();
    if (sameLine) requestedItems.push(sameLine);
    for (let i = itemStart + 1; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (EMAIL_LABEL.test(line) || ITEM_LABEL.test(line)) break;
      if (line && !BOILERPLATE.some((re) => re.test(line))) requestedItems.push(line);
    }
  } else {
    // modelo antigo: "Descreva abaixo com detalhes a sua solicitação ...:" e o texto na linha de baixo
    const describeStart = lines.findIndex((line) => DESCRIBE_LABEL.test(line));
    const first = describeStart >= 0 ? lines.slice(describeStart + 1).find((line) => line !== '') : undefined;
    if (first && !SEPARATOR.test(first) && first.length <= 200) requestedItems.push(first);
  }

  const emails = [...new Set((text.match(EMAIL) ?? []).map((e) => e.toLowerCase()))];
  const cleanText = lines.filter((line) => !BOILERPLATE.some((re) => re.test(line))).join('\n').trim();

  return {
    requestedItems: requestedItems.map((item) => stripQuotes(item.replace(/\s*\[imagem\]\s*/g, ' '))).filter(Boolean),
    emails,
    text: cleanText,
  };
}

/** Tira travessão inicial e aspas que envolvem o texto INTEIRO (as de dentro ficam). */
function stripQuotes(value: string): string {
  let text = value.trim().replace(/^[-–—\s]+/, '');
  const wrapped = /^["'“”](.*)["'“”]$/.exec(text);
  if (wrapped && !/["“”]/.test(wrapped[1]!)) text = wrapped[1]!;
  return text.trim();
}

/**
 * E-mail mais provável de QUEM vai receber o acesso: o informado no texto
 * quando for do domínio permitido; senão, o do cadastro do solicitante no
 * Voalle. Digitação errada no protocolo ("@sebratel.com.bnr") cai no segundo.
 */
export function pickTargetEmail(parsedEmails: string[], requesterEmail: string | null, allowedDomain: string): {
  email: string | null;
  informedEmail: string | null;
  isInformedValid: boolean;
} {
  const informed = parsedEmails[0] ?? null;
  const domainOk = (email: string | null): email is string => Boolean(email && (!allowedDomain || email.endsWith(`@${allowedDomain}`)));
  const requester = requesterEmail?.trim().toLowerCase() || null;
  if (domainOk(informed)) return { email: informed, informedEmail: informed, isInformedValid: true };
  return { email: domainOk(requester) ? requester : informed ?? requester, informedEmail: informed, isInformedValid: false };
}

/** Texto para comparação: minúsculo, sem acento e sem pontuação. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type RequestType = 'INCLUSION' | 'EXCLUSION' | 'OTHER';

/** Categoria 3 do Voalle -> tipo do pedido. */
export function toRequestType(category3: string | null | undefined): RequestType {
  const value = normalizeText(category3 ?? '');
  if (value.startsWith('inclus')) return 'INCLUSION';
  if (value.startsWith('exclus') || value.startsWith('remoc') || value.startsWith('revog')) return 'EXCLUSION';
  return 'OTHER';
}

/**
 * Categoria 2 do Voalle -> plataforma desta aplicação. "AppSheet /Aplicativos"
 * cobre o AppSheet e o HUB APPS; o padrão é AppSheet, e o time troca no
 * protocolo quando for do HUB APPS.
 */
export function toPlatformSlug(category2: string | null | undefined): string | null {
  const value = normalizeText(category2 ?? '');
  if (!value) return null;
  if (value.includes('hub bi') || value === 'bi' || value.includes('power bi')) return 'hub-bi';
  if (value.includes('upvalue') || value.includes('up value')) return 'upvalue';
  if (value.includes('datahub') || value.includes('data hub')) return 'datahub';
  if (value.includes('appsheet')) return 'appsheet';
  if (value.includes('hub app') || value.includes('aplica')) return 'aplicacoes';
  return null;
}

/**
 * Semelhança entre o pedido e o nome de um recurso (0 a 1): fração das
 * palavras do nome do recurso que aparecem no pedido, com bônus quando um
 * contém o outro inteiro. Simples de propósito — serve para SUGERIR, quem
 * decide é a pessoa.
 */
export function similarity(request: string, resourceName: string): number {
  const a = normalizeText(request);
  const b = normalizeText(resourceName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const stop = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para', 'por', 'com', 'geral', 'relatorio', 'relatorios', 'dashboard']);
  const words = (s: string) => new Set(s.split(' ').filter((w) => w.length > 1 && !stop.has(w)));
  const wa = words(a);
  const wb = words(b);
  if (wb.size === 0) return 0;
  let hits = 0;
  wb.forEach((w) => { if (wa.has(w)) hits += 1; });
  return hits / wb.size * 0.85;
}
