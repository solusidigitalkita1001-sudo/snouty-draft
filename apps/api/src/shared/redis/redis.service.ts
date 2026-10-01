import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadEnv } from '../../config/env.js';

/**
 * Operasi Redis yang benar-benar dipakai modul.
 *
 * Interface sempit, bukan klien ioredis utuh, karena itu yang membuat adapter
 * cache bisa diuji tanpa Redis — dan karena modul yang hanya perlu menghapus
 * kunci tidak perlu memegang `FLUSHALL`.
 */
export interface RedisCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryToken: 'EX', seconds: number): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: string,
    matchToken: 'MATCH',
    pattern: string,
    countToken: 'COUNT',
    count: number,
  ): Promise<[string, string[]]>;
}

/**
 * Satu klien per proses, dibuat di satu tempat dan di-inject — pola yang sama
 * dengan `DatabaseService`.
 *
 * Redis **tidak pernah menjadi sumber kebenaran** (SPEC §18). Kehilangan seluruh
 * isinya berarti kehilangan kecepatan, bukan data; karena itu kegagalan Redis
 * tidak boleh menjatuhkan permintaan yang sebenarnya masih bisa dilayani MySQL.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const env = loadEnv();
    this.client = new Redis(env.REDIS_URL, {
      // Dua percobaan, lalu menyerah: Redis adalah cache, dan menunggu lama pada
      // cache yang mati mengubah hilangnya kecepatan menjadi hilangnya layanan.
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
