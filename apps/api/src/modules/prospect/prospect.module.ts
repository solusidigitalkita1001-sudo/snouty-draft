/**
 * Prospek 5A dan tindak lanjut sales (Fase 26, docs/PROSPECT_5A.md). Tidak diimpor rekomendasi,
 * engineering, atau context (pagar lint): skor prospek tidak pernah memengaruhi rekomendasi.
 */
import { Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
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
import { NOTIFIER, type Notifier } from '../../shared/notification/notifier.port.js';
import { NotificationService } from '../notification/application/notification.service.js';

/**
 * Jadwal tengok disimpan per tanggal, bukan per jam (P27-09), jadi sapuan seperempat jam sudah
 * jauh lebih halus daripada ketelitian datanya — dan cukup sering agar pengingat pagi tidak
 * sampai siang baru berbunyi.
 */
const FOLLOW_UP_SWEEP_MS = 15 * 60_000;

const leadServiceProvider = {
  provide: LeadService,
  inject: [LEAD_STORE, ProspectBoardService, AI_SERVICE, NOTIFIER, LoggerService],
  useFactory: (
    leads: LeadStore,
    board: ProspectBoardService,
    ai: AiService | null,
    notifier: Notifier,
    logger: LoggerService,
  ) =>
    new LeadService(
      leads,
      board,
      new LeadContextWriter(ai),
      notifier,
      logger.child({ module: 'prospect' }),
    ),
};

const prospectBoardServiceProvider = {
  provide: ProspectBoardService,
  inject: [PROSPECT_STORE, NOTIFIER],
  useFactory: (store: ProspectStore, notifier: Notifier) =>
    new ProspectBoardService(store, notifier),
};

const salesRequestServiceProvider = {
  provide: SalesRequestService,
  inject: [SALES_REQUEST_REPOSITORY, ConversationService, NotificationService],
  useFactory: (
    requests: SalesRequestRepository,
    conversations: ConversationService,
    notifications: NotificationService,
  ) => new SalesRequestService(requests, conversations, (event) => notifications.notifyTeam(event)),
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
export class ProspectModule implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly leads: LeadService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const log = this.logger.child({ module: 'prospect' });
    const sweep = () =>
      void this.leads
        .remindDueFollowUps()
        .then((n) => n > 0 && log.info({ sent: n }, 'pengingat tindak lanjut dikirim'))
        .catch((err: unknown) => log.warn({ err }, 'sapuan pengingat gagal'));
    sweep();
    this.timer = setInterval(sweep, FOLLOW_UP_SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
