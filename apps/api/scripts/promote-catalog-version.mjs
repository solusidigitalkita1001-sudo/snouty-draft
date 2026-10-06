#!/usr/bin/env node
/**
 * Mempromosikan satu versi katalog `draft` menjadi `active` lewat `CatalogPromotionService` —
 * jalur yang sama dengan back-office (audit + invalidasi cache). Untuk server yang belum punya
 * akun `catalog_admin` (deploy pertama), atau pengembangan lokal.
 *
 *   DB_HOST=127.0.0.1 DB_PORT=3316 DB_DATABASE=snouty DB_USERNAME=root DB_PASSWORD=… \
 *   REDIS_URL=redis://127.0.0.1:6379 node scripts/promote-catalog-version.mjs <label>
 *
 * Menolak server bersama 192.168.1.136 (N-6): promosi di sana lewat back-office yang diaudit.
 */
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';

const SHARED_HOST = '192.168.1.136';
const label = process.argv[2];
if (!label) {
  console.error('Pemakaian: node scripts/promote-catalog-version.mjs <label-versi>');
  process.exit(1);
}
const cfg = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3316),
  database: process.env.DB_DATABASE ?? 'snouty',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_ROOT_PASSWORD ?? 'snouty',
};
if (cfg.host.includes(SHARED_HOST)) {
  console.error(`✖ Menolak mempromosikan di server bersama (${SHARED_HOST}); pakai back-office.`);
  process.exit(1);
}

let m;
try {
  m = {
    schema: await import('../dist/infrastructure/mysql/schema/index.js'),
    ulid: (await import('../dist/shared/ulid.js')).ulid,
    ...(await import('../dist/modules/product-catalog/infrastructure/catalog.mysql.writer.js')),
    ...(await import('../dist/modules/product-catalog/infrastructure/catalog.mysql.repository.js')),
    ...(await import('../dist/modules/product-catalog/infrastructure/catalog.redis.cache.js')),
    ...(await import('../dist/modules/product-catalog/application/catalog-promotion.service.js')),
  };
} catch (cause) {
  console.error('✖ `dist` belum ada atau usang. Jalankan dulu: pnpm --filter @snouty/api build');
  console.error(cause.message);
  process.exit(1);
}

const connection = await mysql.createConnection({ ...cfg, timezone: 'Z' });
const db = drizzle(connection, { schema: m.schema, mode: 'default' });
const [version] = await db
  .select({
    id: m.schema.catalogVersions.id,
    status: m.schema.catalogVersions.status,
    kind: m.schema.catalogVersions.kind,
  })
  .from(m.schema.catalogVersions)
  .where(eq(m.schema.catalogVersions.label, label))
  .limit(1);
if (!version) {
  console.error(`✖ Versi berlabel \`${label}\` tidak ada.`);
  await connection.end();
  process.exit(1);
}

async function openCache() {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
  try {
    const { Redis } = await import('ioredis');
    const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    return { cache: new m.RedisCatalogCache(client), close: () => client.quit() };
  } catch {
    console.log(
      `  (Redis di ${url} tidak terjangkau — cache tidak dibuang; restart API setelah ini)`,
    );
    return {
      cache: { read: async () => null, write: async () => {}, invalidateAll: async () => 0 },
      close: async () => {},
    };
  }
}

const { cache, close } = await openCache();
const promotion = new m.CatalogPromotionService(
  new m.MysqlCatalogRepository({ db }),
  new m.MysqlCatalogWriter({ db }),
  cache,
);
const out = await promotion.promote({
  catalogVersionId: version.id,
  actor: { id: m.ulid(), role: 'catalog_admin' },
});
console.log(`✓ ${label} (${version.kind}) → active`);
if (out.previousActiveId) console.log(`  versi sebelumnya ${out.previousActiveId} → archived`);
console.log(`  cache: ${out.cacheKeysInvalidated} kunci dibuang`);
await close();
await connection.end();
