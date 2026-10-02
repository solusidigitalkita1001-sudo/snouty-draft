#!/usr/bin/env node
/**
 * Menerapkan migration ke database.
 *
 * **Dua perilaku, dan yang membedakannya adalah host tujuan.**
 *
 * Ke database lokal: langsung jalan. Pengembangan memakai MySQL lokal
 * (docs/DATABASE.md §4a), dan upacara persetujuan di mesin sendiri adalah gesekan
 * tanpa imbalan — gesekan yang justru mengajari orang mengetik
 * `MIGRATION_APPROVED=1` tanpa membacanya, sehingga pagar itu berhenti berarti
 * apa pun ketika benar-benar dibutuhkan.
 *
 * Ke host lain — termasuk server bersama di 192.168.1.136 yang memuat tujuh
 * database aplikasi lain — SENGAJA merepotkan (docs/DATABASE.md §4 langkah 7):
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

if (!host || !database) fail('DB_HOST dan DB_DATABASE wajib diisi.');

/**
 * Hanya alamat loopback yang dianggap lokal.
 *
 * Nama host yang "kedengaran lokal" seperti `mysql` atau `db` TIDAK termasuk: di
 * dalam jaringan Docker keduanya bisa menunjuk ke mana saja, dan pagar yang bisa
 * dilewati dengan menamai host adalah pagar yang akan dilewati.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const isLocal = LOCAL_HOSTS.has(host);

if (!isLocal && process.env.MIGRATION_APPROVED !== '1') {
  fail(
    `Migration ke host non-lokal (${host}) belum disetujui.\n` +
      '  Jalankan ulang dengan MIGRATION_APPROVED=1 SETELAH pemilik menyetujui\n' +
      '  dan backup terbaru dikonfirmasi (docs/DATABASE.md §4 langkah 6).',
  );
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
  .sort();
if (files.length === 0) fail(`Tidak ada berkas migration di ${dir}`);

console.log('\n─────────────────────────────────────────────────────────────');
console.log(`  TUJUAN : ${host} / ${database}${isLocal ? '  (lokal)' : ''}`);
console.log(`  BERKAS : ${files.join(', ')}`);
if (host.includes('192.168.1.136')) {
  console.log('  ⚠  INI SERVER BERSAMA — memuat tujuh database aplikasi lain.');
}
console.log('─────────────────────────────────────────────────────────────\n');

// SQL lengkap dan konfirmasi ketik-ulang hanya untuk host non-lokal. Mencetak
// ratusan baris SQL setiap kali pengembang menerapkan migration di mesinnya sendiri
// melatih kebiasaan menggulir tanpa membaca — dan kebiasaan itu terbawa ke tempat
// yang salah.
if (!isLocal) {
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
}

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
