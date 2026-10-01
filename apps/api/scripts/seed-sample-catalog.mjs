#!/usr/bin/env node
/**
 * P1-11 — katalog contoh untuk pengembangan.
 *
 * **Isinya bukan data Pralon.** Setiap SKU berawalan `DEV-`, setiap nama berawalan
 * "CONTOH", dan `source_document` menyatakannya dengan huruf besar. Itu disengaja:
 * katalog pengembangan yang terlihat seperti katalog sungguhan adalah cara paling
 * mudah membuat seseorang mengutip harga dari data karangan.
 *
 * Disemai lewat **jalur impor yang sungguhan** — validator, `CatalogIngestService`,
 * lalu promosi — bukan lewat INSERT mentah. Dua alasan: contohnya tidak bisa
 * menyimpang dari apa yang dihasilkan importer nyata (lupa `row_hash`, lupa baris
 * spesifikasi `UNAVAILABLE`), dan menjalankannya sekaligus menguji rantai
 * P1-05 → P1-07 ujung ke ujung.
 *
 *   pnpm --filter @snouty/api build
 *   SEED_SAMPLE_CATALOG=1 DB_DATABASE=snouty_dev pnpm --filter @snouty/api seed:sample
 *
 * Tambahkan `--with-errors` untuk ikut menyemai satu impor yang **ditolak**, supaya
 * layar laporan validasi back-office punya data untuk dikembangkan.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';

const SHARED_HOST = '192.168.1.136';
const SOURCE_DOCUMENT = 'Katalog contoh pengembangan SNOUTY (BUKAN data Pralon)';

const cfg = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3317),
  database: process.env.DB_DATABASE ?? 'snouty_dev',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'test',
};

// ── Pagar ───────────────────────────────────────────────────────────────────
// Skrip ini MEMPROMOSIKAN katalog karangan menjadi versi aktif. Dijalankan di
// tempat yang salah, ia mengubah apa yang dilihat semua pengguna menjadi data
// contoh — jadi pagarnya dua lapis, dan keduanya menolak secara baku.
if (cfg.host.includes(SHARED_HOST)) {
  console.error(`✖ Menolak menyemai katalog contoh ke server bersama (${SHARED_HOST}).`);
  process.exit(1);
}
if (process.env.SEED_SAMPLE_CATALOG !== '1') {
  console.error(
    '✖ Setel SEED_SAMPLE_CATALOG=1 untuk melanjutkan.\n' +
      '  Skrip ini menulis katalog KARANGAN dan mempromosikannya menjadi versi aktif.',
  );
  process.exit(1);
}

let modules;
try {
  modules = {
    schema: await import('../dist/infrastructure/mysql/schema/index.js'),
    ulid: (await import('../dist/shared/ulid.js')).ulid,
    CatalogIngestService: (
      await import('../dist/modules/product-catalog/application/catalog-ingest.service.js')
    ).CatalogIngestService,
    CatalogPromotionService: (
      await import('../dist/modules/product-catalog/application/catalog-promotion.service.js')
    ).CatalogPromotionService,
    MysqlCatalogWriter: (
      await import('../dist/modules/product-catalog/infrastructure/catalog.mysql.writer.js')
    ).MysqlCatalogWriter,
    MysqlCatalogRepository: (
      await import('../dist/modules/product-catalog/infrastructure/catalog.mysql.repository.js')
    ).MysqlCatalogRepository,
    CATALOG_IMPORT_COLUMNS: (
      await import('../dist/modules/product-catalog/domain/catalog-import.contract.js')
    ).CATALOG_IMPORT_COLUMNS,
  };
} catch (cause) {
  console.error(
    '✖ `dist` belum ada atau sudah usang. Jalankan dulu:\n  pnpm --filter @snouty/api build',
  );
  console.error(cause.message);
  process.exit(1);
}

const { schema, ulid, CatalogIngestService, CatalogPromotionService } = modules;
const { MysqlCatalogWriter, MysqlCatalogRepository, CATALOG_IMPORT_COLUMNS } = modules;

// ── Isi katalog contoh ──────────────────────────────────────────────────────
// Bentuknya realistis — satu SKU punya banyak ukuran, fitting punya rujukan
// kompatibilitas, dan `pressure_class` sengaja DIKOSONGKAN pada pipa AW supaya
// perilaku "Lihat dokumen teknis" di desain benar-benar bisa dilihat.
const COLUMNS = [...CATALOG_IMPORT_COLUMNS.required, ...CATALOG_IMPORT_COLUMNS.optional];

const SAMPLE_ROWS = [
  {
    sku: 'DEV-AW-PIPE',
    name: 'CONTOH Pipa PVC AW',
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    description: 'Data contoh untuk pengembangan. Bukan produk Pralon.',
    source_page: '14',
    sizes: '1/2; 3/4; 1; 1 1/4; 1 1/2; 2; 3; 4',
    material: 'uPVC',
    standard: 'SNI 06-0084-2002',
    rod_length: '4 m',
    joint_type: 'Solvent cement',
    application: 'Air bersih bertekanan',
    // pressure_class sengaja kosong → UNAVAILABLE → "Lihat dokumen teknis".
    compatible_skus:
      'DEV-FIT-TEE:tee; DEV-FIT-ELBOW:elbow; DEV-FIT-REDUCER:reducer; DEV-FIT-SOCKET:socket',
    image_url: '/images/dev/aw-pipe.png',
  },
  {
    sku: 'DEV-D-PIPE',
    name: 'CONTOH Pipa PVC D',
    family: 'PVC D',
    category: 'PIPA PEMBUANGAN · SNI',
    description: 'Data contoh untuk pengembangan. Bukan produk Pralon.',
    source_page: '26',
    sizes: '1 1/2; 2; 3; 4',
    material: 'uPVC',
    standard: 'SNI 06-0084-2002',
    rod_length: '4 m',
    application: 'Pembuangan gravitasi',
    // joint_type dan pressure_class kosong: pembuangan tidak bertekanan.
  },
  {
    sku: 'DEV-FIT-TEE',
    name: 'CONTOH Tee PVC AW',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '41',
    sizes: '3/4; 1; 1 1/4',
    material: 'uPVC',
    joint_type: 'Solvent cement',
  },
  {
    sku: 'DEV-FIT-ELBOW',
    name: 'CONTOH Elbow 90° PVC AW',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '42',
    sizes: '3/4; 1; 1 1/4',
    material: 'uPVC',
    joint_type: 'Solvent cement',
  },
  {
    sku: 'DEV-FIT-REDUCER',
    name: 'CONTOH Reducer PVC AW',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '43',
    sizes: '3/4; 1',
    material: 'uPVC',
  },
  {
    sku: 'DEV-FIT-SOCKET',
    name: 'CONTOH Socket PVC AW',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '44',
    status: 'discontinued',
    sizes: '3/4',
    material: 'uPVC',
  },
];

/**
 * Impor yang sengaja rusak, satu galat per jenis.
 *
 * Gunanya bukan menguji validator — itu sudah ada tesnya — melainkan memberi layar
 * laporan validasi back-office data nyata untuk dikembangkan, termasuk bentuk
 * "banyak galat sekaligus" yang justru paling sulit dirancang tanpa contoh.
 */
const BROKEN_ROWS = [
  {
    sku: '',
    name: 'CONTOH tanpa SKU',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '9',
  },
  { sku: 'DEV-BROKEN-1', name: '', family: '', category: 'FITTING · SNI', source_page: '9' },
  {
    sku: 'DEV-BROKEN-2',
    name: 'CONTOH halaman nol',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '0',
  },
  {
    sku: 'DEV-BROKEN-3',
    name: 'CONTOH ukuran tak terbaca',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '9',
    sizes: '3/4; dua inci',
  },
  {
    sku: 'DEV-BROKEN-3',
    name: 'CONTOH SKU ganda',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '9',
  },
  {
    sku: 'DEV-BROKEN-4',
    name: 'CONTOH fitting yang tidak ada',
    family: 'PVC AW',
    category: 'FITTING · SNI',
    source_page: '9',
    compatible_skus: 'DEV-TIDAK-ADA:tee',
  },
];

/** Naik saja, berurutan. Kalau tabelnya sudah ada, MySQL menolak dan itu tidak apa-apa. */
async function applyMigrations(conn) {
  const files = ['0000_catalog.sql', '0001_catalog_import_runs.sql', '0002_audit_logs.sql'];
  for (const file of files) {
    const sql = readFileSync(join('drizzle', file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed === '') continue;
      try {
        await conn.query(trimmed);
      } catch (error) {
        // Tabel atau kolom yang sudah ada bukan kegagalan: skrip ini idempoten.
        const tolerated = ['ER_TABLE_EXISTS_ERROR', 'ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'];
        if (!tolerated.includes(error.code)) throw error;
      }
    }
  }
}

/** Redis tidak wajib menyala untuk menyemai; kalau mati, promosinya tetap jalan. */
async function openCache() {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6380';
  try {
    const { Redis } = await import('ioredis');
    const { RedisCatalogCache } =
      await import('../dist/modules/product-catalog/infrastructure/catalog.redis.cache.js');
    const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    redisClient = client;
    return new RedisCatalogCache(client);
  } catch {
    console.log(`  (Redis di ${url} tidak terjangkau — cache tidak dibuang)`);
    return { read: async () => null, write: async () => {}, invalidateAll: async () => 0 };
  }
}

function sourceFrom(label, rows) {
  return {
    label,
    sourceDocument: SOURCE_DOCUMENT,
    columns: COLUMNS,
    // Baris 1 adalah header pada berkas tabular, jadi data mulai dari 2.
    rows: rows.map((values, index) => ({ rowNumber: index + 2, values })),
  };
}

// ── Jalankan ────────────────────────────────────────────────────────────────
console.log(`\nKatalog contoh → ${cfg.host}:${cfg.port}/${cfg.database}`);
console.log(`Dokumen sumber: ${SOURCE_DOCUMENT}\n`);

// Database dibuat dan migration diterapkan di sini — aman karena host sudah
// dipastikan bukan server bersama. Tanpa ini, menyemai butuh tiga perintah dan
// yang pertama paling sering terlupa.
const admin0 = await mysql.createConnection({
  ...cfg,
  database: undefined,
  multipleStatements: true,
});
await admin0.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\``);
await admin0.end();

const connection = await mysql.createConnection({
  ...cfg,
  timezone: 'Z',
  multipleStatements: true,
});
await applyMigrations(connection);
const db = drizzle(connection, { schema, mode: 'default' });
const writer = new MysqlCatalogWriter({ db });
const repository = new MysqlCatalogRepository({ db });
const ingest = new CatalogIngestService(writer);

const admin = ulid();
let redisClient = null;

async function runImport(label, rows) {
  const importRunId = ulid();
  await db.insert(schema.catalogImportRuns).values({
    id: importRunId,
    label,
    sourceDocument: SOURCE_DOCUMENT,
    status: 'pending',
    requestedBy: admin,
  });
  const result = await ingest.ingest({ importRunId, source: sourceFrom(label, rows) });
  return { importRunId, result };
}

const label = `dev-${process.env.SAMPLE_LABEL ?? '0.1'}`;

// Label versi katalog unik di database, dan itu benar: satu label adalah satu
// katalog. Menyemai ulang karena itu berarti menerbitkan versi BARU, persis seperti
// katalog sungguhan — bukan menimpa yang lama diam-diam.
const existing = await db
  .select({ id: schema.catalogVersions.id, status: schema.catalogVersions.status })
  .from(schema.catalogVersions)
  .where(eq(schema.catalogVersions.label, label))
  .limit(1);

if (existing.length > 0) {
  console.error(
    `✖ Versi berlabel \`${label}\` sudah ada (${existing[0].id}, ${existing[0].status}).`,
  );
  console.error('  Terbitkan versi baru:  SAMPLE_LABEL=0.2 ... seed:sample');
  console.error(`  Atau mulai dari nol:   DROP DATABASE \`${cfg.database}\` lalu semai lagi.`);
  await connection.end();
  process.exit(1);
}

const { importRunId, result } = await runImport(label, SAMPLE_ROWS);

if (result.issues.length > 0) {
  console.error(
    `✖ Katalog contoh sendiri tidak lolos validasi (${result.rowsRejected} baris ditolak):`,
  );
  for (const issue of result.issues) {
    console.error(`    baris ${issue.rowNumber} · ${issue.column}: ${issue.message}`);
  }
  await connection.end();
  process.exit(1);
}

console.log(`✓ impor  ${result.rowsAccepted} produk → run ${importRunId}`);
console.log(`✓ versi  ${result.catalogVersionId} (draft)`);

// Cache DIBUANG sungguhan kalau Redis menyala.
//
// Ini bukan kelengkapan: kunci cache katalog tidak memuat nama database, jadi satu
// Redis yang dipakai dua database pengembangan akan menyajikan katalog yang salah —
// dan gejalanya adalah daftar produk kosong sambil versi aktif menunjukkan katalog
// lain, yang sangat sulit dibaca sebagai masalah cache. Menyemai ulang adalah
// momen di mana cache paling pasti basi, jadi di sinilah ia dibuang.
const cache = await openCache();
const promotion = new CatalogPromotionService(repository, writer, cache);
const promoted = await promotion.promote({
  catalogVersionId: result.catalogVersionId,
  actor: { id: admin, role: 'catalog_admin' },
});

console.log(`✓ promosi ${promoted.catalogVersionId} → active`);
console.log(`✓ cache  ${promoted.cacheKeysInvalidated} kunci dibuang`);
if (promoted.previousActiveId !== null) {
  console.log(`  versi sebelumnya ${promoted.previousActiveId} → archived`);
}

if (process.argv.includes('--with-errors')) {
  const broken = await runImport(`${label}-rusak`, BROKEN_ROWS);
  console.log(
    `✓ impor rusak → run ${broken.importRunId} · ditolak, ${broken.result.issues.length} galat`,
  );
  for (const issue of broken.result.issues) {
    console.log(`    baris ${issue.rowNumber} · ${issue.column}: ${issue.message}`);
  }
}

await connection.end();
redisClient?.disconnect();
console.log('\nSelesai. Ingat: seluruh isinya data karangan.\n');
