/**
 * P3-04a — sesi tamu terbentuk pada permintaan pertama tanpa diminta, dan id dari
 * cookie tidak pernah dipercaya tanpa baris database.
 */
import { describe, expect, it } from 'vitest';
import type {
  GuestSessionRepository,
  GuestSessionRow,
} from '../domain/guest-session.repository.js';
import { GuestSessionService } from './guest-session.service.js';

const TTL = 86_400;

class MemoryRepository implements GuestSessionRepository {
  readonly rows = new Map<string, GuestSessionRow & { lastSeenAt?: Date }>();
  touched: string[] = [];

  async create(session: { id: string; expiresAt: Date }): Promise<void> {
    this.rows.set(session.id, { ...session, linkedUserId: null });
  }

  async findById(id: string): Promise<GuestSessionRow | null> {
    return this.rows.get(id) ?? null;
  }

  async touch(id: string, expiresAt: Date): Promise<void> {
    this.touched.push(id);
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, expiresAt });
  }
}

function setup() {
  const repository = new MemoryRepository();
  return { repository, service: new GuestSessionService(repository, TTL) };
}

describe('GuestSessionService — permintaan pertama', () => {
  it('membuat sesi baru saat tidak ada cookie', async () => {
    const { repository, service } = setup();

    const ensured = await service.ensure(undefined);

    expect(repository.rows.has(ensured.id)).toBe(true);
    expect(ensured.setCookie).toBe(true);
  });

  it('memberi TTL dari config, bukan angka yang tertanam', async () => {
    const { service } = setup();
    const before = Date.now();

    const ensured = await service.ensure(undefined);

    const delta = ensured.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan((TTL - 5) * 1_000);
    expect(delta).toBeLessThan((TTL + 5) * 1_000);
  });
});

describe('GuestSessionService — cookie adalah klaim, bukan bukti', () => {
  it('memakai ulang sesi yang memang ada dan menggeser kedaluwarsanya', async () => {
    const { repository, service } = setup();
    const first = await service.ensure(undefined);

    const second = await service.ensure(first.id);

    expect(second.id).toBe(first.id);
    expect(repository.touched).toEqual([first.id]);
  });

  it('mengganti id yang tidak punya baris — fixation tidak mendapat sesi pilihannya', async () => {
    // Penyerang yang menanam cookie dengan id pilihannya sendiri tidak boleh
    // membuat korban memakai sesi itu.
    const { service } = setup();
    const planted = '01JB00000000000000000000AA';

    const ensured = await service.ensure(planted);

    expect(ensured.id).not.toBe(planted);
  });

  it('mengganti sesi yang sudah kedaluwarsa', async () => {
    const { repository, service } = setup();
    const first = await service.ensure(undefined);
    repository.rows.set(first.id, {
      id: first.id,
      linkedUserId: null,
      expiresAt: new Date(Date.now() - 1_000),
    });

    const ensured = await service.ensure(first.id);

    expect(ensured.id).not.toBe(first.id);
  });

  it('mengganti sesi yang sudah tertaut ke akun — cookie lama bukan sesi tamu lagi', async () => {
    const { repository, service } = setup();
    const first = await service.ensure(undefined);
    repository.rows.set(first.id, {
      id: first.id,
      linkedUserId: 'U'.padEnd(26, '0'),
      expiresAt: new Date(Date.now() + 1_000_000),
    });

    const ensured = await service.ensure(first.id);

    expect(ensured.id).not.toBe(first.id);
  });

  it('menolak nilai cookie yang bukan bentuk ULID tanpa menyentuh repository', async () => {
    const { repository, service } = setup();
    const spy: string[] = [];
    const original = repository.findById.bind(repository);
    repository.findById = async (id) => {
      spy.push(id);
      return original(id);
    };

    await service.ensure('"><script>alert(1)</script>' + 'x'.repeat(4_000));

    expect(spy).toEqual([]);
  });
});
