import { Module } from '@nestjs/common';
import { InternalRoleGuard } from '../../shared/http/internal-role.guard.js';
import { CatalogAdminService } from './application/catalog-admin.service.js';
import { CatalogIngestService } from './application/catalog-ingest.service.js';
import { CatalogPromotionService } from './application/catalog-promotion.service.js';
import { CatalogQueryService } from './application/catalog-query.service.js';
import { CATALOG_CACHE, type CatalogCache } from './domain/catalog-cache.port.js';
import { CATALOG_REPOSITORY, type CatalogRepository } from './domain/catalog.repository.js';
import { CATALOG_WRITER, type CatalogWriter } from './domain/catalog-writer.repository.js';
import { catalogRepositoryProvider } from './infrastructure/catalog.mysql.repository.js';
import { catalogWriterProvider } from './infrastructure/catalog.mysql.writer.js';
import { catalogCacheProvider } from './infrastructure/catalog.redis.cache.js';
import { CatalogController } from './presentation/catalog.controller.js';
import { InternalCatalogController } from './presentation/internal-catalog.controller.js';

/** Service-nya hanya bergantung pada port tulis, bukan pada MySQL. */
const catalogIngestProvider = {
  provide: CatalogIngestService,
  inject: [CATALOG_WRITER],
  useFactory: (writer: CatalogWriter) => new CatalogIngestService(writer),
};

const catalogQueryProvider = {
  provide: CatalogQueryService,
  inject: [CATALOG_REPOSITORY, CATALOG_CACHE],
  useFactory: (repository: CatalogRepository, cache: CatalogCache) =>
    new CatalogQueryService(repository, cache),
};

const catalogAdminProvider = {
  provide: CatalogAdminService,
  inject: [CATALOG_REPOSITORY, CATALOG_WRITER],
  useFactory: (repository: CatalogRepository, writer: CatalogWriter) =>
    new CatalogAdminService(repository, writer),
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
 * Dua controller: `CatalogController` untuk pembacaan publik (layar 10), dan
 * `InternalCatalogController` untuk back-office berperan `catalog_admin`.
 *
 * Yang diekspor adalah port dan use case-nya, bukan implementasinya, supaya modul
 * lain (`recommendation`, `material-estimator`, `report`) tidak pernah bergantung
 * pada MySQL langsung. `CATALOG_WRITER` sengaja **tidak** diekspor: hanya modul ini
 * yang boleh menulis katalog.
 */
@Module({
  controllers: [CatalogController, InternalCatalogController],
  providers: [
    catalogRepositoryProvider,
    catalogWriterProvider,
    catalogCacheProvider,
    catalogQueryProvider,
    catalogAdminProvider,
    catalogIngestProvider,
    catalogPromotionProvider,
    InternalRoleGuard,
  ],
  exports: [
    catalogRepositoryProvider,
    catalogQueryProvider,
    catalogAdminProvider,
    catalogIngestProvider,
    catalogPromotionProvider,
  ],
})
export class ProductCatalogModule {}
