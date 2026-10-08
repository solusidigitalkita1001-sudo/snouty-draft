/**
 * Modul laporan — Fase 8. Perakitan dari data tersimpan, alokasi nomor, halaman cetak.
 *
 * Pembuatan PDF-nya (Chromium di `apps/worker`) terhalang **OQ-40**. Sampai itu
 * terjawab, laporan tetap berguna: pratinjau di layar adalah alur yang dipilih desain,
 * dan halaman cetaknya sudah final sehingga yang tersisa untuk worker hanyalah "buka
 * halaman ini, cetak".
 */
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { ContextModule } from '../context/context.module.js';
import { ConversationModule } from '../conversation/conversation.module.js';
import { ConversationService } from '../conversation/application/conversation.service.js';
import { RequirementSnapshotStore } from '../context/application/requirement-snapshot.store.js';
import { RecommendationModule } from '../recommendation/recommendation.module.js';
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '../recommendation/domain/recommendation.repository.js';
import { ReportService } from './application/report.service.js';
import { REPORT_REPOSITORY, type ReportRepository } from './domain/report.repository.js';
import { reportRepositoryProvider } from './infrastructure/mysql-report.repository.js';
import { InternalRoleGuard } from '../../shared/http/internal-role.guard.js';
import { JobPublisher } from '../../shared/queue/job-publisher.js';
import { LoggerService } from '../../shared/logging/logger.service.js';
import { InternalReportController } from './presentation/internal-report.controller.js';
import { ReportController } from './presentation/report.controller.js';
import {
  WORKER_INTERNAL_TOKEN,
  WorkerTokenMiddleware,
} from '../../shared/http/worker-token.middleware.js';

const workerTokenProvider = {
  provide: WORKER_INTERNAL_TOKEN,
  useFactory: () => loadEnv().WORKER_INTERNAL_TOKEN,
};

const jobPublisherProvider = {
  provide: JobPublisher,
  inject: [LoggerService],
  useFactory: (logger: LoggerService) => new JobPublisher(logger),
};

const reportServiceProvider = {
  provide: ReportService,
  inject: [
    REPORT_REPOSITORY,
    RECOMMENDATION_REPOSITORY,
    ConversationService,
    RequirementSnapshotStore,
    JobPublisher,
  ],
  useFactory: (
    reports: ReportRepository,
    recommendations: RecommendationRepository,
    conversations: ConversationService,
    snapshots: RequirementSnapshotStore,
    publisher: JobPublisher,
  ) => new ReportService(reports, recommendations, conversations, snapshots, publisher),
};

@Module({
  imports: [ContextModule, ConversationModule, RecommendationModule],
  controllers: [ReportController, InternalReportController],
  providers: [
    jobPublisherProvider,
    reportRepositoryProvider,
    reportServiceProvider,
    InternalRoleGuard,
    workerTokenProvider,
  ],
  exports: [reportServiceProvider],
})
export class ReportModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Hanya controller internal laporan: token worker tidak membuka rute internal lain (OQ-49).
    consumer.apply(WorkerTokenMiddleware).forRoutes(InternalReportController);
  }
}
