/**
 * Daur hidup token. docs/SECURITY.md §3.
 *
 * Dua jenis token, dan bedanya disengaja:
 *
 *   - **Access token** adalah JWT berumur pendek yang diverifikasi tanpa database.
 *     Itu gunanya: setiap permintaan tidak membayar satu query. Konsekuensinya ia
 *     tidak bisa dicabut — karena itu umurnya menit, bukan hari.
 *   - **Refresh token** adalah nilai acak buram (bukan JWT) yang SETIAP pemakaian
 *     menyentuh database. Di situlah pencabutan dan deteksi hidup.
 *
 * Rotasi dengan deteksi pemakaian ulang, langkah demi langkah:
 *
 *   1. Setiap refresh menandai token lama `used` dan menerbitkan token baru dalam
 *      **family** yang sama.
 *   2. Token yang sudah `used` datang lagi → seseorang memegang salinannya. Tidak
 *      bisa diketahui apakah yang terlambat itu penyerang atau pemilik asli — dan
 *      justru karena tidak bisa, **seluruh family dicabut**. Keduanya ter-logout;
 *      pencurian menjadi terlihat, bukan diam.
 *
 * Mencabut hanya token yang dipakai ulang akan terasa lebih ramah dan sepenuhnya
 * keliru: penyerang yang sudah sempat merotasi justru memegang token yang lebih
 * baru, dan dialah satu-satunya yang tetap masuk.
 */

import { createHash, randomBytes } from 'node:crypto';
import { ulid } from '../../../shared/ulid.js';
import { InvalidRefreshTokenError } from '../domain/auth.errors.js';
import type {
  RefreshTokenRepository,
  RefreshTokenRow,
} from '../domain/refresh-token.repository.js';

export interface IssuedRefreshToken {
  /** Nilai mentah untuk cookie. Tidak pernah disimpan dan tidak pernah dicatat. */
  readonly token: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  readonly userId: string;
}

/** 32 byte acak — entropi 256 bit, jauh di atas yang bisa ditebak atau ditabrak. */
const TOKEN_BYTES = 32;

export class TokenService {
  constructor(
    private readonly repository: RefreshTokenRepository,
    /** Detik — `JWT_REFRESH_TTL` dari env. */
    private readonly refreshTtlSeconds: number,
  ) {}

  /** Satu login = satu family baru. Logout dan deteksi mencabut per family. */
  async issue(userId: string): Promise<IssuedRefreshToken> {
    return this.mint(userId, ulid());
  }

  /**
   * Menukar refresh token dengan yang baru. Satu-satunya jalur perpanjangan sesi.
   *
   * Urutan pemeriksaannya penting: pemakaian ulang diperiksa SEBELUM kedaluwarsa.
   * Token lama yang dipakai ulang setelah lewat masa berlakunya tetap bukti bahwa
   * seseorang memegang salinan — kedaluwarsa tidak membatalkan sinyalnya.
   */
  async rotate(rawToken: string): Promise<RotatedRefreshToken> {
    const row = await this.repository.findByTokenHash(hashToken(rawToken));

    // Token yang tidak dikenal tidak membedakan "tidak pernah ada" dari "sudah
    // dibersihkan" — keduanya berakhir sama, dan responsnya pun satu.
    if (row === null) throw new InvalidRefreshTokenError('unknown');

    if (row.revokedAt !== null) throw new InvalidRefreshTokenError('revoked');

    if (row.usedAt !== null) {
      await this.repository.revokeFamily(row.familyId);
      throw new InvalidRefreshTokenError('reused');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      // Kedaluwarsa adalah kejadian normal (laptop yang lama tertutup), bukan
      // serangan — family-nya tidak perlu dicabut.
      throw new InvalidRefreshTokenError('expired');
    }

    await this.repository.markUsed(row.id);
    const issued = await this.mint(row.userId, row.familyId);
    return { ...issued, userId: row.userId };
  }

  /** Logout: mencabut di sisi server, bukan hanya menghapus cookie di klien. */
  async revokeByToken(rawToken: string): Promise<void> {
    const row = await this.repository.findByTokenHash(hashToken(rawToken));
    // Logout dengan token yang tidak dikenal tetap sukses: tujuan pemanggil adalah
    // "pastikan sesi ini mati", dan sesi yang tidak ada memang sudah mati.
    if (row !== null) await this.repository.revokeFamily(row.familyId);
  }

  private async mint(userId: string, familyId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1_000);

    await this.repository.create({
      id: ulid(),
      userId,
      tokenHash: hashToken(token),
      familyId,
      expiresAt,
    });

    return { token, familyId, expiresAt };
  }
}

/**
 * SHA-256, bukan Argon2: token ini sudah berentropi 256 bit, jadi KDF lambat hanya
 * menambah biaya di setiap refresh tanpa menambah keamanan apa pun.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Dipakai tes untuk membangun baris; diekspor supaya tidak ada salinan logika hash. */
export type { RefreshTokenRow };
