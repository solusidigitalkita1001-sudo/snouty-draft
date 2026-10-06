/**
 * Konteks Context Engine (docs/ARCHITECTURE.md §6) — Fase 4. Snapshot kebutuhan,
 * routing intent, pipeline pesan + SSE.
 *
 * Mengimpor `AiModule` (digerbang kunci) dan `ConversationModule` (persistensi
 * percakapan & pesan). `ai` adalah layanan, bukan pengambil keputusan: keputusan
 * atas hasilnya hidup di sini.
 */
import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { RateLimiter } from '../../shared/rate-limit/rate-limiter.js';
import { RedisService } from '../../shared/redis/redis.service.js';
import { AiModule } from '../ai/ai.module.js';
import { AI_SERVICE, type AiService } from '../ai/domain/ai.port.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module.js';
import { CatalogQueryService } from '../product-catalog/application/catalog-query.service.js';
import { ProductKnowledgeModule } from '../product-knowledge/product-knowledge.module.js';
import { ProductQuestionService } from '../product-knowledge/application/product-question.service.js';
import { REPLY_SYSTEM_PROMPT } from '../ai/application/prompts.js';
import { IntentRouter } from './application/intent-router.js';
import { ReplyWriter } from './application/reply-writer.js';
import { MessageService } from './application/message.service.js';
import { RequirementSnapshotStore } from './application/requirement-snapshot.store.js';
import {
  REQUIREMENT_SNAPSHOT_REPOSITORY,
  type RequirementSnapshotRepository,
} from './domain/requirement-snapshot.repository.js';
import { requirementSnapshotRepositoryProvider } from './infrastructure/mysql-requirement-snapshot.repository.js';
import { MessageController } from './presentation/message.controller.js';

const rateLimiterProvider = {
  provide: RateLimiter,
  inject: [RedisService],
  useFactory: (redis: RedisService) => new RateLimiter(redis),
};

const storeProvider = {
  provide: RequirementSnapshotStore,
  inject: [REQUIREMENT_SNAPSHOT_REPOSITORY, RedisService],
  useFactory: (repository: RequirementSnapshotRepository, redis: RedisService) =>
    new RequirementSnapshotStore(repository, redis),
};

const intentRouterProvider = {
  provide: IntentRouter,
  inject: [AI_SERVICE],
  useFactory: (ai: AiService) => new IntentRouter(ai),
};

/** Balasan percakapan ditulis model bila ada; tanpa model tetap ada teks tetapnya. */
const replyWriterProvider = {
  provide: ReplyWriter,
  inject: [AI_SERVICE],
  useFactory: (ai: AiService | null): ReplyWriter | null =>
    ai ? new ReplyWriter(ai, REPLY_SYSTEM_PROMPT, loadEnv().LLM_REPLY_TIMEOUT_MS) : null,
};

const messageServiceProvider = {
  provide: MessageService,
  inject: [
    ConversationService,
    RequirementSnapshotStore,
    IntentRouter,
    CatalogQueryService,
    ProductQuestionService,
    ReplyWriter,
    AI_SERVICE,
  ],
  useFactory: (
    conversations: ConversationService,
    store: RequirementSnapshotStore,
    router: IntentRouter,
    catalog: CatalogQueryService,
    productQuestions: ProductQuestionService,
    reply: ReplyWriter | null,
    ai: AiService | null,
  ) => new MessageService(conversations, store, router, catalog, productQuestions, reply, ai),
};

@Module({
  // Katalog + pengetahuan produk: ruas PRODUCT_LOOKUP menjawab dari keduanya, nol LLM.
  imports: [AiModule, ConversationModule, ProductCatalogModule, ProductKnowledgeModule],
  controllers: [MessageController],
  providers: [
    rateLimiterProvider,
    requirementSnapshotRepositoryProvider,
    storeProvider,
    intentRouterProvider,
    replyWriterProvider,
    messageServiceProvider,
  ],
  exports: [RequirementSnapshotStore],
})
export class ContextModule {}
