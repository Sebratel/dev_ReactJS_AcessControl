import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';
import { endSession, getAccessToken, renewAccessToken } from './authService';

/**
 * O ÚNICO cliente HTTP da aplicação. Toda chamada passa por aqui para levar o
 * token — uma chamada "crua" esquecida num botão tomaria 401 em silêncio.
 */
export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  // listas vão como parâmetro repetido (?base=A&base=B): há valores do Voalle
  // com vírgula dentro, então separar por vírgula quebraria a seleção
  paramsSerializer: { indexes: null },
});

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  retriedAfterRenewal?: boolean;
}

const accessDeniedListeners = new Set<() => void>();

/**
 * O servidor recusou por permissão (403 — ex.: um administrador mudou o
 * papel da pessoa com a tela aberta): quem escuta (a sessão) relê o
 * /auth/me, e o que a pessoa não pode mais fazer some da tela.
 */
export function onAccessDenied(listener: () => void): () => void {
  accessDeniedListeners.add(listener);
  return () => {
    accessDeniedListeners.delete(listener);
  };
}

httpClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  if (error.response?.status === 403) accessDeniedListeners.forEach((listener) => listener());
  if (error.response?.status === 401 && config && !config.retriedAfterRenewal) {
    config.retriedAfterRenewal = true;
    try {
      await renewAccessToken();
      return await httpClient.request(config);
    } catch {
      endSession('EXPIRED');
    }
  }
  return Promise.reject(toApiError(error));
});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorEnvelope {
  success: false;
  error?: { code?: string; message?: string };
}

/** Erro do servidor no envelope padrão -> mensagem legível; rede -> texto claro. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    if (axios.isCancel(error)) return new ApiError(0, 'REQUEST_CANCELED', 'Requisição cancelada.');
    const body = error.response?.data as ErrorEnvelope | undefined;
    if (error.response) {
      return new ApiError(
        error.response.status,
        body?.error?.code ?? 'HTTP_ERROR',
        body?.error?.message ?? `O servidor respondeu ${error.response.status}.`,
      );
    }
    return new ApiError(0, 'NETWORK_ERROR', 'Não foi possível falar com o servidor. Verifique a conexão.');
  }
  return new ApiError(0, 'UNKNOWN', 'Erro inesperado.');
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** GET que desembrulha o envelope `{ success, data }`. */
export async function getData<T>(url: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await httpClient.get<SuccessEnvelope<T>>(url, { params, signal });
  return response.data.data;
}

/** GET que devolve dados e `meta` (paginação, resumo da fila). */
export async function getWithMeta<T, M = Record<string, unknown>>(
  url: string,
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ data: T; meta: M }> {
  const response = await httpClient.get<SuccessEnvelope<T>>(url, { params, signal });
  return { data: response.data.data, meta: (response.data.meta ?? {}) as M };
}

export async function postData<T>(url: string, body?: unknown): Promise<T> {
  const response = await httpClient.post<SuccessEnvelope<T>>(url, body ?? {});
  return response.data.data;
}

export async function patchData<T>(url: string, body: unknown): Promise<T> {
  const response = await httpClient.patch<SuccessEnvelope<T>>(url, body);
  return response.data.data;
}

export async function deleteResource(url: string, params?: Record<string, unknown>): Promise<void> {
  await httpClient.delete(url, { params });
}
