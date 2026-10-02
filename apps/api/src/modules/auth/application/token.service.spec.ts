/**
 * P3-03a — rotasi dan deteksi pemakaian ulang, tanpa database.
 *
 * Tes yang menamai item ini: refresh token lama yang dipakai lagi mencabut
 * **seluruh rantai**, bukan satu token. Repo-nya fake di memori karena yang diuji
 * di sini urutan keputusan; SQL-nya diuji terpisah terhadap MySQL sungguhan.
 */
import { describe, expect, it } from 'vitest';
import { InvalidRefreshTokenError } from '../domain/auth.errors.js';
import type {
  NewRefreshToken,
  RefreshTokenRepository,
  RefreshTokenRow,
} from '../domain/refresh-token.repository.js';
import { hashToken, TokenService } from './token.service.js';

const TTL_SECONDS = 3_600;
const USER = 'U'.padEnd(26, '0');

class MemoryRepository implements RefreshTokenRepository {
  readonly rows = new Map<
    string,
    RefreshTokenRow & { usedAt: Date | null; revokedAt: Date | null }
  >();

  async create(token: NewRefreshToken): Promise<void> {
    this.rows.set(token.id, { ...token, usedAt: null, revokedAt: null });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    for (const row of this.rows.values()) if (row.tokenHash === tokenHash) return row;
    return null;
  }

  async markUsed(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.usedAt = new Date();
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.familyId === familyId && row.revokedAt === null) row.revokedAt = new Date();
    }
  }

  family(familyId: string): RefreshTokenRow[] {
    return [...this.rows.values()].filter((row) => row.familyId === familyId);
  }
}

function setup() {
  const repository = new MemoryRepository();
  return { repository, service: new TokenService(repository, TTL_SECONDS) };
}

async function reason(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'tidak melempar';
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) return error.reason;
    throw error;
  }
}

describe('TokenService — penerbitan dan rotasi normal', () => {
  it('menyimpan hash-nya, tidak pernah tokennya', async () => {
    const { repository, service } = setup();

    const issued = await service.issue(USER);

    const stored = [...repository.rows.values()][0]!;
    expect(stored.tokenHash).toBe(hashToken(issued.token));
    expect(JSON.stringify([...repository.rows.values()])).not.toContain(issued.token);
  });

  it('rotasi mengembalikan token baru dalam family yang sama', async () => {
    const { service } = setup();
    const issued = await service.issue(USER);

    const rotated = await service.rotate(issued.token);

    expect(rotated.familyId).toBe(issued.familyId);
    expect(rotated.token).not.toBe(issued.token);
    expect(rotated.userId).toBe(USER);
  });

  it('dua login menghasilkan dua family yang berbeda', async () => {
    // Logout dari laptop tidak boleh mematikan sesi ponsel.
    const { service } = setup();

    const first = await service.issue(USER);
    const second = await service.issue(USER);

    expect(first.familyId).not.toBe(second.familyId);
  });

  it('rantai rotasi panjang tetap berjalan — token terbaru selalu sah', async () => {
    const { service } = setup();
    let current = (await service.issue(USER)).token;

    for (let i = 0; i < 5; i += 1) current = (await service.rotate(current)).token;

    await expect(service.rotate(current)).resolves.toBeDefined();
  });
});

describe('TokenService — deteksi pemakaian ulang', () => {
  it('mencabut SELURUH rantai saat token lama dipakai lagi', async () => {
    const { repository, service } = setup();
    const issued = await service.issue(USER);
    const rotated = await service.rotate(issued.token);
    await service.rotate(rotated.token);

    // Token PERTAMA dipakai lagi — seseorang memegang salinan.
    await expect(reason(service.rotate(issued.token))).resolves.toBe('reused');

    const family = repository.family(issued.familyId);
    expect(family.length).toBeGreaterThanOrEqual(3);
    expect(family.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('setelah pencabutan, token terbaru pun ditolak — penyerang yang sempat merotasi ikut mati', async () => {
    const { service } = setup();
    const issued = await service.issue(USER);
    const newest = await service.rotate(issued.token);

    await reason(service.rotate(issued.token)); // deteksi → cabut family

    await expect(reason(service.rotate(newest.token))).resolves.toBe('revoked');
  });

  it('memeriksa pemakaian ulang SEBELUM kedaluwarsa — sinyalnya tidak hangus', async () => {
    const { repository, service } = setup();
    const issued = await service.issue(USER);
    await service.rotate(issued.token);
    // Kedaluwarsakan token lama secara paksa.
    for (const row of repository.rows.values()) {
      if (row.tokenHash === hashToken(issued.token)) {
        repository.rows.set(row.id, { ...row, expiresAt: new Date(Date.now() - 1_000) });
      }
    }

    await expect(reason(service.rotate(issued.token))).resolves.toBe('reused');
  });

  it('tidak mencabut family lain milik pengguna yang sama', async () => {
    const { repository, service } = setup();
    const laptop = await service.issue(USER);
    const phone = await service.issue(USER);
    await service.rotate(laptop.token);

    await reason(service.rotate(laptop.token)); // deteksi pada family laptop

    expect(repository.family(phone.familyId).every((row) => row.revokedAt === null)).toBe(true);
  });
});

describe('TokenService — jalur penolakan lain', () => {
  it('menolak token yang tidak dikenal', async () => {
    const { service } = setup();

    await expect(reason(service.rotate('token-karangan'))).resolves.toBe('unknown');
  });

  it('menolak token kedaluwarsa tanpa mencabut family-nya — laptop tertutup bukan serangan', async () => {
    const { repository, service } = setup();
    const issued = await service.issue(USER);
    for (const row of repository.rows.values()) {
      repository.rows.set(row.id, { ...row, expiresAt: new Date(Date.now() - 1_000) });
    }

    await expect(reason(service.rotate(issued.token))).resolves.toBe('expired');
    expect(repository.family(issued.familyId).every((row) => row.revokedAt === null)).toBe(true);
  });

  it('semua penolakan memakai pesan yang sama — penyebabnya hanya untuk log', async () => {
    const { service } = setup();
    const issued = await service.issue(USER);
    await service.rotate(issued.token);

    const messages = new Set<string>();
    for (const raw of ['token-karangan', issued.token]) {
      try {
        await service.rotate(raw);
      } catch (error) {
        messages.add((error as Error).message);
      }
    }

    expect(messages.size).toBe(1);
  });
});

describe('TokenService — logout', () => {
  it('mencabut seluruh family di sisi server', async () => {
    const { repository, service } = setup();
    const issued = await service.issue(USER);
    const rotated = await service.rotate(issued.token);

    await service.revokeByToken(rotated.token);

    expect(repository.family(issued.familyId).every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('logout dengan token tak dikenal tetap sukses — sesi yang tidak ada memang sudah mati', async () => {
    const { service } = setup();

    await expect(service.revokeByToken('token-karangan')).resolves.toBeUndefined();
  });
});
