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
    const body = (await response.json()) as { accessToken?: string };
    if (!body.accessToken) return false;
    setAccessToken(body.accessToken);
    return true;
  } catch {
    return false;
  }
}
