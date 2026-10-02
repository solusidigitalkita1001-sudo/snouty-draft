/**
 * Implementasi MySQL dari `RefreshTokenRepository`.
 *
 * `revokeFamily` mencabut juga token yang SUDAH terpakai. Itu bukan kemubaziran:
 * baris bekas adalah alat deteksi, dan alat deteksi yang ikut tercabut membuat
 * pemakaian ulang berikutnya pada family yang sama tetap terjawab "revoked" —
 * bukan memicu pencabutan kedua yang tidak mengubah apa pun.
 */
import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { refreshTokens } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type NewRefreshToken,
  type RefreshTokenRepository,
  type RefreshTokenRow,
} from '../domain/refresh-token.repository.js';

@Injectable()
export class MysqlRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly database: QueryRunner) {}

  async create(token: NewRefreshToken): Promise<void> {
    await this.database.db.insert(refreshTokens).values(token);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const rows = await this.database.db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        tokenHash: refreshTokens.tokenHash,
        familyId: refreshTokens.familyId,
        expiresAt: refreshTokens.expiresAt,
        usedAt: refreshTokens.usedAt,
        revokedAt: refreshTokens.revokedAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    return rows[0] ?? null;
  }

  async markUsed(id: string): Promise<void> {
    await this.database.db
      .update(refreshTokens)
      .set({ usedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.database.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      // Hanya yang belum tercabut: `revoked_at` adalah stempel waktu kejadian, dan
      // menimpanya pada pencabutan kedua menghapus kapan kejadian pertamanya.
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }
}

export const refreshTokenRepositoryProvider = {
  provide: REFRESH_TOKEN_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): RefreshTokenRepository =>
    new MysqlRefreshTokenRepository(database),
};
