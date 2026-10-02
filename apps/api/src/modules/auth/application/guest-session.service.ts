/**
 * Sesi tamu. docs/SECURITY.md §3 · docs/DOMAIN_MODEL.md §3.
 *
 * Tiga keputusan:
 *
 * **Id dari cookie tidak pernah dipercaya tanpa baris database.** Cookie hanyalah
 * klaim; sesi yang tidak ada barisnya, sudah kedaluwarsa, atau sudah ditautkan ke
 * akun diganti dengan sesi baru. Menghormati id yang tidak dikenal berarti
 * penyerang bisa memilih id sesinya sendiri sebelum korban memakainya
 * (session fixation).
 *
 * **Sesi yang dipakai digeser kedaluwarsanya** (sliding TTL). TTL yang kaku
 * memutus percakapan tamu tepat di tengah — pengalaman yang oleh SPEC §4.4
 * dijanjikan tidak terjadi.
 *
 * **Sesi yang sudah tertaut ke akun tidak dipakai lagi sebagai sesi tamu.**
 * Setelah penautan (P3-06), pemegang cookie lama adalah pengguna terdaftar yang
 * punya token — atau orang lain yang menyalin cookie-nya. Keduanya tidak boleh
 * melanjutkan sesi tamu itu.
 */

import { ulid } from '../../../shared/ulid.js';
import type { GuestSessionRepository } from '../domain/guest-session.repository.js';

export interface EnsuredGuestSession {
  readonly id: string;
  readonly expiresAt: Date;
  /** `true` bila cookie baru harus dikirim — sesi baru ATAU kedaluwarsa bergeser. */
  readonly setCookie: boolean;
}

export class GuestSessionService {
  constructor(
    private readonly repository: GuestSessionRepository,
    /** Detik — `GUEST_SESSION_TTL` dari env. */
    private readonly ttlSeconds: number,
  ) {}

  async ensure(claimedId: string | undefined): Promise<EnsuredGuestSession> {
    if (claimedId !== undefined && isUlidShaped(claimedId)) {
      const row = await this.repository.findById(claimedId);
      const usable =
        row !== null && row.linkedUserId === null && row.expiresAt.getTime() > Date.now();

      if (usable) {
        const expiresAt = this.horizon();
        await this.repository.touch(row.id, expiresAt);
        return { id: row.id, expiresAt, setCookie: true };
      }
    }

    const id = ulid();
    const expiresAt = this.horizon();
    await this.repository.create({ id, expiresAt });
    return { id, expiresAt, setCookie: true };
  }

  private horizon(): Date {
    return new Date(Date.now() + this.ttlSeconds * 1_000);
  }
}

/**
 * Bentuk ULID diperiksa SEBELUM menyentuh database: cookie adalah masukan yang
 * sepenuhnya dikendalikan klien, dan nilai 4 KB penuh karakter aneh tidak pantas
 * menjadi parameter query — walaupun query-nya berparameter.
 */
function isUlidShaped(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
