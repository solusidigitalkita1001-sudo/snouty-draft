#!/usr/bin/env node
/**
 * Memberi peran internal ke sebuah akun — alat pengembangan lokal.
 *
 *   node scripts/grant-role.mjs <email> <peran> [peran ...]
 *
 * Hanya mau berjalan terhadap database lokal. Di lingkungan sungguhan, pemberian
 * peran adalah operasi `/internal/users/*` milik peran `admin`, yang diaudit —
 * skrip yang melewati audit tidak boleh bisa menunjuk ke sana.
 */
import mysql from 'mysql2/promise';

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const VALID_ROLES = ['sales_reviewer', 'technical_team', 'catalog_admin', 'domain_expert', 'admin'];

const host = process.env.DB_HOST ?? '127.0.0.1';
if (!LOCAL_HOSTS.has(host)) {
  console.error(`✖ Menolak memberi peran di host non-lokal (${host}).`);
  console.error('  Di lingkungan sungguhan, pakai /internal/users/* yang diaudit.');
  process.exit(1);
}

const [email, ...roles] = process.argv.slice(2);
if (!email || roles.length === 0) {
  console.error('Pemakaian: node scripts/grant-role.mjs <email> <peran> [peran ...]');
  console.error(`Peran sah: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}
const invalid = roles.filter((role) => !VALID_ROLES.includes(role));
if (invalid.length > 0) {
  console.error(`✖ Peran tidak dikenal: ${invalid.join(', ')}`);
  process.exit(1);
}

const conn = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT ?? 3316),
  database: process.env.DB_DATABASE ?? 'snouty',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_ROOT_PASSWORD ?? 'snouty',
});

const [rows] = await conn.query('SELECT id, name FROM users WHERE email = ?', [
  email.trim().toLowerCase(),
]);
if (rows.length === 0) {
  console.error(`✖ Tidak ada akun dengan email ${email}. Register dulu lewat aplikasi.`);
  await conn.end();
  process.exit(1);
}

const user = rows[0];
for (const role of roles) {
  // INSERT IGNORE: memberi peran yang sudah dimiliki bukan kesalahan.
  await conn.query('INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [user.id, role]);
}
const [granted] = await conn.query('SELECT role FROM user_roles WHERE user_id = ?', [user.id]);
console.log(`✓ ${user.name} <${email}> kini memegang: ${granted.map((r) => r.role).join(', ')}`);
console.log('  Peran terbaca di access token BERIKUTNYA — login ulang atau tunggu refresh.');
await conn.end();
