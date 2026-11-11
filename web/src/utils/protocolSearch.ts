import type { Protocol } from '../services/types';
import { normalizeText } from './format';

const STATE_ORDER: Record<Protocol['state'], number> = { OPEN: 0, CLOSED: 1, CANCELED: 2 };

/**
 * Protocolos para a lista de escolha. Número casa por trecho; texto casa com
 * solicitante, e-mails, título, categorias e itens pedidos (todas as palavras,
 * sem acento). Ordem: número exato, abertos, da plataforma atual, mais novos.
 * Função pura — testada em `protocolSearch.test.ts`.
 */
export function searchProtocols(protocols: Protocol[], query: string, platformSlug: string | null, limit = 30): Protocol[] {
  const q = normalizeText(query.trim());
  const isNumber = /^\d+$/.test(q);
  const words = q.split(/\s+/).filter(Boolean);
  const platformOf = (p: Protocol) => p.platformSlug ?? p.suggestedPlatformSlug;

  const matches = protocols.filter((p) => {
    if (!q) return true;
    if (isNumber) return p.protocolNumber.includes(q);
    const haystack = normalizeText(
      [p.protocolNumber, p.requesterName, p.requesterEmail, p.targetEmail, p.title, p.category2, p.category3, ...p.requestedItems]
        .filter(Boolean)
        .join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });

  return matches
    .sort((a, b) =>
      Number(b.protocolNumber === q) - Number(a.protocolNumber === q)
      || STATE_ORDER[a.state] - STATE_ORDER[b.state]
      || Number(platformOf(b) === platformSlug) - Number(platformOf(a) === platformSlug)
      || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, limit);
}
