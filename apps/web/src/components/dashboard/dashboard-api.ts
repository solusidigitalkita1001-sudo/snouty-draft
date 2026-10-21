/**
 * Panggilan API dashboard admin (P26-05). Peran diperiksa API (`InternalRoleGuard`); klien hanya
 * menyesuaikan tampilan — 401/403 berarti halaman ini bukan untuk akun tersebut.
 */
import { apiFetch, authHeaders } from '../auth/session';

const BASE = '/api/v1/internal';

export type Stage = 'aware' | 'appeal' | 'ask' | 'act' | 'advocate';
export type Priority = 'hot' | 'warm' | 'cold';
export type Scale = 'house' | 'building' | 'district';
export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';

export interface ProspectItem {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly registeredAt: string;
  readonly stage: Stage;
  readonly stageReachedAt: string;
  readonly lastActivityAt: string;
  readonly scale: Scale;
  readonly score: number;
  readonly priority: Priority;
  readonly salesContactConsent: boolean;
  readonly salesRequestedAt: string | null;
  readonly contactable: boolean;
  readonly conversationCount: number;
  readonly lead: {
    readonly salesUserId: string;
    readonly salesName: string;
    readonly status: LeadStatus;
    readonly assignedAt: string;
  } | null;
}

export interface ProspectFilter {
  readonly stage?: Stage | undefined;
  readonly priority?: Priority | undefined;
  readonly scale?: Scale | undefined;
  readonly assignment?: 'assigned' | 'unassigned' | undefined;
  readonly q?: string | undefined;
}

export interface SalesMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly openLeads: number;
}

export type Loaded<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'failed' };

async function get<T>(path: string): Promise<Loaded<T>> {
  try {
    const response = await apiFetch(path, { credentials: 'include', headers: authHeaders() });
    if (response.status === 401 || response.status === 403) return { kind: 'forbidden' };
    if (!response.ok) return { kind: 'failed' };
    return { kind: 'ok', value: (await response.json()) as T };
  } catch {
    return { kind: 'failed' };
  }
}

/** Galat stabil dari API untuk aksi tulis; `null` = berhasil. */
async function send(
  method: 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<string | null> {
  try {
    const response = await apiFetch(path, {
      method,
      credentials: 'include',
      headers: {
        ...authHeaders(),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.ok) return null;
    const error = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; details?: { reason?: string } };
    };
    return error.error?.details?.reason ?? error.error?.code ?? 'GENERIC';
  } catch {
    return 'GENERIC';
  }
}

export function fetchProspects(filter: ProspectFilter): Promise<
  Loaded<{
    readonly funnel: Readonly<Record<Stage, number>>;
    readonly items: readonly ProspectItem[];
  }>
> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (typeof value === 'string' && value !== '') params.set(key, value);
  }
  const query = params.toString();
  return get(`${BASE}/prospects${query ? `?${query}` : ''}`);
}

export const assignProspect = (userId: string, salesUserId: string) =>
  send('POST', `${BASE}/prospects/${userId}/assign`, { salesUserId });

export const fetchSalesTeam = () =>
  get<{ readonly items: readonly SalesMember[] }>(`${BASE}/sales-team`);

export const addSalesMember = (email: string) => send('POST', `${BASE}/sales-team`, { email });

export const removeSalesMember = (userId: string) => send('DELETE', `${BASE}/sales-team/${userId}`);
