#!/usr/bin/env node
// Memeriksa baris katalog yatim SEBELUM migration 0011 menambahkan foreign key.
//
// MySQL menolak menambahkan FK bila yatim sudah ada, dan pesan galatnya tidak
// menyebutkan baris mana. Skrip ini menyebutkannya, sehingga migration yang gagal di
// database berisi bisa diperbaiki alih-alih ditebak.
import mysql from 'mysql2/promise';

const SHARED_HOST = '192.168.1.136';
const host = process.env.DB_HOST ?? '127.0.0.1';
if (host.includes(SHARED_HOST)) {
  console.error(
    'Skrip ini tidak dijalankan terhadap server bersama tanpa prosedur docs/DATABASE.md §4.',
  );
  process.exit(1);
}

const CHECKS = [
  ['products', 'catalog_version_id', 'catalog_versions', 'id'],
  ['product_sizes', 'product_id', 'products', 'id'],
  ['product_specs', 'product_id', 'products', 'id'],
  ['product_documents', 'product_id', 'products', 'id'],
  ['product_images', 'product_id', 'products', 'id'],
  ['product_compatibility', 'product_id', 'products', 'id'],
  ['product_compatibility', 'compatible_product_id', 'products', 'id'],
];

const conn = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT ?? 3316),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'snouty',
});

let orphans = 0;
for (const [child, column, parent, parentColumn] of CHECKS) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`${child}\` c
     LEFT JOIN \`${parent}\` p ON c.\`${column}\` = p.\`${parentColumn}\`
     WHERE c.\`${column}\` IS NOT NULL AND p.\`${parentColumn}\` IS NULL`,
  );
  const n = Number(rows[0].n);
  if (n > 0) {
    console.error(`✖ ${child}.${column}: ${n} baris yatim`);
    orphans += n;
  } else {
    console.log(`✓ ${child}.${column}`);
  }
}

await conn.end();

if (orphans > 0) {
  console.error(`\n${orphans} baris yatim. Migration 0011 akan gagal sampai ini dibersihkan.`);
  process.exit(1);
}
console.log('\nTidak ada baris yatim: migration 0011 aman dijalankan.');
