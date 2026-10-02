/**
 * Galat autentikasi — satu pesan untuk semua penyebab, dan itu intinya.
 *
 * Token tidak dikenal, kedaluwarsa, dicabut, atau terdeteksi dipakai ulang:
 * semuanya keluar sebagai `UNAUTHENTICATED` dengan kalimat yang sama. Membedakan
 * pesannya memberi penyerang osilograf gratis — "dicabut" memberi tahu bahwa
 * tokennya pernah sah, "dipakai ulang" memberi tahu deteksinya ada. Yang berhak
 * tahu detailnya adalah log server, bukan responsnya.
 */

export class InvalidRefreshTokenError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;

  constructor(
    /** Untuk log server saja; `ApiErrorFilter` tidak pernah meneruskannya. */
    readonly reason: 'unknown' | 'expired' | 'revoked' | 'reused',
  ) {
    super('Silakan masuk terlebih dahulu.');
    this.name = 'InvalidRefreshTokenError';
  }
}
