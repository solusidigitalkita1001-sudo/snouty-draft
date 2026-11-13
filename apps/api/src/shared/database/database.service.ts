import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import { loadEnv } from '../../config/env.js';
import * as schema from '../../infrastructure/mysql/schema/index.js';

/** Query builder yang sudah terikat ke skema — satu-satunya cara modul menyentuh MySQL. */
export type SnoutyDatabase = MySql2Database<typeof schema>;

/**
 * Zona waktu sesi yang dipakai aplikasi ini. Semua kolom waktu di MySQL disimpan UTC, dan nilai
 * yang dihitung server (`DEFAULT CURRENT_TIMESTAMP`) harus memakai zona yang sama dengan nilai
 * yang ditulis aplikasi — kalau tidak, keduanya berbeda 7 jam di server ber-WIB.
 */
export const UTC_OFFSET = '+00:00';

/** Nilai `@@session.time_zone` yang diterima sebagai UTC. */
const UTC_SESSION_VALUES: readonly string[] = [UTC_OFFSET, 'UTC', '+00:00:00'];

export function isUtcSessionTimeZone(value: string): boolean {
  return UTC_SESSION_VALUES.includes(value.trim());
}

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
      // Driver menulis dan membaca DATETIME sebagai UTC.
      timezone: 'Z',
    });
    // …dan SESINYA juga UTC. `timezone: 'Z'` hanya mengatur cara driver menerjemahkan Date; nilai
    // yang dihitung SERVER (`created_at DEFAULT CURRENT_TIMESTAMP`) tetap memakai zona waktu
    // server. Di server ber-WIB itu berarti `created_at` 7 jam di depan `expires_at` yang ditulis
    // aplikasi, dan batasan `ck_refresh_tokens_expiry` menolak baris refresh token — yaitu
    // register dan login gagal (smoke test 13 Nov 2026, temuan 5).
    //
    // Hanya LEVEL SESI: server 192.168.1.136 memuat tujuh database aplikasi lain, dan zona waktu
    // globalnya bukan milik kami.
    this.pool.on('connection', (connection) => {
      void connection.query(`SET time_zone = '${UTC_OFFSET}'`).catch(() => {
        // Koneksi yang menolak perintah ini tidak dipakai diam-diam: pemeriksaan di bawah
        // (`assertUtcSession`) yang memutuskan proses boleh jalan atau tidak.
      });
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

  /**
   * Zona waktu sesi yang sedang berlaku — dibaca dari server, bukan diasumsikan dari opsi pool.
   */
  async sessionTimeZone(): Promise<string> {
    const [rows] = await this.pool.query('SELECT @@session.time_zone AS tz');
    const first = (rows as ReadonlyArray<Record<string, unknown>>)[0];
    return String(first?.['tz'] ?? '');
  }

  /**
   * Proses tidak boleh jalan di atas sesi yang bukan UTC (smoke test 13 Nov 2026, temuan 5):
   * `created_at DEFAULT CURRENT_TIMESTAMP` akan 7 jam di depan `expires_at` yang ditulis
   * aplikasi, dan register/login gagal karena batasan `ck_refresh_tokens_expiry`. Lebih baik
   * gagal di detik pertama dengan sebabnya daripada menolak login satu per satu.
   */
  async assertUtcSession(): Promise<void> {
    const tz = await this.sessionTimeZone();
    if (!isUtcSessionTimeZone(tz)) {
      throw new Error(
        `zona waktu sesi MySQL bukan UTC: '${tz}'. Driver sudah menyetel SET time_zone = '${UTC_OFFSET}' ` +
          'per koneksi; periksa hak akses pengguna database. Jangan mengubah zona waktu global ' +
          'server bersama (docs/DATABASE.md §4b).',
      );
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
