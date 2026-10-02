/**
 * Modul laporan — Fase 8. Perakitan dari data tersimpan, alokasi nomor, halaman cetak.
 *
 * Pembuatan PDF-nya (Chromium di `apps/worker`) terhalang **OQ-40**. Sampai itu
 * terjawab, laporan tetap berguna: pratinjau di layar adalah alur yang dipilih desain,
 * dan halaman cetaknya sudah final sehingga yang tersisa untuk worker hanyalah "buka
 * halaman ini, cetak".
 */
import { Module } from '@nestjs/common';
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
import { InternalReportController } from './presentation/internal-report.controller.js';
import { ReportController } from './presentation/report.controller.js';

const reportServiceProvider = {
  provide: ReportService,
  inject: [
    REPORT_REPOSITORY,
    RECOMMENDATION_REPOSITORY,
    ConversationService,
    RequirementSnapshotStore,
  ],
  useFactory: (
    reports: ReportRepository,
    recommendations: RecommendationRepository,
    conversations: ConversationService,
    snapshots: RequirementSnapshotStore,
  ) => new ReportService(reports, recommendations, conversations, snapshots),
};

@Module({
  imports: [ContextModule, ConversationModule, RecommendationModule],
  controllers: [ReportController, InternalReportController],
  providers: [reportRepositoryProvider, reportServiceProvider, InternalRoleGuard],
  exports: [reportServiceProvider],
})
export class ReportModule {}
