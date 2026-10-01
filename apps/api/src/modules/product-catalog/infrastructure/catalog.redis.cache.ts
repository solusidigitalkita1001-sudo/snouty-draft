import { Injectable } from '@nestjs/common';
import { RedisService, type RedisCommands } from '../../../shared/redis/redis.service.js';
import {
  CATALOG_ACTIVE_VERSION_KEY,
  CATALOG_CACHE,
  CATALOG_CACHE_TTL_SECONDS,
  CATALOG_PRODUCT_KEY_PREFIX,
  type CatalogCache,
} from '../domain/catalog-cache.port.js';

/**
 * Satu putaran SCAN mengambil sampai 500 kunci. Cukup besar untuk tidak
 * berputar-putar pada katalog ratusan produk, cukup kecil untuk tidak menahan
 * Redis dalam satu perintah panjang.
 */
const SCAN_BATCH = 500;

@Injectable()
export class RedisCatalogCache implements CatalogCache {
  constructor(private readonly redis: RedisCommands) {}

  /**
   * Adapter ini sengaja TIDAK menelan galat Redis.
   *
   * Keputusan "lanjutkan tanpa cache" adalah keputusan lapisan application, dan
   * di sana ia bisa diuji. Kalau ditelan di sini, Redis yang mati akan terlihat
   * sebagai cache yang selalu kosong — tenang di log, dan mustahil disadari.
   */
  async read<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async write(key: string, value: unknown): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', CATALOG_CACHE_TTL_SECONDS);
  }

  async invalidateAll(): Promise<number> {
    let removed = await this.redis.del(CATALOG_ACTIVE_VERSION_KEY);

    // SCAN, bukan KEYS. Redis mengerjakan perintah satu per satu di satu utas, dan
    // `KEYS snouty:cache:product:*` memindai SELURUH keyspace dalam satu perintah
    // yang tidak bisa diselak — pada instans yang juga memegang sesi dan rate limit,
    // itu berarti seluruh aplikasi menunggu. SCAN memindai sedikit-sedikit.
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${CATALOG_PRODUCT_KEY_PREFIX}*`,
        'COUNT',
        SCAN_BATCH,
      );
      cursor = next;
      if (keys.length > 0) removed += await this.redis.del(...keys);
    } while (cursor !== '0');

    return removed;
  }
}

export const catalogCacheProvider = {
  provide: CATALOG_CACHE,
  inject: [RedisService],
  useFactory: (redis: RedisService): CatalogCache => new RedisCatalogCache(redis.client),
};
