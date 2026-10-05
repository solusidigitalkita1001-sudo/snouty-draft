/**
 * Panggilan API auth. `credentials: 'include'` di setiap panggilan: refresh token hidup di
 * cookie `httpOnly`, dan permintaan tanpa cookie adalah sesi baru setiap kali.
 */

import { setAccessToken, setCurrentUser } from './session';

const BASE = '/api/v1';

export interface AuthResult {
  readonly ok: boolean;
  /** Kode galat stabil dari API — dipetakan ke teks oleh komponen, bukan ditampilkan mentah. */
  readonly code?: string;
  /** Percakapan tamu yang berpindah ke akun (invarian G-1). */
  readonly resumedConversationId?: string | null;
}

async function post(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        accessToken?: string;
        resumedConversationId?: string | null;
        name?: string;
        tier?: string;
      };
      // Disimpan di memori supaya permintaan berikutnya dikenali sebagai pengguna, bukan
      // tamu. Tanpa ini, login "berhasil" tetapi API tetap melihat tamu dan menolak
      // riwayat dengan 403.
      if (data.accessToken) setAccessToken(data.accessToken);
      if (data.name && data.tier) setCurrentUser({ name: data.name, tier: data.tier });
      return { ok: true, resumedConversationId: data.resumedConversationId ?? null };
    }

    const error = (await response.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    return { ok: false, code: error.error?.code ?? 'GENERIC' };
  } catch {
    return { ok: false, code: 'GENERIC' };
  }
}

export const login = (email: string, password: string): Promise<AuthResult> =>
  post('/auth/login', { email, password });

export const register = (name: string, email: string, password: string): Promise<AuthResult> =>
  post('/auth/register', { name, email, password });
