import { Module } from '@nestjs/common';
import { catalogRepositoryProvider } from './infrastructure/catalog.mysql.repository.js';

/**
 * Konteks katalog produk (docs/ARCHITECTURE.md §6).
 *
 * Belum ada controller: API baca katalog adalah P1-08. Yang diekspor adalah
 * port-nya, bukan implementasinya, supaya modul lain (`recommendation`,
 * `material-estimator`, `report`) tidak pernah bergantung pada MySQL langsung.
 */
@Module({
  providers: [catalogRepositoryProvider],
  exports: [catalogRepositoryProvider],
})
export class ProductCatalogModule {}
