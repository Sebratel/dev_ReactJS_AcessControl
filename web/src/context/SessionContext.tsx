import { useQueryClient } from '@tanstack/react-query';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  endSession, getAccessToken, initGoogleClient, onSessionEnd, signInWithGoogle, type SessionEndReason,
} from '../services/authService';
import { ApiError, onAccessDenied } from '../services/httpClient';
import { fetchAuthConfig, fetchCurrentUser, recordLogin } from '../services/sessionService';
import type { AuthConfig, SessionUser } from '../services/types';

interface SessionValue {
  config: AuthConfig | null;
  user: SessionUser | null;
  loading: boolean;
  bootError: string | null;
  endReason: SessionEndReason | null;
  isAdmin: boolean;
  /** pode conceder/remover acessos e editar o cadastro */
  canEdit: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const ACCESS_RECHECK_MS = 60_000;

const sameAccess = (a: SessionUser, b: SessionUser): boolean => (
  a.email === b.email && a.name === b.name && a.picture === b.picture && a.role === b.role
);

/**
 * Sessão (mesmo desenho das dashboards irmãs): configuração pública do login,
 * usuário logado e o fim da sessão. Encerrar a sessão limpa o usuário e o
 * cache do React Query.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);

  useEffect(() => onSessionEnd((reason) => {
    setUser(null);
    setEndReason(reason);
    queryClient.clear();
  }), [queryClient]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await fetchAuthConfig();
        if (!alive) return;
        setConfig(cfg);
        if (!cfg.enabled) {
          setUser(await fetchCurrentUser());
          return;
        }
        await initGoogleClient(cfg.clientId, cfg.allowedDomain || undefined).catch(() => undefined);
        if (getAccessToken()) {
          const me = await fetchCurrentUser().catch(() => null);
          if (alive && me) setUser(me);
        }
      } catch (err) {
        if (alive) setBootError(err instanceof ApiError ? err.message : 'Não foi possível falar com o servidor.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // o papel pode mudar com a pessoa logada: relê ao voltar para a aba e quando o servidor recusa por permissão
  const signedIn = user !== null;
  const lastCheck = useRef(Date.now());
  useEffect(() => {
    if (!signedIn) return undefined;
    let alive = true;
    const recheck = async (force: boolean) => {
      if (!force && Date.now() - lastCheck.current < ACCESS_RECHECK_MS) return;
      lastCheck.current = Date.now();
      try {
        const me = await fetchCurrentUser();
        if (alive) setUser((prev) => (prev && sameAccess(prev, me) ? prev : me));
      } catch {
        // rede fora: fica como está (o 401 o httpClient já trata encerrando a sessão)
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void recheck(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    const stopDenied = onAccessDenied(() => void recheck(true));
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      stopDenied();
    };
  }, [signedIn]);

  const signIn = useCallback(async () => {
    if (!config?.clientId) throw new Error('Login com Google não configurado no servidor.');
    await initGoogleClient(config.clientId, config.allowedDomain || undefined);
    await signInWithGoogle();
    try {
      const me = await fetchCurrentUser();
      setEndReason(null);
      setUser(me);
      // só registro ("último login" da Administração): se falhar, o login segue normal
      void recordLogin().catch(() => undefined);
    } catch (err) {
      endSession('LOGOUT');
      throw err instanceof ApiError ? new Error(err.message) : err;
    }
  }, [config]);

  const signOut = useCallback(() => {
    endSession('LOGOUT');
  }, []);

  const value = useMemo<SessionValue>(() => ({
    config,
    user,
    loading,
    bootError,
    endReason,
    isAdmin: user?.role === 'ADMIN',
    canEdit: user?.role === 'ADMIN' || user?.role === 'EDITOR',
    signIn,
    signOut,
  }), [config, user, loading, bootError, endReason, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
