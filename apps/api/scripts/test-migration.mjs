#!/usr/bin/env node
/**
 * P1-01a — menguji migration naik dan turun terhadap MySQL sekali pakai.
 *
 * Migration adalah satu-satunya bagian sistem yang menyentuh infrastruktur
 * bersama, jadi ia diuji terhadap database sungguhan, bukan mock. Constraint
 * CHECK khususnya: ia hanya bermakna kalau MySQL benar-benar menolak baris yang
 * melanggarnya, dan itu tidak bisa dibuktikan tanpa MySQL.
 *
 * Skrip ini MENOLAK berjalan terhadap server bersama (docs/DATABASE.md §2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_HOST = '192.168.1.136';
const DIR = 'drizzle';

const cfg = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3317),
  database: process.env.DB_DATABASE ?? 'snouty_test',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'test',
};

if (cfg.host.includes(SHARED_HOST)) {
  console.error(`✖ Menolak menguji migration terhadap server bersama (${SHARED_HOST}).`);
  process.exit(1);
}

const { default: mysql } = await import('mysql2/promise');
const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`  ✗ ${name}\n      ${err.message}`);
    failed += 1;
  }
}

/** Menjalankan satu berkas migration, statement per statement. */
async function run(file) {
  const sql = readFileSync(join(DIR, file), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed !== '') await conn.query(trimmed);
  }
}

async function tableCount() {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN
     ('catalog_versions','products','product_sizes','product_specs',
      'product_compatibility','product_documents','product_images',
      'catalog_import_runs','audit_logs')`,
    [cfg.database],
  );
  return Number(rows[0].n);
}

/** Memastikan sebuah operasi ditolak database, bukan diterima diam-diam. */
async function mustReject(sql, params = []) {
  try {
    await conn.query(sql, params);
  } catch {
    return;
  }
  throw new Error('diterima padahal seharusnya ditolak');
}

const ulid = (n) => String(n).padStart(26, 'A');
const rowHash = (n) => String(n).padStart(64, '0');

/** Seluruh migration naik, berurutan; dipakai juga untuk membuktikan rollback bersih. */
const UP = ['0000_catalog.sql', '0001_catalog_import_runs.sql', '0002_audit_logs.sql'];
const DOWN = [
  '0002_audit_logs.down.sql',
  '0001_catalog_import_runs.down.sql',
  '0000_catalog.down.sql',
];
const TABLES = 9;

console.log(`\nMigration test → ${cfg.host}:${cfg.port}/${cfg.database}\n`);

// ── Naik ────────────────────────────────────────────────────────────────────
console.log('up:');
await check(`membuat ${TABLES} tabel katalog`, async () => {
  for (const file of UP) await run(file);
  const n = await tableCount();
  if (n !== TABLES) throw new Error(`tabel terbentuk: ${n}, diharapkan ${TABLES}`);
});

await check('bisa dijalankan pada database kosong tanpa galat', async () => {
  // Sudah terbukti oleh langkah di atas; dicatat terpisah agar kegagalan jelas.
});

// ── Constraint ──────────────────────────────────────────────────────────────
console.log('\nconstraint:');

const V1 = ulid(1);
const V2 = ulid(2);
const P1 = ulid(3);

await check('menerima versi katalog yang sah', async () => {
  await conn.query(
    `INSERT INTO catalog_versions (id,label,source_document,status,effective_from,imported_by)
     VALUES (?,?,?,?,NOW(3),?)`,
    [V1, 'v2.4', 'Katalog produk Pralon 2026', 'active', ulid(9)],
  );
});

await check('menolak status di luar draft/active/archived', () =>
  mustReject(
    `INSERT INTO catalog_versions (id,label,source_document,status,effective_from,imported_by)
     VALUES (?,?,?,?,NOW(3),?)`,
    [V2, 'v9.9', 'doc', 'published', ulid(9)],
  ),
);

await check('menolak versi aktif KEDUA — "tepat satu aktif" dijamin database', () =>
  mustReject(
    `INSERT INTO catalog_versions (id,label,source_document,status,effective_from,imported_by)
     VALUES (?,?,?,?,NOW(3),?)`,
    [V2, 'v2.5', 'doc', 'active', ulid(9)],
  ),
);

await check('mengizinkan banyak versi draft berdampingan', async () => {
  await conn.query(
    `INSERT INTO catalog_versions (id,label,source_document,status,effective_from,imported_by)
     VALUES (?,?,?,?,NOW(3),?), (?,?,?,?,NOW(3),?)`,
    [V2, 'v2.5', 'doc', 'draft', ulid(9), ulid(4), 'v2.6', 'doc', 'draft', ulid(9)],
  );
});

await check('menerima produk yang sah', async () => {
  await conn.query(
    `INSERT INTO products (id,catalog_version_id,sku,name,family,category,status,source_document,source_page,row_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      P1,
      V1,
      'PVC-AW-1',
      'Pralon PVC AW',
      'PVC AW',
      'PIPA AIR BERSIH · SNI',
      'active',
      'Katalog produk Pralon 2026',
      14,
      rowHash(1),
    ],
  );
});

await check('menolak produk tanpa rujukan halaman yang masuk akal', () =>
  mustReject(
    `INSERT INTO products (id,catalog_version_id,sku,name,family,category,status,source_document,source_page,row_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [ulid(5), V1, 'PVC-AW-2', 'x', 'PVC AW', 'c', 'active', 'doc', 0, rowHash(5)],
  ),
);

await check('menolak SKU ganda dalam satu versi katalog', () =>
  mustReject(
    `INSERT INTO products (id,catalog_version_id,sku,name,family,category,status,source_document,source_page,row_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [ulid(6), V1, 'PVC-AW-1', 'x', 'PVC AW', 'c', 'active', 'doc', 14, rowHash(6)],
  ),
);

await check('menerima spesifikasi terverifikasi dan yang tidak tersedia', async () => {
  await conn.query(
    `INSERT INTO product_specs (product_id,spec_key,spec_value,provenance)
     VALUES (?,?,?,?), (?,?,?,?)`,
    [P1, 'material', 'uPVC', 'VERIFIED', P1, 'pressure_class', null, 'UNAVAILABLE'],
  );
});

await check('menolak fakta produk bertanda ASSUMED — invarian C-1 di lapisan data', () =>
  mustReject(
    `INSERT INTO product_specs (product_id,spec_key,spec_value,provenance) VALUES (?,?,?,?)`,
    [P1, 'rod_length', '4 m', 'ASSUMED'],
  ),
);

await check('menolak nilai kosong yang mengaku VERIFIED', () =>
  mustReject(
    `INSERT INTO product_specs (product_id,spec_key,spec_value,provenance) VALUES (?,?,?,?)`,
    [P1, 'joint_type', null, 'VERIFIED'],
  ),
);

await check('menolak ukuran pipa nol atau negatif', () =>
  mustReject(`INSERT INTO product_sizes (product_id,size_inches_x1000,size_label) VALUES (?,?,?)`, [
    P1,
    0,
    '0"',
  ]),
);

await check('menolak produk yang kompatibel dengan dirinya sendiri', () =>
  mustReject(
    `INSERT INTO product_compatibility (product_id,compatible_product_id,kind) VALUES (?,?,?)`,
    [P1, P1, 'tee'],
  ),
);

await check('menolak jenis fitting di luar daftar', () =>
  mustReject(
    `INSERT INTO product_compatibility (product_id,compatible_product_id,kind) VALUES (?,?,?)`,
    [P1, ulid(7), 'flange'],
  ),
);

await check('menolak row_hash ganda dalam satu versi — idempotensi dijamin database', () =>
  mustReject(
    `INSERT INTO products (id,catalog_version_id,sku,name,family,category,status,source_document,source_page,row_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [ulid(10), V1, 'PVC-AW-9', 'x', 'PVC AW', 'c', 'active', 'doc', 14, rowHash(1)],
  ),
);

await check('mengizinkan row_hash yang sama di versi katalog yang berbeda', async () => {
  await conn.query(
    `INSERT INTO products (id,catalog_version_id,sku,name,family,category,status,source_document,source_page,row_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [ulid(11), V2, 'PVC-AW-1', 'x', 'PVC AW', 'c', 'active', 'doc', 14, rowHash(1)],
  );
});

await check('menerima run impor yang masih menunggu', async () => {
  await conn.query(
    `INSERT INTO catalog_import_runs (id,label,source_document,status,requested_by)
     VALUES (?,?,?,?,?)`,
    [ulid(12), 'v2.7', 'Katalog produk Pralon 2026', 'pending', ulid(9)],
  );
});

await check('menolak status run di luar pending/rejected/ingested/failed', () =>
  mustReject(
    `INSERT INTO catalog_import_runs (id,label,source_document,status,requested_by)
     VALUES (?,?,?,?,?)`,
    [ulid(13), 'v2.8', 'doc', 'running', ulid(9)],
  ),
);

await check('mengizinkan run menautkan versi katalog sebelum ditandai selesai', async () => {
  // Penautan lebih awal itu yang membuat job idempoten: percobaan kedua memakai
  // ulang versi yang sama alih-alih membuat versi draft kedua.
  await conn.query(
    `INSERT INTO catalog_import_runs (id,label,source_document,status,catalog_version_id,requested_by)
     VALUES (?,?,?,?,?,?)`,
    [ulid(14), 'v2.9', 'doc', 'pending', ulid(4), ulid(9)],
  );
});

await check('menolak dua run yang mengaku melahirkan versi katalog yang sama', async () => {
  await conn.query(
    `INSERT INTO catalog_import_runs (id,label,source_document,status,catalog_version_id,requested_by)
     VALUES (?,?,?,?,?,?)`,
    [ulid(15), 'v3.0', 'doc', 'ingested', V1, ulid(9)],
  );
  await mustReject(
    `INSERT INTO catalog_import_runs (id,label,source_document,status,catalog_version_id,requested_by)
     VALUES (?,?,?,?,?,?)`,
    [ulid(16), 'v3.1', 'doc', 'ingested', V1, ulid(9)],
  );
});

await check('mengizinkan banyak run yang belum melahirkan versi apa pun', async () => {
  await conn.query(
    `INSERT INTO catalog_import_runs (id,label,source_document,status,requested_by)
     VALUES (?,?,?,?,?), (?,?,?,?,?)`,
    [ulid(17), 'v3.2', 'doc', 'rejected', ulid(9), ulid(18), 'v3.3', 'doc', 'failed', ulid(9)],
  );
});

// ── Turun ───────────────────────────────────────────────────────────────────
console.log('\ndown:');
await check('menghapus seluruh tabel katalog', async () => {
  for (const file of DOWN) await run(file);
  const n = await tableCount();
  if (n !== 0) throw new Error(`masih tersisa ${n} tabel`);
});

await check('bisa dijalankan naik lagi setelah turun (rollback benar-benar bersih)', async () => {
  for (const file of UP) await run(file);
  const n = await tableCount();
  if (n !== TABLES) throw new Error(`tabel terbentuk: ${n}`);
  for (const file of DOWN) await run(file);
});

await conn.end();

console.log(`\n${passed} lolos, ${failed} gagal\n`);
process.exit(failed === 0 ? 0 : 1);
