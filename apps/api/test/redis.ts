/**
 * Bantuan tes integrasi terhadap Redis lokal.
 *
 * Tidak pernah `FLUSHALL`, bahkan terhadap kontainer milik SNOUTY sendiri.
 * Alasannya sama dengan alasan MySQL bersama diperlakukan hati-hati: perintah yang
 * aman hari ini karena kebetulan tidak ada tetangga adalah perintah yang menunggu
 * tetangga datang. Pembersihan memindai awalan `snouty:` dan hanya membuang itu.
 */
import { Redis } from 'ioredis';

const SNOUTY_PREFIX = 'snouty:';
const SCAN_BATCH = 500;

export interface TestRedis {
  readonly client: Redis;
  clear(): Promise<void>;
  close(): Promise<void>;
}

/**
 * `database` memilih **logical database** Redis, dan setiap berkas spec wajib
 * memakai angka yang berbeda.
 *
 * Alasannya ditemukan dengan cara yang mahal: vitest menjalankan berkas spec
 * secara paralel, jadi dua spec yang berbagi satu keyspace akan saling menghapus
 * kunci lewat `clear()`. Kegagalannya muncul sebagai invalidasi cache yang
 * "tidak berfungsi" di satu spec, padahal spec lain yang membersihkannya. Ini
 * padanan Redis dari satu database MySQL per spec.
 */
export async function createTestRedis(database: number): Promise<TestRedis> {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
  const client = new Redis(url, { db: database, maxRetriesPerRequest: 1, lazyConnect: true });

  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `Tidak bisa terhubung ke Redis tes di ${url} (db ${database}). ` +
        'Jalankan `docker compose up -d redis` lebih dulu.',
      { cause },
    );
  }

  return {
    client,
    async clear() {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          `${SNOUTY_PREFIX}*`,
          'COUNT',
          SCAN_BATCH,
        );
        cursor = next;
        if (keys.length > 0) await client.del(...keys);
      } while (cursor !== '0');
    },
    async close() {
      client.disconnect();
    },
  };
}
