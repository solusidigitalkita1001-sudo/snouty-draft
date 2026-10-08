/**
 * Antrean handoff teknis — Fase 8; pengiriman ke tim teknis lewat worker + n8n (P10-06, OQ-08).
 */
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { LoggerService } from '../../shared/logging/logger.service.js';
import { InternalRoleGuard } from '../../shared/http/internal-role.guard.js';
import { JobPublisher } from '../../shared/queue/job-publisher.js';
import { ContextModule } from '../context/context.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { RequirementSnapshotStore } from '../context/application/requirement-snapshot.store.js';
import {
  WORKER_INTERNAL_TOKEN,
  WorkerTokenMiddleware,
} from '../../shared/http/worker-token.middleware.js';
import { HandoffService } from './application/handoff.service.js';
import { HANDOFF_REPOSITORY, type HandoffRepository } from './domain/handoff.repository.js';
import { handoffRepositoryProvider } from './infrastructure/mysql-handoff.repository.js';
import { HandoffController } from './presentation/handoff.controller.js';
import { InternalHandoffController } from './presentation/internal-handoff.controller.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { UploadsService } from '../uploads/application/uploads.service.js';

const jobPublisherProvider = {
  provide: JobPublisher,
  inject: [LoggerService],
  useFactory: (logger: LoggerService) => new JobPublisher(logger),
};

const workerTokenProvider = {
  provide: WORKER_INTERNAL_TOKEN,
  useFactory: () => loadEnv().WORKER_INTERNAL_TOKEN,
};

const handoffServiceProvider = {
  provide: HandoffService,
  inject: [
    HANDOFF_REPOSITORY,
    ConversationService,
    RequirementSnapshotStore,
    UploadsService,
    JobPublisher,
    LoggerService,
  ],
  useFactory: (
    handoffs: HandoffRepository,
    conversations: ConversationService,
    snapshots: RequirementSnapshotStore,
    uploads: UploadsService,
    publisher: JobPublisher,
    logger: LoggerService,
  ) =>
    new HandoffService(
      handoffs,
      conversations,
      snapshots,
      uploads,
      publisher,
      logger.child({ module: 'handoff' }),
    ),
};

@Module({
  imports: [ContextModule, ConversationModule, UploadsModule],
  controllers: [HandoffController, InternalHandoffController],
  providers: [
    handoffRepositoryProvider,
    handoffServiceProvider,
    jobPublisherProvider,
    workerTokenProvider,
    InternalRoleGuard,
  ],
  exports: [handoffServiceProvider],
})
export class HandoffModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Token worker hanya membuka rute isi email handoff di modul ini (OQ-49).
    consumer.apply(WorkerTokenMiddleware).forRoutes(InternalHandoffController);
  }
}
