import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { CorrelationIdMiddleware } from './shared/http/correlation-id.middleware.js';
import { LoggingModule } from './shared/logging/logging.module.js';
import { RedisModule } from './shared/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AccessTokenMiddleware } from './modules/auth/presentation/access-token.middleware.js';
import { GuestSessionMiddleware } from './modules/auth/presentation/guest-session.middleware.js';
import { ConversationModule } from './modules/conversation/conversation.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OnboardingConsentModule } from './modules/onboarding-consent/onboarding-consent.module.js';
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
    OnboardingConsentModule,
    ConversationModule,
    ProductCatalogModule,
    ProductKnowledgeModule,
  ],
})
export class AppModule implements NestModule {
  /** Correlation ID berlaku untuk SELURUH rute, termasuk `/health`. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');

    // Aktor diisi dari Bearer token di SEMUA rute API — termasuk /internal, yang
    // guard-nya justru menunggu isian ini. Tidak pernah menolak; hanya mengisi.
    consumer.apply(AccessTokenMiddleware).exclude('health').forRoutes('{*rest}');

    // Sesi tamu hanya pada rute publik: /health dipanggil pemeriksa infrastruktur
    // tiap beberapa detik (satu sesi per panggilan = ribuan baris sehari), dan
    // /internal memakai autentikasi akun, bukan sesi tamu.
    //
    // Polanya RELATIF terhadap prefix global: Nest menambahkan `api/v1` di depan
    // pola middleware, jadi menuliskan `api/v1/...` di sini menghasilkan
    // `/api/v1/api/v1/...` yang tidak pernah cocok — dan middleware yang tidak
    // pernah berjalan, tanpa satu pun galat. Ketahuan lewat probe terhadap
    // aplikasi yang berjalan, bukan lewat tes unit: tes unit memanggil `use()`
    // langsung dan tidak pernah menyentuh pencocokan rute.
    consumer
      .apply(GuestSessionMiddleware)
      .exclude('health', 'internal/{*rest}')
      .forRoutes('{*rest}');
  }
}
