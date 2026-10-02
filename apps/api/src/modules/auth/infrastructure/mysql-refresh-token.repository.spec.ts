/**
 * P3-03a terhadap MySQL sungguhan: deteksi pemakaian ulang ujung ke ujung, termasuk
 * perilaku yang hanya database bisa buktikan — `revoked_at` tidak tertimpa pada
 * pencabutan kedua.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { refreshTokens, users } from '../../../infrastructure/mysql/schema/identity.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { InvalidRefreshTokenError } from '../domain/auth.errors.js';
import { TokenService } from '../application/token.service.js';
import { MysqlRefreshTokenRepository } from './mysql-refresh-token.repository.js';

const USER = testId('USER');
let fixture: TestDatabase;
let service: TokenService;
let repository: MysqlRefreshTokenRepository;

beforeAll(async () => {
  fixture = await createTestDatabase('tokens');
  repository = new MysqlRefreshTokenRepository({ db: fixture.db });
  service = new TokenService(repository, 3_600);
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  await fixture.db.insert(users).values({
    id: USER,
    email: 'tes@example.test',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA',
    name: 'Pengguna Tes',
  });
});

describe('rotasi terhadap MySQL', () => {
  it('impor-rotasi-deteksi: seluruh rantai tercabut di database', async () => {
    const issued = await service.issue(USER);
    const second = await service.rotate(issued.token);
    await service.rotate(second.token);

    await expect(service.rotate(issued.token)).rejects.toThrow(InvalidRefreshTokenError);

    const rows = await fixture.db
      .select({ revokedAt: refreshTokens.revokedAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.familyId, issued.familyId));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('pencabutan kedua tidak menimpa stempel waktu pencabutan pertama', async () => {
    // `revoked_at` adalah stempel kejadian; menimpanya menghapus kapan insiden
    // pertamanya terjadi — persis yang dibutuhkan forensik.
    const issued = await service.issue(USER);
    await repository.revokeFamily(issued.familyId);
    const [before] = await fixture.db
      .select({ revokedAt: refreshTokens.revokedAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.familyId, issued.familyId));

    await new Promise((resolve) => setTimeout(resolve, 20));
    await repository.revokeFamily(issued.familyId);

    const [after] = await fixture.db
      .select({ revokedAt: refreshTokens.revokedAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.familyId, issued.familyId));
    expect(after?.revokedAt?.getTime()).toBe(before?.revokedAt?.getTime());
  });

  it('baris bekas rotasi tetap ada — ialah alat deteksinya', async () => {
    const issued = await service.issue(USER);
    await service.rotate(issued.token);

    const rows = await fixture.db
      .select({ usedAt: refreshTokens.usedAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.familyId, issued.familyId));

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.usedAt !== null)).toHaveLength(1);
  });
});
