import { Module } from '@nestjs/common';
import { CatalogIngestService } from './application/catalog-ingest.service.js';
import { CATALOG_WRITER, type CatalogWriter } from './domain/catalog-writer.repository.js';
import { catalogRepositoryProvider } from './infrastructure/catalog.mysql.repository.js';
import { catalogWriterProvider } from './infrastructure/catalog.mysql.writer.js';

/** Service-nya hanya bergantung pada port tulis, bukan pada MySQL. */
const catalogIngestProvider = {
  provide: CatalogIngestService,
  inject: [CATALOG_WRITER],
  useFactory: (writer: CatalogWriter) => new CatalogIngestService(writer),
};

/**
 * Konteks katalog produk (docs/ARCHITECTURE.md §6).
 *
 * Belum ada controller: API baca katalog adalah P1-08. Yang diekspor adalah
 * port-nya, bukan implementasinya, supaya modul lain (`recommendation`,
 * `material-estimator`, `report`) tidak pernah bergantung pada MySQL langsung.
 */
@Module({
  providers: [catalogRepositoryProvider, catalogWriterProvider, catalogIngestProvider],
  exports: [catalogRepositoryProvider, catalogIngestProvider],
})
export class ProductCatalogModule {}
