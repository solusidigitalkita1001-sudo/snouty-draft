import { Module } from '@nestjs/common';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module.js';
import { CatalogQueryService } from '../product-catalog/application/catalog-query.service.js';
import { CompanyKnowledgeService } from './application/company-knowledge.service.js';

const companyKnowledgeProvider = {
  provide: CompanyKnowledgeService,
  inject: [CatalogQueryService],
  useFactory: (catalog: CatalogQueryService) => new CompanyKnowledgeService(catalog),
};

/**
 * Pengetahuan PERUSAHAAN (Fase 16) — terpisah dari `product-knowledge`: profil, fokus bisnis,
 * ragam produk sebagai ringkasan, kontak. Pertanyaan tentang Pralon sebagai perusahaan tidak
 * pernah lewat pencarian produk, dan sebaliknya. Katalog dibaca lewat port `product-catalog`.
 */
@Module({
  imports: [ProductCatalogModule],
  providers: [companyKnowledgeProvider],
  exports: [companyKnowledgeProvider],
})
export class CompanyKnowledgeModule {}
