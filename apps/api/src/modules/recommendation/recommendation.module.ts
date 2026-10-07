/**
 * Konteks recommendation (docs/ARCHITECTURE.md §6) — Fase 7: pencocokan produk,
 * perakitan solusi, trace, dan empat tahap SSE terakhir.
 *
 * `ProseWriter` kini terikat ke layanan AI, tetapi hanya **bila modelnya ada**: tanpa
 * `OPENROUTER_API_KEY`, `AI_SERVICE` bernilai `null` dan penulis prosa pun `null`,
 * sehingga perakitan memakai templat deterministik. Urutannya tetap sama dalam
 * keadaan apa pun — engine menghitung lebih dulu, prosa hanya menjelaskan — dan prosa
 * yang memuat angka di luar hasil hitungan dibuang oleh REC-1 di perakitan, bukan di
 * sini. Modul ini hanya memutuskan siapa yang menulis.
 */
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AI_SERVICE } from '../ai/domain/ai.port.js';
import { PROSE_SYSTEM_PROMPT } from '../ai/application/prompts.js';
import { loadEnv } from '../../config/env.js';
import { ContextModule } from '../context/context.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module.js';
import { CatalogQueryService } from '../product-catalog/application/catalog-query.service.js';
import { CATALOG_REPOSITORY } from '../product-catalog/domain/catalog.repository.js';
import type { CatalogRepository } from '../product-catalog/domain/catalog.repository.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { AnalysisService } from './application/analysis.service.js';
import type { ProseWriter } from './application/recommendation-assembler.js';
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from './domain/recommendation.repository.js';
import { recommendationRepositoryProvider } from './infrastructure/mysql-recommendation.repository.js';
import {
  LlmProseWriter,
  PROSE_WRITER,
  type ProseCapableAi,
} from './infrastructure/llm-prose-writer.js';
import { RecommendationController } from './presentation/recommendation.controller.js';

const proseWriterProvider = {
  provide: PROSE_WRITER,
  inject: [AI_SERVICE],
  // Prosa solusi oleh model hanya bila diizinkan (LLM_SOLUTION_PROSE): di CPU 70 s per analisis
  // untuk headline/body yang templat deterministiknya sudah ada (diet panggilan model, 2026-10-07).
  useFactory: (ai: ProseCapableAi | null): ProseWriter | null =>
    ai && loadEnv().LLM_SOLUTION_PROSE ? new LlmProseWriter(ai, PROSE_SYSTEM_PROMPT) : null,
};

const analysisServiceProvider = {
  provide: AnalysisService,
  inject: [
    CATALOG_REPOSITORY,
    RECOMMENDATION_REPOSITORY,
    ConversationService,
    PROSE_WRITER,
    CatalogQueryService,
  ],
  useFactory: (
    catalog: CatalogRepository,
    repository: RecommendationRepository,
    conversations: ConversationService,
    prose: ProseWriter | null,
    catalogQuery: CatalogQueryService,
  ) => new AnalysisService(catalog, repository, conversations, prose, catalogQuery),
};

@Module({
  imports: [AiModule, ContextModule, ConversationModule, ProductCatalogModule],
  controllers: [RecommendationController],
  providers: [recommendationRepositoryProvider, proseWriterProvider, analysisServiceProvider],
  exports: [analysisServiceProvider, recommendationRepositoryProvider],
})
export class RecommendationModule {}
