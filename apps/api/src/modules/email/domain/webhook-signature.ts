/**
 * Verifikasi tanda tangan webhook n8n. docs/SECURITY.md §5. **Fungsi murni.**
 *
 * Dua hal yang biasa salah di verifikasi HMAC, dan keduanya dicegah di sini:
 *
 * **Perbandingan waktu-konstan.** `a === b` keluar lebih awal pada byte pertama yang
 * berbeda, sehingga lama perbandingannya membocorkan berapa banyak prefiks yang benar —
 * cukup untuk menebak tanda tangan byte demi byte. `timingSafeEqual` tidak keluar awal.
 *
 * **Tanda tangan dihitung atas RAW BODY, bukan atas JSON yang sudah di-parse lalu
 * di-stringify ulang.** `JSON.parse` lalu `JSON.stringify` mengubah urutan kunci dan spasi,
 * jadi tanda tangan yang sah akan ditolak — dan "perbaikan" yang biasa dilakukan orang
 * adalah melemahkan verifikasinya.
 *
 * Ada juga jendela waktu: tanda tangan yang sah tetapi berumur jam-jaman adalah replay.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Umur maksimum tanda tangan. Di luar ini, permintaan ditolak sebagai replay. */
export const SIGNATURE_MAX_AGE_SECONDS = 300;

export interface VerifyInput {
  /** Badan permintaan apa adanya — BUKAN hasil parse lalu stringify ulang. */
  readonly rawBody: string;
  readonly signatureHeader: string | undefined;
  /** Unix epoch detik dari header `x-snouty-timestamp`. */
  readonly timestampHeader: string | undefined;
  readonly secret: string;
  /** `now` disuntikkan demi determinisme pengujian. */
  readonly nowSeconds: number;
}

export type VerifyResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'missing' | 'stale' | 'mismatch' };

export function verifyWebhookSignature(input: VerifyInput): VerifyResult {
  if (!input.signatureHeader || !input.timestampHeader) return { ok: false, reason: 'missing' };

  const timestamp = Number.parseInt(input.timestampHeader, 10);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'missing' };

  // Jendela dua arah: jam pengirim bisa sedikit di depan, dan menolak itu akan membuat
  // integrasi gagal karena selisih detik.
  if (Math.abs(input.nowSeconds - timestamp) > SIGNATURE_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale' };
  }

  const expected = sign(input.rawBody, input.timestampHeader, input.secret);
  const provided = Buffer.from(input.signatureHeader, 'utf8');
  const computed = Buffer.from(expected, 'utf8');

  // Panjang berbeda tidak boleh masuk ke `timingSafeEqual` (ia melempar), tetapi
  // memeriksanya lebih dulu juga tidak membocorkan apa pun: panjang tanda tangan tetap.
  if (provided.length !== computed.length) return { ok: false, reason: 'mismatch' };
  if (!timingSafeEqual(provided, computed)) return { ok: false, reason: 'mismatch' };

  return { ok: true };
}

/**
 * Tanda tangan = HMAC-SHA256 atas `timestamp.rawBody`. Timestamp ikut ditandatangani;
 * tanpa itu, penyerang bisa memakai ulang tanda tangan lama dengan timestamp baru.
 */
export function sign(rawBody: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}
