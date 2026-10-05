#!/usr/bin/env node
/**
 * Mengubah tier sebuah akun — alat pengembangan lokal, pasangan grant-role.mjs.
 *
 *   node scripts/set-tier.mjs <email> <registered|advanced>
 *
 * Dibutuhkan untuk melihat fitur tier lanjutan (BOM, skema, laporan PDF) di
 * pengembangan: tidak ada jalur produk untuk menaikkan tier (OQ-15 menyerahkannya ke
 * pemilik). Hanya mau berjalan terhadap database lokal.
 */
import mysql from 'mysql2/promise';

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const VALID_TIERS = ['registered', 'advanced'];

const host = process.env.DB_HOST ?? '127.0.0.1';
if (!LOCAL_HOSTS.has(host)) {
  console.error(`✖ Menolak mengubah tier di host non-lokal (${host}).`);
  process.exit(1);
}

const [email, tier] = process.argv.slice(2);
if (!email || !tier || !VALID_TIERS.includes(tier)) {
  console.error('Pemakaian: node scripts/set-tier.mjs <email> <registered|advanced>');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT ?? 3316),
  database: process.env.DB_DATABASE ?? 'snouty',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_ROOT_PASSWORD ?? 'snouty',
});

const [rows] = await conn.query('SELECT id, name, tier FROM users WHERE email = ?', [
  email.trim().toLowerCase(),
]);
if (rows.length === 0) {
  console.error(`✖ Tidak ada akun dengan email ${email}. Register dulu lewat aplikasi.`);
  await conn.end();
  process.exit(1);
}

const user = rows[0];
await conn.query('UPDATE users SET tier = ? WHERE id = ?', [tier, user.id]);
console.log(`✓ ${user.name} <${email}>: ${user.tier} → ${tier}`);
console.log('  Tier terbaca di access token BERIKUTNYA — login ulang atau tunggu refresh.');
await conn.end();
