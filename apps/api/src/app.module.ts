import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { CorrelationIdMiddleware } from './shared/http/correlation-id.middleware.js';
import { RedisModule } from './shared/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ProductCatalogModule } from './modules/product-catalog/product-catalog.module.js';

/**
 * Modul domain menyusul fase demi fase (docs/ARCHITECTURE.md §6).
 *
 * `DatabaseModule` dan `RedisModule` global: satu pool dan satu klien per proses,
 * dibuat di satu tempat dan di-inject — tidak ada modul yang membuka koneksinya
 * sendiri (docs/DATABASE.md §7).
 */
@Module({
  imports: [DatabaseModule, RedisModule, HealthModule, ProductCatalogModule],
})
export class AppModule implements NestModule {
  /** Correlation ID berlaku untuk SELURUH rute, termasuk `/health`. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
