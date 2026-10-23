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

// ── Dashboard sales (P26-06) ────────────────────────────────────────────────

export interface LeadProject {
  readonly conversationId: string;
  readonly title: string | null;
  readonly updatedAt: string;
  readonly buildingType: string | null;
  readonly floors: number | null;
  readonly bathrooms: number | null;
  readonly waterSource: string | null;
  readonly caseId: string | null;
  readonly headline: string | null;
  readonly mainSize: string | null;
  readonly products: readonly {
    readonly name: string;
    readonly family: string | null;
    readonly size: string | null;
  }[];
}

export interface LeadDetail {
  readonly status: LeadStatus;
  readonly lostReason: string | null;
  readonly assignedAt: string;
  /** Kapan prospek ini ditengok lagi (P27-09); `null` = belum dijadwalkan. */
  readonly followUpAt: string | null;
  readonly context: { readonly text: string; readonly generatedAt: string } | null;
  readonly prospect: ProspectItem | null;
  readonly facts: {
    readonly projects: readonly LeadProject[];
    readonly reports: number;
    readonly shares: number;
    readonly salesRequest: { readonly source: string; readonly at: string } | null;
    readonly quotes: readonly { readonly text: string; readonly at: string }[];
  };
}

export interface TranscriptLine {
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly at: string;
}

/** Satu baris jejak tindak lanjut (P27-09). */
export interface LeadActivityItem {
  readonly id: string;
  readonly kind: 'note' | 'status' | 'follow_up' | 'assigned';
  readonly actorName: string | null;
  readonly note: string | null;
  readonly status: LeadStatus | null;
  readonly followUpAt: string | null;
  readonly at: string;
}

const LEADS = `${BASE}/leads`;

export const fetchMyLeads = () => get<{ readonly items: readonly ProspectItem[] }>(`${LEADS}/mine`);

export const fetchLead = (userId: string) => get<LeadDetail>(`${LEADS}/${userId}`);

export const fetchLeadActivity = (userId: string) =>
  get<{ readonly items: readonly LeadActivityItem[] }>(`${LEADS}/${userId}/activity`);

export const addLeadNote = (userId: string, note: string) =>
  send('POST', `${LEADS}/${userId}/notes`, { note });

/** `null` menghapus jadwalnya. */
export const setLeadFollowUp = (userId: string, at: string | null) =>
  send('POST', `${LEADS}/${userId}/follow-up`, { at });

export const setLeadStatus = (userId: string, status: LeadStatus, lostReason?: string) =>
  send('POST', `${LEADS}/${userId}/status`, {
    status,
    ...(lostReason !== undefined ? { lostReason } : {}),
  });

/** Paragraf konteks baru; `null` bila model tidak tersedia atau paragrafnya gagal pagar. */
export async function refreshLeadContext(
  userId: string,
): Promise<{ readonly text: string; readonly generatedAt: string } | null | 'failed'> {
  try {
    const response = await apiFetch(`${LEADS}/${userId}/context`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!response.ok) return 'failed';
    const body = (await response.json()) as {
      context: { text: string; generatedAt: string } | null;
    };
    return body.context;
  } catch {
    return 'failed';
  }
}

export const fetchTranscript = (userId: string, conversationId: string) =>
  get<{ readonly items: readonly TranscriptLine[] }>(
    `${LEADS}/${userId}/conversations/${conversationId}`,
  );

// ── Dashboard pasar (P26-07) ────────────────────────────────────────────────

export interface AggregateResult {
  readonly buckets: readonly { readonly key: string; readonly count: number }[];
  readonly suppressedGroups: number;
  readonly suppressedEvents: number;
}

export interface MapDemand {
  readonly provinces: readonly { readonly name: string; readonly count: number }[];
  readonly points: readonly {
    readonly city: string;
    readonly province: string;
    readonly lat: number;
    readonly lng: number;
    readonly count: number;
  }[];
  readonly withoutRegion: number;
  readonly suppressedPoints: number;
}

export interface MarketDashboard {
  readonly fromDay: string;
  readonly total: number;
  readonly regional: AggregateResult;
  readonly productInterest: AggregateResult;
  readonly projects: AggregateResult;
  readonly scope: {
    readonly total: number;
    readonly routedToTechnical: number;
    readonly ratio: number;
  };
  readonly drainage: number;
  readonly map: MapDemand;
  readonly funnel: {
    readonly started: number;
    readonly reachedSolution: number;
    readonly routedToTechnical: number;
    readonly requestedQuotation: number;
  };
}

export const fetchMarket = (days: number) => get<MarketDashboard>(`${BASE}/market?days=${days}`);
