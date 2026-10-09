/**
 * Access token sisi klien. docs/SECURITY.md §3.
 *
 * **Di memori, bukan `localStorage`.** Token di `localStorage` bisa dibaca skrip apa pun
 * yang berhasil berjalan di halaman, dan ia bertahan melewati penutupan tab — dua sifat
 * yang justru tidak diinginkan untuk kredensial. Refresh token hidup di cookie `httpOnly`
 * yang tidak bisa dibaca JavaScript sama sekali, dan itulah yang memulihkan sesi setelah
 * muat ulang.
 *
 * Konsekuensi yang diterima: muat ulang halaman menghapus access token, dan permintaan
 * berikutnya memakai `POST /auth/refresh` untuk mendapatkan yang baru.
 */

let accessToken: string | null = null;

/**
 * Penanda "browser ini pernah masuk" — BUKAN kredensial, hanya petunjuk bahwa cookie
 * refresh mungkin ada. Tanpa penanda, pemulihan sesi dilewati: tamu tidak pernah punya
 * cookie refresh, dan menembak `/auth/refresh` lalu `/conversations` untuknya hanya
 * menghasilkan 401 dan 403 di console yang terlihat seperti kerusakan.
 */
const SESSION_HINT = 'snouty.session';

function hintSession(present: boolean): void {
  try {
    if (present) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    // Mode privat / storage diblokir: tanpa penanda, pemulihan tetap dicoba.
  }
}

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return true;
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  hintSession(token !== null);
  if (token === null) currentUser = null;
}

/** Profil ringan dari respons login/register/refresh — untuk footer sidebar, bukan otorisasi. */
export interface CurrentUser {
  readonly name: string;
  readonly tier: string;
}

let currentUser: CurrentUser | null = null;

export function setCurrentUser(user: CurrentUser | null): void {
  currentUser = user;
}

export function getCurrentUser(): CurrentUser | null {
  return currentUser;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Header otorisasi bila ada token. Mengembalikan objek kosong — bukan `undefined` —
 * supaya pemanggil bisa menyebarnya tanpa percabangan.
 */
export function authHeaders(): Record<string, string> {
  return accessToken === null ? {} : { authorization: `Bearer ${accessToken}` };
}

/**
 * Memulihkan sesi dari cookie refresh. Dipanggil sekali saat aplikasi dimuat: tanpa ini,
 * muat ulang halaman membuat pengguna yang sudah masuk terlihat seperti tamu — API akan
 * menolak riwayatnya dengan 403, dan itu persis gejala yang membingungkan.
 */
export async function restoreSession(): Promise<boolean> {
  if (!hasSessionHint()) return false;
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      // Cookie-nya sudah kedaluwarsa atau dicabut: jangan tembak lagi di muat berikutnya.
      if (response.status === 401) hintSession(false);
      return false;
    }
    const body = (await response.json()) as {
      accessToken?: string;
      name?: string;
      tier?: string;
    };
    if (!body.accessToken) return false;
    setAccessToken(body.accessToken);
    if (body.name && body.tier) setCurrentUser({ name: body.name, tier: body.tier });
    return true;
  } catch {
    return false;
  }
}

let refreshing: Promise<boolean> | null = null;

/** Satu pembaruan sesi untuk semua permintaan yang kena 401 bersamaan. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= restoreSession().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withAuth(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token !== null) headers.set('authorization', `Bearer ${token}`);
  else headers.delete('authorization');
  return { ...init, headers };
}

/**
 * `fetch` ke API dengan token akun terbaru. Access token hanya berumur 15 menit; begitu
 * kedaluwarsa API menjawab 401 `TOKEN_EXPIRED` — sesi dipulihkan dari cookie refresh lalu
 * permintaannya diulang SEKALI (laporan pemilik 2026-10-09: "Susun rekomendasi" 404 setelah
 * percakapan dibiarkan 16 menit, karena dulu token kedaluwarsa diam-diam diperlakukan sebagai tamu).
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, withAuth(init));
  if (response.status !== 401 || getAccessToken() === null) return response;
  if (!(await refreshOnce())) return response;
  return fetch(input, withAuth(init));
}
