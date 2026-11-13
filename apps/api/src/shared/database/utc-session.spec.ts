/**
 * Temuan 5 smoke test 13 Nov 2026 — `timezone: 'Z'` hanya mengatur driver; nilai yang dihitung
 * server (`DEFAULT CURRENT_TIMESTAMP`) memakai zona waktu server, jadi di server ber-WIB
 * `created_at` 7 jam di depan `expires_at` yang ditulis aplikasi dan refresh token ditolak
 * batasannya. Nilai sesi yang diterima sebagai UTC diuji di sini; sesi sungguhannya diperiksa
 * saat boot (`assertUtcSession`) terhadap MySQL yang hidup.
 */
import { describe, expect, it } from 'vitest';
import { isUtcSessionTimeZone, UTC_OFFSET } from './database.service.js';

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
});
