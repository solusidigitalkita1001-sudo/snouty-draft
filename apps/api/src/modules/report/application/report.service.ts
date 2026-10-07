/**
 * ReportService — membuat laporan dari rekomendasi yang tersimpan.
 * docs/REPORT.md. **Tidak pernah memanggil LLM** (prinsip §1).
 *
 * Nomor dialokasikan **sebelum** payload dibekukan dan sebelum PDF dibuat: nomor yang
 * sudah tampil di UI harus tetap sama meski pembuatan PDF gagal lalu diulang, dan
 * laporan gagal tidak melepas nomornya.
 *
 * Kepemilikan diperiksa di lapisan ini, bukan hanya lewat `WHERE` di repository
 * (docs/SECURITY.md §4 · invarian RP-2): laporan memuat nama pelanggan dan lokasi
 * proyek, jadi kontrol aksesnya kewajiban UU PDP — bukan kerapian.
 */

import { Inject, Injectable } from '@nestjs/common';
import { QUEUES } from '@snouty/jobs';
import type { RequirementState } from '@snouty/shared-types';
import { loadEnv } from '../../../config/env.js';
import { ulid } from '../../../shared/ulid.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '../../recommendation/domain/recommendation.repository.js';
import { RequirementSnapshotStore } from '../../context/application/requirement-snapshot.store.js';
import { requirementValueLabel } from '../../context/domain/requirement-labels.js';
import { assembleReportPayload } from './report-assembler.js';
import { reportDownloadName, resolveReportFile } from '../domain/report-file.js';
import { formatReportNumber, yearMonthOf } from '../domain/report-number.js';
import { REPORT_REPOSITORY, type ReportRepository } from '../domain/report.repository.js';
import { JobPublisher } from '../../../shared/queue/job-publisher.js';
import type { Report, ReportIdentity } from '../domain/report.types.js';

/**
 * Identitas yang diisi pengguna. Jenis instalasi diisi service, bukan controller: labelnya
 * mengikuti bahasa percakapan, yang baru diketahui setelah percakapannya dibaca.
 */
export type ReportIdentityInput = Omit<ReportIdentity, 'installationType'>;

export class RecommendationNotFoundError extends Error {
  constructor() {
    super('rekomendasi tidak ditemukan');
    this.name = 'RecommendationNotFoundError';
  }
}

export class ReportPdfNotReadyError extends Error {
  readonly code = 'NOT_FOUND' as const;

  constructor() {
    super('PDF laporan belum siap. Coba lagi beberapa saat lagi.');
    this.name = 'ReportPdfNotReadyError';
  }
}

export class ReportPdfFailedError extends Error {
  readonly code = 'REPORT_GENERATION_FAILED' as const;

  constructor() {
    super('PDF laporan gagal dibuat. Pratinjau di layar tetap bisa dipakai.');
    this.name = 'ReportPdfFailedError';
  }
}

export class ReportStorageUnavailableError extends Error {
  readonly code = 'SERVICE_UNAVAILABLE' as const;

  constructor() {
    super('Penyimpanan laporan belum dikonfigurasi.');
    this.name = 'ReportStorageUnavailableError';
  }
}

export class ReportNotFoundError extends Error {
  // Tanpa kode ini filter memetakannya ke 503 `retryable` — worker lalu mengulang job
  // untuk laporan yang memang tidak ada sampai masuk DLQ.
  readonly code = 'NOT_FOUND' as const;

  constructor() {
    super('Laporan tidak ditemukan.');
    this.name = 'ReportNotFoundError';
  }
}

@Injectable()
export class ReportService {
  /** Opsional: service ini juga dipakai di tes tanpa logger. */
  private readonly log: { warn: (o: unknown, m: string) => void } | null = null;

  constructor(
    @Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository,
    @Inject(RECOMMENDATION_REPOSITORY) private readonly recommendations: RecommendationRepository,
    private readonly conversations: ConversationService,
    private readonly snapshots: RequirementSnapshotStore,
    private readonly publisher: JobPublisher | null = null,
  ) {}

  /**
   * Membuat laporan `PENDING` beserta payload yang sudah dibekukan. Pembuatan PDF-nya
   * dikerjakan worker (terhalang OQ-40); laporan tetap berguna sebagai pratinjau di
   * layar sampai itu ada — dan pratinjau memang alur yang dipilih desain (§8).
   */
  async create(
    recommendationId: string,
    actor: ConversationOwner,
    identity: ReportIdentityInput,
    now: string,
  ): Promise<Report> {
    const recommendation = await this.recommendations.findById(recommendationId);
    if (!recommendation) throw new RecommendationNotFoundError();

    // Kepemilikan lewat percakapannya — melempar bila bukan milik aktor. Bahasanya sekaligus
    // bahasa laporan (P15-05): dibekukan ke payload, bukan dibaca ulang saat mencetak.
    const conversation = await this.conversations.find(recommendation.conversationId, actor);
    const locale = conversation.language;

    const traces = await this.recommendations.findTraces(recommendationId);
    const snapshot = await this.snapshots.current(recommendation.conversationId);
    const state: RequirementState | null = snapshot?.state ?? null;
    if (!state) throw new RecommendationNotFoundError();

    const yearMonth = yearMonthOf(now);
    const sequence = await this.reports.allocateNumber(yearMonth);
    const reportNumber = formatReportNumber(yearMonth, sequence);

    const env = loadEnv();
    const payload = assembleReportPayload({
      reportNumber,
      recommendation,
      traces,
      state,
      identity: {
        ...identity,
        // Laporan saat ini hanya untuk instalasi air bersih; labelnya ikut bahasa laporan.
        installationType: requirementValueLabel('water.installationType', 'clean_water', locale),
      },
      catalogVersionLabel: recommendation.catalogVersionId,
      pricing: {
        enabled: env.PRICING_ENABLED,
        taxRatePercent: env.TAX_RATE_PERCENT,
      },
      locale,
    });

    const report = await this.reports.create({
      id: ulid(),
      recommendationId,
      reportNumber,
      payload,
    });

    // Antrean gagal TIDAK menjatuhkan permintaan: laporannya sudah ada sebagai `PENDING`
    // dengan nomor yang dialokasikan, dan bisa dicoba lagi tanpa pengguna mengetik apa pun
    // (docs/REPORT.md §6). Tanpa publisher (worker belum berjalan), perilakunya sama.
    if (this.publisher) {
      const queued = await this.publisher.publish(QUEUES.reportGenerate, {
        reportId: report.id,
        correlationId: report.id,
      });
      if (!queued) {
        // Dicatat, bukan dilempar — pengguna melihat pratinjau, bukan kegagalan.
        this.log?.warn({ reportId: report.id }, 'laporan dibuat tetapi job PDF tidak terkirim');
      }
    }

    return report;
  }

  /**
   * Berkas PDF untuk diunduh pemilik. Status diperiksa dulu supaya pesannya jujur:
   * PENDING berarti "belum siap", FAILED berarti "gagal" — keduanya bukan "tidak ada".
   * Tautan bertanda tangan untuk dibagikan (§7) menyusul bersama rute email; rute ini
   * berbasis sesi, jadi tidak ada URL berkas yang bisa ditebak.
   */
  async pdfFor(
    reportId: string,
    actor: ConversationOwner,
  ): Promise<{ readonly absolutePath: string; readonly fileName: string }> {
    const report = await this.findForActor(reportId, actor);
    if (report.status === 'FAILED') throw new ReportPdfFailedError();
    if (report.status !== 'READY' || report.fileRef === null) throw new ReportPdfNotReadyError();

    const storagePath = loadEnv().STORAGE_PATH;
    if (storagePath === undefined) throw new ReportStorageUnavailableError();

    return {
      absolutePath: resolveReportFile(storagePath, report.fileRef),
      fileName: reportDownloadName(report.reportNumber),
    };
  }

  /** Membaca laporan setelah memastikan aktor berhak. */
  async findForActor(reportId: string, actor: ConversationOwner): Promise<Report> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new ReportNotFoundError();

    const recommendation = await this.recommendations.findById(report.recommendationId);
    if (!recommendation) throw new ReportNotFoundError();

    // Melempar `ConversationNotFoundError` bila bukan milik aktor — pesan yang sama
    // dengan "tidak ada", supaya id yang ditebak tidak membocorkan keberadaan laporan.
    await this.conversations.find(recommendation.conversationId, actor);
    return report;
  }

  /**
   * Menandai laporan selesai. Dipanggil worker lewat rute internal — jadi nomor laporan
   * tetap sama dengan yang sudah tampil di UI sejak `PENDING`.
   */
  async markReady(reportId: string, fileRef: string): Promise<void> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new ReportNotFoundError();
    await this.reports.markStatus(reportId, 'READY', { fileRef });
  }

  /** Menandai gagal. Nomornya TIDAK dilepas — percobaan ulang memakai nomor yang sama. */
  async markFailed(reportId: string, reason: string): Promise<void> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new ReportNotFoundError();
    await this.reports.markStatus(reportId, 'FAILED', { failureReason: reason });
  }

  /** Dipakai rute cetak internal: tanpa pemeriksaan pemilik, tetapi digerbang peran. */
  async findForPrint(reportId: string): Promise<Report> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new ReportNotFoundError();
    return report;
  }
}
