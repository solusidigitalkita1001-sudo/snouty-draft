/**
 * P13-01a — batas laju: berbasis Redis (berlaku lintas instans), menolak setelah kuota
 * habis, dan **tidak menutup pintu saat Redis mati**.
 *
 * Diuji terhadap Redis sungguhan: `INCR` + `EXPIRE` adalah dua operasi, dan yang ingin
 * dipastikan bukan logika perbandingannya melainkan bahwa jendelanya benar-benar mereset
 * dan tidak diperpanjang terus-menerus.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestRedis } from '../../../test/redis.js';
import { AUTH_IP_LIMIT, limitFor, RATE_LIMITS } from '../../modules/policy/rate-limits.js';
import { RateLimiter } from './rate-limiter.js';

const redis = await createTestRedis(9);
const limiter = new RateLimiter({ client: redis.client } as never);

beforeEach(() => redis.clear());
afterAll(() => redis.close());

describe('RateLimiter', () => {
  it('mengizinkan sampai kuota, menolak sesudahnya', async () => {
    const limit = { max: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i += 1) {
      const verdict = await limiter.consume('uji', 'subjek-a', limit);
      expect(verdict.allowed, `permintaan ${i + 1}`).toBe(true);
    }
    const blocked = await limiter.consume('uji', 'subjek-a', limit);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('melaporkan sisa kuota yang menurun', async () => {
    const limit = { max: 3, windowSeconds: 60 };
    expect((await limiter.consume('uji', 'subjek-b', limit)).remaining).toBe(2);
    expect((await limiter.consume('uji', 'subjek-b', limit)).remaining).toBe(1);
    expect((await limiter.consume('uji', 'subjek-b', limit)).remaining).toBe(0);
  });

  it('menghitung per subjek — satu pengguna tidak menghabiskan kuota yang lain', async () => {
    const limit = { max: 1, windowSeconds: 60 };
    expect((await limiter.consume('uji', 'subjek-c', limit)).allowed).toBe(true);
    expect((await limiter.consume('uji', 'subjek-d', limit)).allowed).toBe(true);
  });

  it('menghitung per dimensi — kuota pesan tidak menghabiskan kuota laporan', async () => {
    const limit = { max: 1, windowSeconds: 60 };
    expect((await limiter.consume('messages', 'subjek-e', limit)).allowed).toBe(true);
    expect((await limiter.consume('reports', 'subjek-e', limit)).allowed).toBe(true);
  });

  it('tidak memperpanjang jendela pada setiap permintaan', async () => {
    // Menyetel EXPIRE setiap kali akan membuat batasnya tak pernah mereset bagi
    // penyalahguna yang paling gigih — justru kebalikan dari yang diinginkan.
    const limit = { max: 5, windowSeconds: 100 };
    await limiter.consume('uji', 'subjek-f', limit);
    const firstTtl = await redis.client.ttl('snouty:rl:uji:subjek-f');
    await limiter.consume('uji', 'subjek-f', limit);
    const secondTtl = await redis.client.ttl('snouty:rl:uji:subjek-f');
    expect(secondTtl).toBeLessThanOrEqual(firstTtl);
  });

  it('Redis mati: permintaan tetap dilayani, bukan ditolak', async () => {
    // Menolak semua orang saat cache mati mengubah gangguan kecil menjadi pemadaman.
    const broken = new RateLimiter({
      client: {
        incr: () => Promise.reject(new Error('Redis mati')),
        expire: () => Promise.reject(new Error('Redis mati')),
        ttl: () => Promise.reject(new Error('Redis mati')),
      },
    } as never);
    const verdict = await broken.consume('uji', 'subjek-g', { max: 1, windowSeconds: 60 });
    expect(verdict.allowed).toBe(true);
  });
});

describe('tabel batas per tier (POLICY §10)', () => {
  it('tamu punya batas pesan, tetapi tidak punya kuota kasus lanjutan', () => {
    expect(limitFor('guest', 'messages_per_hour')).not.toBeNull();
    expect(limitFor('guest', 'advanced_cases_per_day')).toBeNull();
    expect(limitFor('guest', 'reports_per_day')).toBeNull();
  });

  it('batas naik bersama tier', () => {
    const guest = RATE_LIMITS.guest.messages_per_hour!.max;
    const registered = RATE_LIMITS.registered.messages_per_hour!.max;
    const advanced = RATE_LIMITS.advanced.messages_per_hour!.max;
    expect(registered).toBeGreaterThan(guest);
    expect(advanced).toBeGreaterThan(registered);
  });

  it('tamu punya kuota unggahan 2/hari sesuai tabel desain', () => {
    expect(RATE_LIMITS.guest.uploads_per_day).toEqual({ max: 2, windowSeconds: 86_400 });
  });

  it('batas auth per IP cukup ketat untuk menghambat credential stuffing', () => {
    expect(AUTH_IP_LIMIT.max).toBeLessThanOrEqual(10);
    expect(AUTH_IP_LIMIT.windowSeconds).toBeGreaterThanOrEqual(300);
  });
});
