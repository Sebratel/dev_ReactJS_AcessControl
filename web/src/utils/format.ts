import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** "10/11/2026 16:30" na hora local do navegador (a API manda UTC). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy');
}

/** "16:30" na hora local. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'HH:mm');
}

/** "há 3 minutos" */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  if (Date.now() - date.getTime() < 45_000) return 'agora há pouco';
  return `há ${formatDistanceToNowStrict(date, { locale: ptBR })}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Iniciais para o avatar ("Gustavo Leite dos Santos" -> "GS"). */
export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0]!.replace(/[._-]+/g, ' ') : nameOrEmail;
  const parts = base.trim().split(/\s+/).filter((p) => p.length > 2 || base.trim().split(/\s+/).length <= 2);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : '';
  return `${first}${last}`.toUpperCase();
}

/** Nome em caixa de título ("JULIO CESAR" -> "Julio Cesar"), mantendo preposições minúsculas. */
export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/** Para busca: sem acento e em minúsculas ("Gestão" casa com "gestao"). */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
