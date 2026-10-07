/**
 * Panggilan API auth. `credentials: 'include'` di setiap panggilan: refresh token hidup di
 * cookie `httpOnly`, dan permintaan tanpa cookie adalah sesi baru setiap kali.
 */

import { authHeaders, setAccessToken, setCurrentUser } from './session';

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

// ── Halaman akun (OQ-53) ─────────────────────────────────────────────────────

export interface Profile {
  readonly name: string;
  readonly email: string;
  readonly tier: string;
}

export interface ProfileResult {
  readonly ok: boolean;
  readonly code?: string;
  /** `details.reason` dari API: `current_password` membedakan sandi lama salah dari sandi baru lemah. */
  readonly reason?: string;
  readonly profile?: Profile;
}

async function call(
  method: 'GET' | 'PATCH' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<ProfileResult> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...authHeaders(),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 204) return { ok: true };
    if (response.ok) {
      const data = (await response.json()) as Partial<Profile>;
      if (data.name && data.email && data.tier) {
        const profile = { name: data.name, email: data.email, tier: data.tier };
        // Nama di sidebar ikut berubah tanpa muat ulang.
        setCurrentUser({ name: profile.name, tier: profile.tier });
        return { ok: true, profile };
      }
      return { ok: true };
    }
    const error = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; details?: { reason?: string } };
    };
    return {
      ok: false,
      code: error.error?.code ?? 'GENERIC',
      ...(error.error?.details?.reason ? { reason: error.error.details.reason } : {}),
    };
  } catch {
    return { ok: false, code: 'GENERIC' };
  }
}

export const fetchProfile = (): Promise<ProfileResult> => call('GET', '/auth/me');

export const updateName = (name: string): Promise<ProfileResult> =>
  call('PATCH', '/auth/me', { name });

export const changePassword = (
  currentPassword: string,
  newPassword: string,
): Promise<ProfileResult> => call('POST', '/auth/password', { currentPassword, newPassword });

/** Keluar: cabut di server, lalu lupakan token dan profil di memori. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Server tidak terjangkau: sesi lokal tetap dibuang; cookie-nya kedaluwarsa sendiri.
  }
  setAccessToken(null);
}

export const register = (name: string, email: string, password: string): Promise<AuthResult> =>
  post('/auth/register', { name, email, password });
