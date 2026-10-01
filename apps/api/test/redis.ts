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

export async function createTestRedis(): Promise<TestRedis> {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });

  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `Tidak bisa terhubung ke Redis tes di ${url}. ` +
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
