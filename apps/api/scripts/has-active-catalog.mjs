#!/usr/bin/env node
/**
 * Mencetak jumlah versi katalog `active` (0 atau 1) — dipakai `scripts/dev-up.*` untuk
 * memutuskan apakah katalog contoh perlu disemai. Tanpa `dist`, tanpa drizzle: satu kueri.
 * Gagal terhubung → mencetak `?` dan keluar 0, supaya dev-up tidak menyemai membabi buta.
 */
import mysql from 'mysql2/promise';

const cfg = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3316),
  database: process.env.DB_DATABASE ?? 'snouty',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_ROOT_PASSWORD ?? 'snouty',
};

try {
  const connection = await mysql.createConnection(cfg);
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS n FROM catalog_versions WHERE status = 'active'",
  );
  console.log(String(rows[0].n));
  await connection.end();
} catch {
  console.log('?');
}
