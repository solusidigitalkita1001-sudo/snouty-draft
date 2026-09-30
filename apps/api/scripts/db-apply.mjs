#!/usr/bin/env node
/**
 * Menerapkan migration ke database — SENGAJA merepotkan.
 *
 * docs/DATABASE.md §4 langkah 7. Server di 192.168.1.136 memuat tujuh database
 * aplikasi lain; perintah yang "tinggal jalan" adalah cara paling umum merusak
 * data orang lain pada pukul dua pagi. Karena itu perintah ini:
 *
 *   1. menolak berjalan tanpa MIGRATION_APPROVED=1
 *   2. mencetak SQL lengkap dan host tujuan sebelum apa pun dijalankan
 *   3. meminta nama database diketik ulang sebagai konfirmasi
 *   4. mengingatkan bahwa backup harus sudah dikonfirmasi
 *
 * Tidak ada perintah yang mengarang dan menerapkan migration sekaligus, dan
 * tidak ada jalur yang bisa menghapus skema.
 */
import { createInterface } from 'node:readline/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';

const dir = process.argv[2] ?? 'drizzle';
const host = process.env.DB_HOST;
const database = process.env.DB_DATABASE;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (process.env.MIGRATION_APPROVED !== '1') {
  fail(
    'Migration belum disetujui.\n' +
      '  Jalankan ulang dengan MIGRATION_APPROVED=1 SETELAH pemilik menyetujui\n' +
      '  dan backup terbaru dikonfirmasi (docs/DATABASE.md §4 langkah 6).',
  );
}
if (!host || !database) fail('DB_HOST dan DB_DATABASE wajib diisi.');

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
  .sort();
if (files.length === 0) fail(`Tidak ada berkas migration di ${dir}`);

console.log('\n─────────────────────────────────────────────────────────────');
console.log(`  TUJUAN : ${host} / ${database}`);
console.log(`  BERKAS : ${files.join(', ')}`);
if (host.includes('192.168.1.136')) {
  console.log('  ⚠  INI SERVER BERSAMA — memuat tujuh database aplikasi lain.');
}
console.log('─────────────────────────────────────────────────────────────\n');

for (const file of files) {
  console.log(`--- ${file} ---`);
  console.log(readFileSync(join(dir, file), 'utf8'));
}

const rl = createInterface({ input: stdin, output: stdout });
const answer = await rl.question(
  `Ketik ulang nama database untuk melanjutkan (${database}), atau apa pun untuk batal: `,
);
rl.close();
if (answer.trim() !== database) fail('Dibatalkan — nama database tidak cocok.');

// Driver baru dimuat setelah semua pagar lolos.
const { default: mysql } = await import('mysql2/promise');
const conn = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT ?? 3306),
  database,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});

try {
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed !== '') await conn.query(trimmed);
    }
    console.log(`✓ ${file}`);
  }
} finally {
  await conn.end();
}
console.log('\nSelesai.\n');
