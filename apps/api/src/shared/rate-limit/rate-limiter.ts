/**
 * Penghitung batas laju berbasis Redis. docs/SECURITY.md §8.
 *
 * **Redis, bukan memori proses.** Batas yang disimpan di memori hanya berlaku per instans,
 * jadi dua instans berarti dua kali kuota — dan batas yang bisa dilipatgandakan dengan
 * menambah instans bukan batas.
 *
 * Jendela tetap (fixed window) dengan `INCR` + `EXPIRE`: sederhana, atomik, dan cukup untuk
 * tujuannya. Sliding window lebih halus tetapi butuh struktur yang jauh lebih mahal, dan
 * yang dihambat di sini bukan lonjakan satu detik — melainkan penyalahgunaan berjam-jam.
 *
 * Kegagalan Redis **tidak** membuka pintu lebar maupun menutupnya: bila penghitung tidak
 * bisa dibaca, permintaan tetap dilayani (Redis infrastruktur pendukung, bukan sumber
 * kebenaran — SPEC §18). Memilih sebaliknya berarti Redis mati = seluruh layanan mati.
 */

import { Injectable } from '@nestjs/common';
import type { RateLimit } from '../../modules/policy/rate-limits.js';
import { RedisService } from '../redis/redis.service.js';

export interface RateVerdict {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSec: number;
}

@Injectable()
export class RateLimiter {
  constructor(private readonly redis: RedisService) {}

  /**
   * Menghitung satu pemakaian dan memberi putusan. `subject` adalah identitas yang
   * dibatasi — id pengguna, id sesi tamu, atau IP untuk endpoint auth.
   */
  async consume(dimension: string, subject: string, limit: RateLimit): Promise<RateVerdict> {
    const key = `snouty:rl:${dimension}:${subject}`;

    try {
      const used = await this.redis.client.incr(key);
      // EXPIRE hanya pada kenaikan pertama: menyetelnya setiap kali akan memperpanjang
      // jendela selamanya selama permintaan terus datang, sehingga batasnya tak pernah
      // mereset justru bagi penyalahguna yang paling gigih.
      if (used === 1) await this.redis.client.expire(key, limit.windowSeconds);

      if (used > limit.max) {
        const ttl = await this.redis.client.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: ttl > 0 ? ttl : limit.windowSeconds,
        };
      }

      return { allowed: true, remaining: limit.max - used, retryAfterSec: 0 };
    } catch {
      // Redis mati: layani permintaannya. Batas laju melindungi dari penyalahgunaan, bukan
      // dari pemakaian normal — dan menolak semua orang saat cache mati mengubah gangguan
      // kecil menjadi pemadaman.
      return { allowed: true, remaining: limit.max, retryAfterSec: 0 };
    }
  }
}
