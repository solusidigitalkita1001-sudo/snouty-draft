import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ProductCatalogModule } from './modules/product-catalog/product-catalog.module.js';

/**
 * Modul domain menyusul fase demi fase (docs/ARCHITECTURE.md §6).
 * `ProductCatalogModule` belum punya controller — API baca katalog adalah P1-08 —
 * tetapi sudah didaftarkan supaya kesalahan wiring DI muncul saat boot, bukan nanti.
 */
@Module({
  imports: [DatabaseModule, HealthModule, ProductCatalogModule],
})
export class AppModule {}
