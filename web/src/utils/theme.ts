/**
 * Tema claro/escuro: classe `dark` no <html>, escolha guardada no navegador e,
 * na primeira visita, o `prefers-color-scheme` do sistema.
 *
 * `applyInitialTheme()` roda no main.tsx ANTES do primeiro render — senão a
 * tela pisca branca por um quadro antes de escurecer.
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'access-control.theme';

export function getPreferredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage bloqueado (modo privado, política de grupo): vale o sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function applyInitialTheme(): Theme {
  const theme = getPreferredTheme();
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // sem storage, vale só nesta sessão
  }
}
