/**
 * Konteks recommendation (docs/ARCHITECTURE.md §6) — Fase 7: pencocokan produk,
 * perakitan solusi, trace, dan empat tahap SSE terakhir.
 *
 * `ProseWriter` sengaja belum terikat ke LLM: perakitan memakai templat deterministik
 * selama penulis prosa bernilai `null`, dan itu jalur yang selalu lulus REC-1.
 * Menyambungkannya ke `ai` menyusul bersama prompt penjelas (bagian Fase 7 lanjutan).
 */
import { Module } from '@nestjs/common';
import { ContextModule } from '../context/context.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module.js';
import { CATALOG_REPOSITORY } from '../product-catalog/domain/catalog.repository.js';
import type { CatalogRepository } from '../product-catalog/domain/catalog.repository.js';
import { AnalysisService } from './application/analysis.service.js';
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from './domain/recommendation.repository.js';
import { recommendationRepositoryProvider } from './infrastructure/mysql-recommendation.repository.js';
import { RecommendationController } from './presentation/recommendation.controller.js';

const analysisServiceProvider = {
  provide: AnalysisService,
  inject: [CATALOG_REPOSITORY, RECOMMENDATION_REPOSITORY],
  useFactory: (catalog: CatalogRepository, repository: RecommendationRepository) =>
    new AnalysisService(catalog, repository, null),
};

@Module({
  imports: [ContextModule, ConversationModule, ProductCatalogModule],
  controllers: [RecommendationController],
  providers: [recommendationRepositoryProvider, analysisServiceProvider],
  exports: [analysisServiceProvider],
})
export class RecommendationModule {}
