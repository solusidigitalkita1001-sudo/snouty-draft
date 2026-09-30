import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPool, type Pool } from 'mysql2/promise';
import { loadEnv } from '../../config/env.js';

/**
 * Satu pool per proses, dibuat di satu tempat dan di-inject.
 * Tidak ada modul yang membuka koneksinya sendiri (docs/DATABASE.md §7).
 *
 * Ukuran pool sengaja kecil: server ini melayani delapan aplikasi, jadi pool
 * besar "untuk jaga-jaga" mengambil kapasitas dari tim lain.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

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
