import { readFile } from 'node:fs/promises';
import { appConfig } from '../../config/env.config.js';
import type { AccessImportRecord, IgnoredRow, ImportItem, ImportMember, ParsedImport } from '../imports/access-import.service.js';

/**
 * HUB BI direto do Firestore, SOMENTE LEITURA, com uma conta de serviço.
 * Coleções (as mesmas que o backend do HUB BI usa):
 *   DHO_dashboards              — { title, url, description }
 *   DHO_dashboard_access_email  — { dashboardID, email, isActive, createdAt }
 *   DHO_users                   — { name, email, accessLevel: 'Admin' | 'user', createdAt }
 */
export interface HubBiSnapshot {
  dashboards: { id: string; title: string; url: string | null; description: string | null }[];
  /** só as permissões ativas */
  accesses: { id: string; dashboardId: string; email: string; createdAt: Date | null }[];
  users: { email: string; name: string | null; accessLevel: string | null; createdAt: Date | null }[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const iso = (date: Date | null): string | null => (date && !Number.isNaN(date.getTime()) ? date.toISOString() : null);
/** 'Admin' | 'user' -> 'Admin' | 'User' (o mesmo nível que a importação do export grava) */
const level = (value: string | null): string => (value?.trim().toLowerCase() === 'admin' ? 'Admin' : 'User');

/** Do retrato do Firestore para a importação — função pura, testada sem Firestore. */
export function hubBiImport(snapshot: HubBiSnapshot): ParsedImport {
  const items: ImportItem[] = snapshot.dashboards
    .filter((d) => d.title.trim())
    .map((d) => ({
      key: d.id.slice(0, 200),
      name: d.title.trim().slice(0, 200),
      url: d.url && /^https?:\/\/\S+$/i.test(d.url) ? d.url.slice(0, 2000) : null,
      description: d.description?.trim().slice(0, 2000) || null,
    }));
  const nameByKey = new Map(items.map((i) => [i.key, i.name]));

  const members: ImportMember[] = [];
  const nameByEmail = new Map<string, string | null>();
  snapshot.users.forEach((u) => {
    const email = u.email.trim().toLowerCase();
    if (!EMAIL.test(email)) return;
    const name = u.name?.trim() || null;
    nameByEmail.set(email, name);
    members.push({ email, userName: name, rootLevel: level(u.accessLevel), since: iso(u.createdAt) });
  });

  const records: AccessImportRecord[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();
  snapshot.accesses.forEach((a, i) => {
    const rowNumber = i + 1;
    const email = a.email.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      ignored.push({ rowNumber, reason: `e-mail inválido (${email || 'vazio'})` });
      return;
    }
    const dashboardName = nameByKey.get(a.dashboardId);
    if (!dashboardName) {
      ignored.push({ rowNumber, reason: `permissão de ${email} para um dashboard que não existe mais` });
      return;
    }
    const pair = `${email}\u0000${a.dashboardId}`;
    if (seen.has(pair)) return; // o HUB BI às vezes guarda a mesma permissão duas vezes
    seen.add(pair);
    records.push({
      rowNumber,
      resourceKey: a.dashboardId,
      resourceName: dashboardName,
      email,
      userName: nameByEmail.get(email) ?? null,
      rootLevel: null,
      grantedAt: iso(a.createdAt),
      sourceRef: a.id,
    });
  });

  return {
    records,
    ignored,
    rowsRead: snapshot.accesses.length,
    items,
    members,
    notices: [`HUB BI: ${items.length} dashboard(s), ${members.length} usuário(s) no hub, ${records.length} permissão(ões) ativa(s).`],
  };
}

type Firestore = import('firebase-admin/firestore').Firestore;
let firestore: Firestore | null = null;

async function getFirestoreClient(): Promise<Firestore> {
  if (firestore) return firestore;
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const cfg = appConfig.integrations.hubBi;
  const credentials = cfg.credentialsFile
    ? JSON.parse(await readFile(cfg.credentialsFile, 'utf8')) as { project_id?: string }
    : { projectId: cfg.projectId, clientEmail: cfg.clientEmail, privateKey: cfg.privateKey };
  const projectId = cfg.projectId ?? (credentials as { project_id?: string }).project_id;
  // app com nome próprio: não briga com nenhum outro uso do SDK no processo
  const app = getApps().find((a) => a.name === 'hub-bi')
    ?? initializeApp({ credential: cert(credentials as Parameters<typeof cert>[0]), projectId }, 'hub-bi');
  firestore = getFirestore(app);
  return firestore;
}

const toDate = (value: unknown): Date | null => {
  const maybe = value as { toDate?: () => Date } | null | undefined;
  return typeof maybe?.toDate === 'function' ? maybe.toDate() : null;
};
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Lê as três coleções (só os campos usados; cada documento lido é cobrado pelo Firestore). */
export async function fetchHubBiSnapshot(): Promise<HubBiSnapshot> {
  const db = await getFirestoreClient();
  const [dashboards, accesses, users] = await Promise.all([
    db.collection('DHO_dashboards').select('title', 'url', 'description').get(),
    db.collection('DHO_dashboard_access_email').where('isActive', '==', true).select('dashboardID', 'email', 'createdAt').get(),
    db.collection('DHO_users').select('name', 'email', 'accessLevel', 'createdAt').get(),
  ]);
  return {
    dashboards: dashboards.docs.map((d) => ({
      id: d.id, title: str(d.get('title')) ?? '', url: str(d.get('url')), description: str(d.get('description')),
    })),
    accesses: accesses.docs.map((d) => ({
      id: d.id, dashboardId: str(d.get('dashboardID')) ?? '', email: str(d.get('email')) ?? '', createdAt: toDate(d.get('createdAt')),
    })),
    users: users.docs.map((d) => ({
      email: str(d.get('email')) ?? '', name: str(d.get('name')), accessLevel: str(d.get('accessLevel')), createdAt: toDate(d.get('createdAt')),
    })),
  };
}

export async function closeHubBi(): Promise<void> {
  if (!firestore) return;
  await firestore.terminate().catch(() => undefined);
  firestore = null;
}
