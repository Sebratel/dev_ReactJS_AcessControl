const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

export interface EmailOption {
  email: string;
  /** e-mail digitado que ainda não está no cadastro */
  isNew: boolean;
}

/**
 * Opções da lista de e-mails: todos os que contêm o texto digitado, sem
 * repetidos (ignora maiúsculas e espaços), sem os já escolhidos, em ordem
 * alfabética. Um e-mail completo digitado que não está na lista entra no topo
 * como novo. Função pura — testada em `emailOptions.test.ts`.
 */
export function emailOptions(known: string[], chosen: string[], typed: string): EmailOption[] {
  const taken = new Set(chosen.map((e) => e.trim().toLowerCase()));
  const t = typed.trim().toLowerCase();
  const unique = [...new Set(known.map((e) => e.trim().toLowerCase()))]
    .filter((e) => e && !taken.has(e) && e.includes(t))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const fresh = isEmail(t) && !taken.has(t) && !unique.includes(t);
  return [...(fresh ? [{ email: t, isNew: true }] : []), ...unique.map((email) => ({ email, isNew: false }))];
}
