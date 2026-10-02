/**
 * Port penyimpanan refresh token. docs/SECURITY.md §3.
 *
 * Seluruh method menerima dan mengembalikan **hash** token, tidak pernah tokennya.
 * Nilai mentahnya hanya hidup di dua tempat: cookie milik klien, dan beberapa baris
 * kode di `TokenService` antara pembuatan dan pengiriman. Port yang menerima token
 * mentah adalah port yang suatu hari mencatatnya ke log.
 */

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRow {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  /** Terisi saat token ini dirotasi. Pemakaian kedua setelah ini adalah sinyal serangan. */
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface NewRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(token: NewRefreshToken): Promise<void>;

  findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null>;

  /** Menandai token terpakai (rotasi). Barisnya TIDAK dihapus — ia alat deteksi. */
  markUsed(id: string): Promise<void>;

  /**
   * Mencabut seluruh rantai rotasi sekaligus.
   *
   * Dipanggil pada dua peristiwa: logout, dan deteksi pemakaian ulang. Pada yang
   * kedua, mencabut hanya satu token berarti penyerang yang memegang token hasil
   * rotasi berikutnya tetap masuk — justru rantainya yang harus putus.
   */
  revokeFamily(familyId: string): Promise<void>;
}
