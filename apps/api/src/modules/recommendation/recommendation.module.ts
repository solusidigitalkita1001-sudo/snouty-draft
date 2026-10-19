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
import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AI_SERVICE } from '../ai/domain/ai.port.js';
import { PROSE_SYSTEM_PROMPT } from '../ai/application/prompts.js';
import { loadEnv } from '../../config/env.js';
import { ContextModule } from '../context/context.module.js';
import { ActiveSolutionRegistry } from '../context/domain/active-solution.port.js';
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
import { ShareController } from './presentation/share.controller.js';
import { ShareService } from './application/share.service.js';
import { SHARE_LINK_REPOSITORY, type ShareLinkRepository } from './domain/share-link.repository.js';
import { shareLinkRepositoryProvider } from './infrastructure/mysql-share-link.repository.js';
import { RequirementSnapshotStore } from '../context/application/requirement-snapshot.store.js';
import { RateLimiter } from '../../shared/rate-limit/rate-limiter.js';
import { RedisService } from '../../shared/redis/redis.service.js';

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

/** Tautan bagikan baca-saja (P24-03). */
const shareServiceProvider = {
  provide: ShareService,
  inject: [
    SHARE_LINK_REPOSITORY,
    RECOMMENDATION_REPOSITORY,
    ConversationService,
    RequirementSnapshotStore,
    AnalysisService,
  ],
  useFactory: (
    links: ShareLinkRepository,
    recommendations: RecommendationRepository,
    conversations: ConversationService,
    snapshots: RequirementSnapshotStore,
    analysis: AnalysisService,
  ) => new ShareService(links, recommendations, conversations, snapshots, analysis),
};

const rateLimiterProvider = {
  provide: RateLimiter,
  inject: [RedisService],
  useFactory: (redis: RedisService) => new RateLimiter(redis),
};

@Module({
  imports: [AiModule, ContextModule, ConversationModule, ProductCatalogModule],
  controllers: [RecommendationController, ShareController],
  providers: [
    recommendationRepositoryProvider,
    proseWriterProvider,
    analysisServiceProvider,
    shareLinkRepositoryProvider,
    shareServiceProvider,
    rateLimiterProvider,
  ],
  exports: [analysisServiceProvider, recommendationRepositoryProvider],
})
export class RecommendationModule implements OnModuleInit {
  constructor(
    private readonly registry: ActiveSolutionRegistry,
    @Inject(RECOMMENDATION_REPOSITORY) private readonly repository: RecommendationRepository,
  ) {}

  /** Jawaban chat tentang solusi aktif (P22-04) membaca rekomendasi terakhir lewat port context. */
  onModuleInit(): void {
    this.registry.bind({
      latestFor: (conversationId) => this.repository.findLatestForConversation(conversationId),
    });
  }
}
