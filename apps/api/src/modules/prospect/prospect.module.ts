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
import { InternalRoleGuard } from '../../shared/http/internal-role.guard.js';
import { ProspectBoardService } from './application/prospect-board.service.js';
import { PROSPECT_STORE, type ProspectStore } from './domain/prospect-board.js';
import { prospectStoreProvider } from './infrastructure/mysql-prospect.store.js';
import { InternalProspectController } from './presentation/internal-prospect.controller.js';
import { InternalLeadController } from './presentation/internal-lead.controller.js';
import { LeadService } from './application/lead.service.js';
import { LeadContextWriter } from './application/lead-context.writer.js';
import { LEAD_STORE, type LeadStore } from './domain/lead.js';
import { leadStoreProvider } from './infrastructure/mysql-lead.store.js';
import { AiModule } from '../ai/ai.module.js';
import { AI_SERVICE, type AiService } from '../ai/domain/ai.port.js';
import { LoggerService } from '../../shared/logging/logger.service.js';

const leadServiceProvider = {
  provide: LeadService,
  inject: [LEAD_STORE, ProspectBoardService, AI_SERVICE, LoggerService],
  useFactory: (
    leads: LeadStore,
    board: ProspectBoardService,
    ai: AiService | null,
    logger: LoggerService,
  ) =>
    new LeadService(leads, board, new LeadContextWriter(ai), logger.child({ module: 'prospect' })),
};

const prospectBoardServiceProvider = {
  provide: ProspectBoardService,
  inject: [PROSPECT_STORE],
  useFactory: (store: ProspectStore) => new ProspectBoardService(store),
};

const salesRequestServiceProvider = {
  provide: SalesRequestService,
  inject: [SALES_REQUEST_REPOSITORY, ConversationService],
  useFactory: (requests: SalesRequestRepository, conversations: ConversationService) =>
    new SalesRequestService(requests, conversations),
};

@Module({
  imports: [ConversationModule, AiModule],
  controllers: [SalesRequestController, InternalProspectController, InternalLeadController],
  providers: [
    salesRequestRepositoryProvider,
    salesRequestServiceProvider,
    prospectStoreProvider,
    prospectBoardServiceProvider,
    leadStoreProvider,
    leadServiceProvider,
    InternalRoleGuard,
  ],
})
export class ProspectModule {}
