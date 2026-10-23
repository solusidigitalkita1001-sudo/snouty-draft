/**
 * Panggilan API pemberitahuan (P27-07). Satu tempat, bukan `fetch` yang tersebar di komponen.
 *
 * Server menyimpan KEJADIAN, bukan kalimat: `kind` + `subjectId` + `data`. Kalimatnya dirakit di
 * `notification-copy.ts` per bahasa — teks Indonesia yang dibekukan di database tidak bisa
 * berbahasa Inggris nanti.
 */
import { apiFetch, authHeaders } from '../auth/session';

const BASE = '/api/v1';

export type NotificationKind = 'lead_assigned' | 'contact_requested' | 'report_ready';

export interface NotificationItem {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly subjectId: string | null;
  readonly data: Readonly<Record<string, string | number | null>>;
  readonly read: boolean;
  readonly createdAt: string;
}

export interface NotificationFeed {
  readonly unread: number;
  readonly items: readonly NotificationItem[];
}

const EMPTY: NotificationFeed = { unread: 0, items: [] };

/** Tamu dan kegagalan jaringan sama-sama "tidak ada apa-apa" — lonceng tidak boleh berisik. */
export async function fetchNotifications(): Promise<NotificationFeed> {
  try {
    const response = await apiFetch(`${BASE}/notifications`, {
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!response.ok) return EMPTY;
    return (await response.json()) as NotificationFeed;
  } catch {
    return EMPTY;
  }
}

/** Tanpa `ids`: semuanya. */
export async function markNotificationsRead(ids: readonly string[] = []): Promise<void> {
  try {
    await apiFetch(`${BASE}/notifications/read`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(ids.length > 0 ? { ids } : {}),
    });
  } catch {
    // Menandai terbaca bukan pekerjaan yang layak mengganggu siapa pun bila gagal.
  }
}
