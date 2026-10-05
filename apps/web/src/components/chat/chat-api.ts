/**
 * Klien chat — membuat percakapan dan mengalirkan satu giliran lewat SSE.
 *
 * `POST /conversations/:id/messages` membawa body (pesan), jadi `EventSource`
 * (yang hanya GET) tidak bisa dipakai; kita membaca `ReadableStream` respons dan
 * mem-parse bingkai `event:`/`data:` sendiri. `credentials: 'include'` di setiap
 * panggilan karena sesi tamu hidup di cookie `httpOnly`.
 */

import type {
  AssistantCard,
  AssistantStreamEvent,
  Recommendation,
  RequirementState,
} from '@snouty/shared-types';

import { authHeaders } from '../auth/session';

const BASE = '/api/v1';

export interface ConversationSummary {
  readonly id: string;
  readonly title: string | null;
  readonly status: string;
  readonly stage: string;
  readonly updatedAt: string;
}

export async function createConversation(): Promise<ConversationSummary> {
  const response = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`conversations ${response.status}`);
  return (await response.json()) as ConversationSummary;
}

/**
 * Mengirim pesan dan memanggil `onEvent` untuk tiap event yang tiba. Mengembalikan
 * saat stream ditutup server (`message.end`).
 */
export async function sendMessage(
  conversationId: string,
  text: string,
  onEvent: (event: AssistantStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || !response.body) throw new Error(`messages ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Bingkai SSE dipisah baris kosong; proses yang lengkap, simpan sisanya.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseFrame(frame);
      if (parsed) onEvent(parsed);
      boundary = buffer.indexOf('\n\n');
    }
  }
}

function parseFrame(frame: string): AssistantStreamEvent | null {
  const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice('data:'.length).trim()) as AssistantStreamEvent;
  } catch {
    return null;
  }
}

/**
 * "Kirim ke tim teknis Pralon" (layar 11). Kebutuhan yang sudah terkumpul disalin di
 * sisi server, jadi permintaan ini hanya perlu membawa alasannya.
 */
export async function sendToTechnicalTeam(
  conversationId: string,
  reason: string,
): Promise<{ readonly id: string; readonly capturedCount: number } | null> {
  const response = await fetch(`${BASE}/conversations/${conversationId}/handoff`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) return null;
  return (await response.json()) as { id: string; capturedCount: number };
}

/**
 * Riwayat percakapan (layar 12). Digerbang `CONVERSATION_HISTORY` di API — tamu
 * menerima 403, dan itu BUKAN kegagalan: UI menampilkan ajakan mendaftar alih-alih
 * daftar kosong, karena daftar kosong akan terbaca "Anda belum pernah berkonsultasi".
 */
export type HistoryResult =
  | { readonly kind: 'ok'; readonly items: readonly ConversationSummary[] }
  | { readonly kind: 'not_entitled' }
  | { readonly kind: 'error' };

export async function fetchHistory(): Promise<HistoryResult> {
  const response = await fetch(`${BASE}/conversations`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (response.status === 403) return { kind: 'not_entitled' };
  if (!response.ok) return { kind: 'error' };
  const body = (await response.json()) as { items: readonly ConversationSummary[] };
  return { kind: 'ok', items: body.items };
}

/** "Simpan hasil konsultasi" — digerbang `SAVE_SOLUTION`. */
export async function saveConversation(conversationId: string): Promise<boolean> {
  const response = await fetch(`${BASE}/conversations/${conversationId}/save`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  return response.ok;
}

/**
 * Menjalankan analisis dan mengalirkan empat tahap terakhir. Dipakai tombol "Analisis
 * kebutuhan" pada kartu CTA; kembalinya `recommendationId` bila solusi tersusun.
 */
export async function runAnalysis(
  conversationId: string,
  onEvent: (event: AssistantStreamEvent) => void,
): Promise<string | null> {
  let recommendationId: string | null = null;

  const response = await fetch(`${BASE}/conversations/${conversationId}/analyze`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok || !response.body) throw new Error(`analyze ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseFrame(frame);
      if (parsed) {
        if (parsed.type === 'solution.ready') recommendationId = parsed.recommendationId;
        onEvent(parsed);
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  return recommendationId;
}

/** Rekomendasi yang sudah tersimpan — dirender `SolutionView`. */
export async function fetchRecommendation(id: string): Promise<Recommendation | null> {
  const response = await fetch(`${BASE}/recommendations/${id}`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok) return null;
  return (await response.json()) as Recommendation;
}

/** Satu percakapan beserta pesannya — untuk membuka kembali riwayat (layar 12). */
export interface ConversationDetail extends ConversationSummary {
  readonly messages: readonly {
    readonly id: string;
    readonly role: 'user' | 'assistant' | string;
    readonly text: string;
    readonly cards: readonly AssistantCard[];
  }[];
}

export async function fetchConversation(id: string): Promise<ConversationDetail | null> {
  const response = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok) return null;
  return (await response.json()) as ConversationDetail;
}

/** State kebutuhan terkini — mengisi ulang panel kanan saat riwayat dibuka kembali. */
export async function fetchRequirement(id: string): Promise<RequirementState | null> {
  const response = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}/requirement`, {
    credentials: 'include',
    headers: authHeaders(),
  });
  if (!response.ok) return null;
  return ((await response.json()) as { state: RequirementState | null }).state;
}

/** Label versi katalog aktif — badge "KATALOG PRALON · v2.4" di layar sambutan. */
export async function fetchCatalogVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE}/catalog/version`, { credentials: 'include' });
    if (!response.ok) return null;
    return ((await response.json()) as { label: string }).label;
  } catch {
    return null;
  }
}

/** Edit inline panel kanan — PATCH tanpa LLM; `null` bila ditolak (validasi/kepemilikan). */
export async function patchRequirement(
  id: string,
  edits: ReadonlyArray<{ readonly path: string; readonly value: unknown }>,
): Promise<RequirementState | null> {
  const response = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}/requirement`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ edits }),
  });
  if (!response.ok) return null;
  return ((await response.json()) as { state: RequirementState }).state;
}
