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
import type { Locale } from '@snouty/shared-types';

const BASE = '/api/v1';

export interface ConversationSummary {
  readonly id: string;
  readonly title: string | null;
  readonly status: string;
  readonly stage: string;
  readonly updatedAt: string;
}

/** Bahasa ditetapkan saat percakapan dibuat (Fase 15) — percakapan lama tetap dalam bahasanya. */
export async function createConversation(language: Locale = 'id'): Promise<ConversationSummary> {
  const response = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ language }),
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

/** Soft delete dari riwayat — datanya tetap ada, jadi bisa diurungkan. */
export async function deleteConversation(id: string): Promise<boolean> {
  const response = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  });
  return response.ok;
}

/** "Urungkan" setelah menghapus. */
export async function restoreConversation(id: string): Promise<boolean> {
  const response = await fetch(`${BASE}/conversations/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  return response.ok;
}

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
/** `needs-account`: tamu — menyimpan dibuka oleh akun terdaftar (register-gate, P8-09). */
export type SaveResult = 'saved' | 'needs-account' | 'failed';

export async function saveConversation(conversationId: string): Promise<SaveResult> {
  const response = await fetch(`${BASE}/conversations/${conversationId}/save`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  });
  if (response.ok) return 'saved';
  return response.status === 401 || response.status === 403 ? 'needs-account' : 'failed';
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

export interface ClarificationResult {
  readonly state: RequirementState;
  /** Ringkasan jawaban, jadi gelembung pengguna — "Sumber air: Toren atap · …". */
  readonly userText: string;
  /** Kartu lanjutan: klarifikasi lagi, CTA analisis, atau kartu kebijakan. */
  readonly card: AssistantCard | null;
  /** Semua kartu giliran ini (pertanyaan berpilihan lalu tindak lanjut); server lama hanya `card`. */
  readonly cards?: readonly AssistantCard[];
  /** Balasan asisten atas jawaban — bisa kosong hanya bila kartunya kebijakan. */
  readonly text?: string;
}

/** Jawaban kartu klarifikasi, semua sekaligus — tanpa LLM; `null` bila ditolak. */
export async function submitClarification(
  id: string,
  answers: ReadonlyArray<{ readonly id: string; readonly option: string }>,
): Promise<ClarificationResult | null> {
  const response = await fetch(
    `${BASE}/conversations/${encodeURIComponent(id)}/requirement/clarification`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as ClarificationResult;
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

export type UploadPlanResult =
  | { readonly kind: 'ok'; readonly userText: string; readonly replyText: string }
  /** Ditolak dengan pesan yang aman ditampilkan (tipe, ukuran, kuota). */
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'error' };

/** "Lampirkan denah" — `POST /uploads` multipart (P13-06). */
export async function uploadPlan(conversationId: string, file: File): Promise<UploadPlanResult> {
  const form = new FormData();
  form.append('conversationId', conversationId);
  form.append('file', file);
  let response: Response;
  try {
    response = await fetch(`${BASE}/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: form,
    });
  } catch {
    return { kind: 'error' };
  }
  if (response.ok) {
    const body = (await response.json()) as { userText: string; replyText: string };
    return { kind: 'ok', userText: body.userText, replyText: body.replyText };
  }
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  const code = body?.error?.code;
  if ((code === 'UPLOAD_REJECTED' || code === 'RATE_LIMITED') && body?.error?.message) {
    return { kind: 'rejected', message: body.error.message };
  }
  return { kind: 'error' };
}
