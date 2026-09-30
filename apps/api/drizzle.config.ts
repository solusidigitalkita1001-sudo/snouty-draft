import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit HANYA dipakai untuk membangkitkan berkas `.sql`.
 * Penerapannya adalah langkah terpisah yang menolak berjalan tanpa persetujuan
 * eksplisit — lihat scripts/db-apply.mjs dan docs/DATABASE.md §4.
 *
 * Tidak ada shadow database di sini: itu salah satu alasan Drizzle dipilih
 * dibanding Prisma untuk server yang dipakai bersama tujuh aplikasi lain.
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './src/infrastructure/mysql/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
