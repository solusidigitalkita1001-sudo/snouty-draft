/**
 * Port repository laporan. docs/REPORT.md.
 *
 * `allocateNumber` ada di port — bukan di service — karena alokasinya membutuhkan
 * transaksi dan `SELECT … FOR UPDATE`. Itu detail penyimpanan, dan menaruhnya di
 * application layer akan berarti application layer membuka transaksi untuk mengunci
 * baris, yang membocorkan cara kerja basis data ke tempat yang tidak perlu tahu.
 */

import type { Report, ReportPayload, ReportStatus } from './report.types.js';

export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');

export interface CreateReportInput {
  readonly id: string;
  readonly recommendationId: string;
  readonly reportNumber: string;
  readonly payload: ReportPayload;
}

export interface ReportRepository {
  /**
   * Mengalokasikan nomor berikutnya untuk bulan tersebut, dalam transaksi dengan
   * penguncian baris. Dua permintaan bersamaan tidak pernah mendapat nomor yang sama.
   */
  allocateNumber(yearMonth: string): Promise<number>;
  create(input: CreateReportInput): Promise<Report>;
  findById(id: string): Promise<Report | null>;
  findByRecommendation(recommendationId: string): Promise<readonly Report[]>;
  markStatus(
    id: string,
    status: ReportStatus,
    detail: { readonly fileRef?: string; readonly failureReason?: string },
  ): Promise<void>;
}
