import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { CorrelationIdMiddleware } from './shared/http/correlation-id.middleware.js';
import { LoggingModule } from './shared/logging/logging.module.js';
import { RedisModule } from './shared/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ProductCatalogModule } from './modules/product-catalog/product-catalog.module.js';
import { ProductKnowledgeModule } from './modules/product-knowledge/product-knowledge.module.js';

/**
 * Modul domain menyusul fase demi fase (docs/ARCHITECTURE.md §6).
 *
 * `DatabaseModule` dan `RedisModule` global: satu pool dan satu klien per proses,
 * dibuat di satu tempat dan di-inject — tidak ada modul yang membuka koneksinya
 * sendiri (docs/DATABASE.md §7).
 */
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    LoggingModule,
    HealthModule,
    AuthModule,
    ProductCatalogModule,
    ProductKnowledgeModule,
  ],
})
export class AppModule implements NestModule {
  /** Correlation ID berlaku untuk SELURUH rute, termasuk `/health`. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
