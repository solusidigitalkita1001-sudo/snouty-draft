/**
 * Prospek 5A dan tindak lanjut sales (Fase 26, docs/PROSPECT_5A.md). Tidak diimpor rekomendasi,
 * engineering, atau context (pagar lint): skor prospek tidak pernah memengaruhi rekomendasi.
 */
import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { SalesRequestService } from './application/sales-request.service.js';
import {
  SALES_REQUEST_REPOSITORY,
  type SalesRequestRepository,
} from './domain/sales-request.repository.js';
import { salesRequestRepositoryProvider } from './infrastructure/mysql-sales-request.repository.js';
import { SalesRequestController } from './presentation/sales-request.controller.js';

const salesRequestServiceProvider = {
  provide: SalesRequestService,
  inject: [SALES_REQUEST_REPOSITORY, ConversationService],
  useFactory: (requests: SalesRequestRepository, conversations: ConversationService) =>
    new SalesRequestService(requests, conversations),
};

@Module({
  imports: [ConversationModule],
  controllers: [SalesRequestController],
  providers: [salesRequestRepositoryProvider, salesRequestServiceProvider],
})
export class ProspectModule {}
