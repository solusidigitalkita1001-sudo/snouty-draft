import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import { loadEnv } from '../../config/env.js';
import * as schema from '../../infrastructure/mysql/schema/index.js';

/** Query builder yang sudah terikat ke skema — satu-satunya cara modul menyentuh MySQL. */
export type SnoutyDatabase = MySql2Database<typeof schema>;

/**
 * Yang sebenarnya dibutuhkan sebuah repository: query builder, bukan pool mentah.
 *
 * Repository bergantung pada interface ini, bukan pada `DatabaseService`, supaya
 * tes integrasi bisa menyuntikkan koneksi ke kontainer sekali pakai tanpa ikut
 * memuat konfigurasi environment proses (pola yang sama dengan `Pingable`).
 */
export interface QueryRunner {
  readonly db: SnoutyDatabase;
}

/**
 * Satu pool per proses, dibuat di satu tempat dan di-inject.
 * Tidak ada modul yang membuka koneksinya sendiri (docs/DATABASE.md §7).
 *
 * Ukuran pool sengaja kecil: server ini melayani delapan aplikasi, jadi pool
 * besar "untuk jaga-jaga" mengambil kapasitas dari tim lain.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy, QueryRunner {
  private readonly pool: Pool;
  readonly db: SnoutyDatabase;

  constructor() {
    const env = loadEnv();
    this.pool = createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_DATABASE,
      user: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      connectionLimit: env.DB_POOL_MAX,
      connectTimeout: 5_000,
      waitForConnections: true,
      timezone: 'Z',
    });
    this.db = drizzle(this.pool, { schema, mode: 'default' });
  }

  /**
   * Health check: hanya `SELECT 1`. Tidak menghitung baris, tidak membaca tabel —
   * pemeriksaan kesehatan tidak boleh menjadi beban bagi server bersama.
   */
  async ping(): Promise<boolean> {
    await this.pool.query('SELECT 1');
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
