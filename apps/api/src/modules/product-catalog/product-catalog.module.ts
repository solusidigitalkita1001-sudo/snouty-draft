import { Module } from '@nestjs/common';
import { CatalogIngestService } from './application/catalog-ingest.service.js';
import { CatalogPromotionService } from './application/catalog-promotion.service.js';
import { CATALOG_CACHE, type CatalogCache } from './domain/catalog-cache.port.js';
import { CATALOG_REPOSITORY, type CatalogRepository } from './domain/catalog.repository.js';
import { CATALOG_WRITER, type CatalogWriter } from './domain/catalog-writer.repository.js';
import { catalogRepositoryProvider } from './infrastructure/catalog.mysql.repository.js';
import { catalogWriterProvider } from './infrastructure/catalog.mysql.writer.js';
import { catalogCacheProvider } from './infrastructure/catalog.redis.cache.js';

/** Service-nya hanya bergantung pada port tulis, bukan pada MySQL. */
const catalogIngestProvider = {
  provide: CatalogIngestService,
  inject: [CATALOG_WRITER],
  useFactory: (writer: CatalogWriter) => new CatalogIngestService(writer),
};

const catalogPromotionProvider = {
  provide: CatalogPromotionService,
  inject: [CATALOG_REPOSITORY, CATALOG_WRITER, CATALOG_CACHE],
  useFactory: (versions: CatalogRepository, writer: CatalogWriter, cache: CatalogCache) =>
    new CatalogPromotionService(versions, writer, cache),
};

/**
 * Konteks katalog produk (docs/ARCHITECTURE.md §6).
 *
 * Belum ada controller: API baca katalog adalah P1-08. Yang diekspor adalah
 * port-nya, bukan implementasinya, supaya modul lain (`recommendation`,
 * `material-estimator`, `report`) tidak pernah bergantung pada MySQL langsung.
 */
@Module({
  providers: [
    catalogRepositoryProvider,
    catalogWriterProvider,
    catalogCacheProvider,
    catalogIngestProvider,
    catalogPromotionProvider,
  ],
  exports: [catalogRepositoryProvider, catalogIngestProvider, catalogPromotionProvider],
})
export class ProductCatalogModule {}
