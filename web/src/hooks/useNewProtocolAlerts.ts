import { useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { useProtocols } from './useProtocols';

const STORAGE_KEY = 'access-control.seen-protocols';
const OPEN_FILTER = { state: 'OPEN' as const };

function readSeen(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : null;
  } catch {
    return null;
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    // só os últimos 500: a fila aberta nunca chega perto disso
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    // sem storage: o aviso vale só enquanto a aba estiver aberta
  }
}

/**
 * "Tempo real" da fila: a cada releitura do Voalle (3 min), protocolo aberto que este
 * navegador ainda não viu vira aviso na tela — e notificação do sistema, se a
 * pessoa permitiu. Na primeira visita só memoriza a fila, sem avisar.
 */
export function useNewProtocolAlerts(): void {
  const { data } = useProtocols(OPEN_FILTER);
  const { notify } = useToast();
  const seenRef = useRef<Set<string> | null>(readSeen());

  useEffect(() => {
    if (!data) return;
    const numbers = data.data.map((p) => p.protocolNumber);
    if (!seenRef.current) {
      seenRef.current = new Set(numbers);
      writeSeen(seenRef.current);
      return;
    }
    const seen = seenRef.current;
    const fresh = data.data.filter((p) => !seen.has(p.protocolNumber));
    if (!fresh.length) return;
    fresh.forEach((p) => seen.add(p.protocolNumber));
    writeSeen(seen);

    const first = fresh[0]!;
    const title = fresh.length === 1 ? `Novo protocolo ${first.protocolNumber}` : `${fresh.length} protocolos novos na fila`;
    const description = fresh.length === 1
      ? `${first.requesterName ?? 'Solicitante'} · ${first.requestedItems[0] ?? first.category2 ?? 'Gestão de Acessos'}`
      : fresh.map((p) => p.protocolNumber).join(', ');
    notify({ tone: 'info', title, description });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        new Notification(title, { body: description, icon: '/logo-circular-sebratel.png', tag: 'access-control-queue' });
      } catch {
        // alguns navegadores só notificam por service worker — o aviso na tela já basta
      }
    }
  }, [data, notify]);
}
