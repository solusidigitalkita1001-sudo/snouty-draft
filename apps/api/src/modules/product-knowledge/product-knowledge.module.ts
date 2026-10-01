import { Module } from '@nestjs/common';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module.js';
import { CatalogQueryService } from '../product-catalog/application/catalog-query.service.js';
import { ProductQuestionService } from './application/product-question.service.js';
import {
  UNANSWERED_QUESTION_RECORDER,
  type UnansweredQuestionRecorder,
} from './domain/unanswered-question.port.js';
import { knowledgeRetrieverProvider } from './infrastructure/catalog-document.retriever.js';
import { unansweredQuestionRecorderProvider } from './infrastructure/pino-unanswered-question.recorder.js';

const productQuestionProvider = {
  provide: ProductQuestionService,
  inject: [CatalogQueryService, UNANSWERED_QUESTION_RECORDER],
  useFactory: (catalog: CatalogQueryService, unanswered: UnansweredQuestionRecorder) =>
    new ProductQuestionService(catalog, unanswered),
};

/**
 * Konteks katalog, modul `product-knowledge` (docs/ARCHITECTURE.md §6): lookup
 * terstruktur + orkestrasi retrieval.
 *
 * Belum ada controller, dan itu bukan kelalaian: permukaan tempat tanya jawab ini
 * terlihat pengguna adalah chat, yang baru ada di Fase 3–4. Modul ini mengekspor
 * service-nya supaya pipeline percakapan nanti memanggilnya, bukan membangun ulang
 * logikanya di dalam prompt.
 *
 * Seluruh data katalog dibaca lewat `ProductCatalogModule`. Tidak ada impor MySQL di
 * modul ini, dan pagar lint menegakkannya.
 */
@Module({
  imports: [ProductCatalogModule],
  providers: [
    knowledgeRetrieverProvider,
    unansweredQuestionRecorderProvider,
    productQuestionProvider,
  ],
  exports: [productQuestionProvider, knowledgeRetrieverProvider],
})
export class ProductKnowledgeModule {}
