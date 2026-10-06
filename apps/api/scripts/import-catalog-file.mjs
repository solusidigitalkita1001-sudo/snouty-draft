#!/usr/bin/env node
/**
 * Impor katalog dari berkas CSV ke MySQL **pengembangan lokal** sebagai versi `draft`.
 *
 *   pnpm --filter @snouty/api build
 *   pnpm --filter @snouty/api catalog:import -- <berkas.csv> --dry-run
 *   pnpm --filter @snouty/api catalog:import -- <berkas.csv> --label erp-2026-10-06 \
 *        --source-document "Export ERP master_product_updated.xlsx (diunduh 2026-10-06)"
 *
 * Jalur yang dipakai sama persis dengan impor sungguhan: adapter CSV → validator →
 * `CatalogIngestService` (idempoten lewat `catalog_import_runs`). Skrip ini TIDAK pernah
 * mempromosikan versi: promosi adalah keputusan `catalog_admin` di back-office.
 *
 * `--dry-run` hanya memvalidasi: ringkasan + seluruh issues, tanpa menyentuh database.
 * Beberapa berkas boleh diberikan sekaligus; semuanya digabung menjadi satu sumber
 * (header harus sama) sehingga SKU ganda lintas berkas ikut terdeteksi.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';

const SHARED_HOST = '192.168.1.136';

// ── Argumen ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const files = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const dryRun = flag('--dry-run');
const label = option('--label', 'erp-2026-10-06');
const sourceDocument = option('--source-document', 'Export ERP master_product_updated.xlsx');
const kind = option('--kind', 'pralon');
const issuesOut = option('--issues-out', null);
const maxIssues = Number(option('--max-issues', '200'));
/**
 * Mengimpor sisa baris setelah membuang baris yang bergalat — HANYA atas keputusan eksplisit
 * (bendera ini), karena impor baku adalah seluruhnya-atau-tidak (OQ-38). SKU yang dibuang
 * dicetak dan bisa ditulis ke berkas (`--excluded-out`) supaya tercatat.
 */
const excludeIssueRows = flag('--exclude-rows-with-issues');
const excludedOut = option('--excluded-out', null);

if (files.length === 0) {
  console.error('✖ Sebutkan minimal satu berkas CSV.');
  process.exit(1);
}
if (kind !== 'pralon' && kind !== 'sample') {
  console.error(`✖ --kind harus pralon atau sample, bukan ${kind}.`);
  process.exit(1);
}

// ── Modul dari dist ─────────────────────────────────────────────────────────
let m;
try {
  m = {
    schema: await import('../dist/infrastructure/mysql/schema/index.js'),
    ulid: (await import('../dist/shared/ulid.js')).ulid,
    ...(await import('../dist/modules/product-catalog/infrastructure/csv-catalog-import.adapter.js')),
    ...(await import('../dist/modules/product-catalog/domain/catalog-import.validator.js')),
    ...(await import('../dist/modules/product-catalog/application/catalog-ingest.service.js')),
    ...(await import('../dist/modules/product-catalog/infrastructure/catalog.mysql.writer.js')),
  };
} catch (cause) {
  console.error('✖ `dist` belum ada atau usang. Jalankan dulu: pnpm --filter @snouty/api build');
  console.error(cause.message);
  process.exit(1);
}

// ── Baca + gabung berkas ────────────────────────────────────────────────────
let source = null;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const part = m.parseCsvCatalog(text, label, sourceDocument);
  console.log(`• ${basename(file)}: ${part.rows.length} baris, ${part.columns.length} kolom`);
  if (source === null) {
    source = part;
    continue;
  }
  if (part.columns.join('\u001f') !== source.columns.join('\u001f')) {
    console.error(`✖ Header ${basename(file)} berbeda dari berkas pertama; tidak digabung.`);
    process.exit(1);
  }
  // Nomor baris dibuat unik lintas berkas dengan offset supaya laporan tetap bisa ditelusuri.
  const offset = source.rows.at(-1)?.rowNumber ?? 1;
  source = {
    ...source,
    rows: [...source.rows, ...part.rows.map((r) => ({ ...r, rowNumber: r.rowNumber + offset }))],
  };
  console.log(`  (nomor baris berkas ini digeser +${offset})`);
}

// ── Validasi (selalu) ───────────────────────────────────────────────────────
let validation = m.validateCatalogImport(source);
if (excludeIssueRows && validation.issues.length > 0) {
  const badRows = new Set(validation.issues.map((i) => i.rowNumber).filter((n) => n > 0));
  const excluded = source.rows
    .filter((r) => badRows.has(r.rowNumber))
    .map((r) => ({ rowNumber: r.rowNumber, sku: r.values.sku ?? '' }));
  const kept = source.rows.filter((r) => !badRows.has(r.rowNumber));
  console.log(`\nMembuang ${excluded.length} baris bergalat (--exclude-rows-with-issues):`);
  for (const row of excluded) console.log(`  baris ${row.rowNumber} · ${row.sku}`);
  if (excludedOut) {
    writeFileSync(excludedOut, JSON.stringify({ issues: validation.issues, excluded }, null, 2));
    console.log(`  (dicatat ke ${excludedOut})`);
  }
  // Validasi ulang: rujukan antar-baris dan SKU ganda harus dinilai atas himpunan yang tersisa.
  source = { ...source, rows: kept };
  validation = m.validateCatalogImport(source);
}
if (validation.warnings.length > 0) {
  console.log(`\nPeringatan (${validation.warnings.length}, tidak menggagalkan):`);
  for (const w of validation.warnings.slice(0, maxIssues)) {
    console.log(`  baris ${w.rowNumber} · ${w.column} · ${w.message}`);
  }
}
const byColumn = new Map();
for (const issue of validation.issues) {
  byColumn.set(issue.column, (byColumn.get(issue.column) ?? 0) + 1);
}
console.log(`\nLabel: ${label} · kind: ${kind} · dokumen sumber: ${sourceDocument}`);
console.log(
  `Diterima ${validation.rows.length} baris · ditolak ${source.rows.length - validation.rows.length} · issues ${validation.issues.length}`,
);
for (const [column, n] of [...byColumn.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${column}: ${n}`);
}
if (validation.issues.length > 0) {
  console.log('\nIssues:');
  for (const issue of validation.issues.slice(0, maxIssues)) {
    console.log(`  baris ${issue.rowNumber} · ${issue.column} · ${issue.message}`);
  }
  if (validation.issues.length > maxIssues) {
    console.log(`  … ${validation.issues.length - maxIssues} lagi (lihat --issues-out).`);
  }
}
if (issuesOut) {
  writeFileSync(issuesOut, JSON.stringify(validation.issues, null, 2));
  console.log(`\nSeluruh issues ditulis ke ${issuesOut}`);
}
if (dryRun) {
  console.log('\n(dry-run: tidak ada yang ditulis ke database)');
  process.exit(validation.issues.length === 0 ? 0 : 2);
}
if (validation.issues.length > 0) {
  console.error(
    '\n✖ Ada issues — versi draft hanya dibuat bila nol galat (OQ-38). Tidak ada yang ditulis.',
  );
  process.exit(2);
}

// ── Impor ke DB lokal ───────────────────────────────────────────────────────
const cfg = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3316),
  database: process.env.DB_DATABASE ?? 'snouty',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_ROOT_PASSWORD ?? 'snouty',
};
if (cfg.host.includes(SHARED_HOST)) {
  console.error(`✖ Menolak mengimpor ke server bersama (${SHARED_HOST}) dari skrip ini (N-6).`);
  process.exit(1);
}

const connection = await mysql.createConnection({
  ...cfg,
  timezone: 'Z',
  multipleStatements: true,
});
const db = drizzle(connection, { schema: m.schema, mode: 'default' });

const existing = await db
  .select({ id: m.schema.catalogVersions.id, status: m.schema.catalogVersions.status })
  .from(m.schema.catalogVersions)
  .where(eq(m.schema.catalogVersions.label, label))
  .limit(1);
if (existing.length > 0) {
  console.error(
    `✖ Versi berlabel \`${label}\` sudah ada (${existing[0].id}, ${existing[0].status}). Pakai --label lain.`,
  );
  await connection.end();
  process.exit(1);
}

const importRunId = m.ulid();
await db.insert(m.schema.catalogImportRuns).values({
  id: importRunId,
  label,
  sourceDocument,
  status: 'pending',
  requestedBy: m.ulid(),
});
const ingest = new m.CatalogIngestService(new m.MysqlCatalogWriter({ db }));
const result = await ingest.ingest({ importRunId, source, kind });
await connection.end();

console.log(
  `\nImport run ${importRunId}: diterima ${result.rowsAccepted}, ditolak ${result.rowsRejected}`,
);
if (result.catalogVersionId) {
  console.log(
    `✓ Versi draft ${result.catalogVersionId} (label ${label}, kind ${kind}). Belum aktif — promosikan lewat back-office.`,
  );
} else {
  console.error('✖ Impor ditolak oleh ingest service.');
  process.exit(2);
}
