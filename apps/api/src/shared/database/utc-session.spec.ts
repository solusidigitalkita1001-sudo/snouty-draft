/**
 * Temuan 5 smoke test 13 Nov 2026 — `timezone: 'Z'` hanya mengatur driver; nilai yang dihitung
 * server (`DEFAULT CURRENT_TIMESTAMP`) memakai zona waktu server, jadi di server ber-WIB
 * `created_at` 7 jam di depan `expires_at` yang ditulis aplikasi dan refresh token ditolak
 * batasannya. Nilai sesi yang diterima sebagai UTC diuji di sini; sesi sungguhannya diperiksa
 * saat boot (`assertUtcSession`) terhadap MySQL yang hidup.
 */
import type { Pool } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { isUtcSessionTimeZone, useUtcSessions, UTC_OFFSET } from './database.service.js';

describe('zona waktu sesi MySQL', () => {
  it('UTC dalam bentuk apa pun yang dilaporkan MySQL diterima', () => {
    for (const value of [UTC_OFFSET, '+00:00', 'UTC', ' +00:00 ', '+00:00:00']) {
      expect(isUtcSessionTimeZone(value), value).toBe(true);
    }
  });

  it('WIB dan zona lain ditolak — termasuk SYSTEM, yang artinya "zona waktu mesin"', () => {
    for (const value of ['+07:00', 'Asia/Jakarta', 'SYSTEM', '', '-05:00']) {
      expect(isUtcSessionTimeZone(value), value).toBe(false);
    }
  });

  /**
   * Koneksi yang dibawa event `connection` adalah koneksi gaya callback, meski tipe mysql2
   * menjanjikan versi promise-nya. Memperlakukannya sebagai promise melempar di dalam emitter,
   * pengambilan koneksi tidak pernah selesai, dan SETIAP permintaan menggantung tanpa pesan —
   * tepatnya yang terjadi sampai perbaikan ini.
   */
  it('perintahnya dikirim dalam bentuk callback, dan koneksi yang bukan promise tidak membuatnya melempar', () => {
    const issued: string[] = [];
    const connected: Array<(connection: unknown) => void> = [];
    const pool = {
      on(event: string, listener: (connection: unknown) => void) {
        if (event === 'connection') connected.push(listener);
        return pool;
      },
    };

    useUtcSessions(pool as unknown as Pool);

    const callbackConnection = {
      query(sql: string, done?: (error: unknown) => void) {
        issued.push(sql);
        if (done === undefined) throw new Error('query dipanggil tanpa callback');
        done(null);
        return undefined; // bukan promise — persis seperti driver sungguhan
      },
    };

    expect(() => connected[0]?.(callbackConnection)).not.toThrow();
    expect(issued).toEqual([`SET time_zone = '${UTC_OFFSET}'`]);
  });
});
