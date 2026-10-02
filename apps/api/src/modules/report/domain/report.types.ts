/**
 * Bentuk data laporan dua halaman. docs/REPORT.md §2.
 *
 * Seluruh isinya **disalin** dari `Recommendation` dan `CalculationTrace` saat laporan
 * dibuat, lalu dibekukan. Laporan adalah dokumen yang dibawa pengguna ke toko; ia harus
 * terbaca sama bertahun kemudian meski katalog, aturan, dan harga sudah berubah. Merujuk
 * ulang ke tabel lain saat mencetak akan membuat laporan lama ikut berubah diam-diam.
 */

import type { Assumption, BomItem, Provenance, SystemLine } from '@snouty/shared-types';

export type ReportStatus = 'PENDING' | 'READY' | 'FAILED';

export interface ReportIdentity {
  readonly customerName: string;
  readonly projectLocation: string;
  readonly consultationDate: string;
  readonly installationType: string;
}

export interface ReportRequirementRow {
  readonly label: string;
  readonly value: string;
  readonly provenance: Provenance;
}

/** Satu baris "DASAR PERHITUNGAN" halaman 2, dirakit dari trace. */
export interface ReportBasisRow {
  readonly ruleId: string;
  readonly explanation: string;
}

export interface ReportPricing {
  readonly enabled: boolean;
  readonly taxRatePercent: number;
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly total: number;
}

export interface ReportPayload {
  readonly reportNumber: string;
  readonly identity: ReportIdentity;
  readonly headline: string;
  readonly body: string;
  readonly requirements: readonly ReportRequirementRow[];
  readonly systemLines: readonly SystemLine[];
  readonly assumptions: readonly Assumption[];
  readonly bom: readonly BomItem[];
  readonly basis: readonly ReportBasisRow[];
  readonly pricing: ReportPricing;
  /** Versi katalog yang dipakai — muncul di blok tanda tangan. */
  readonly catalogVersionLabel: string;
  readonly overallProvenance: Provenance;
}

export interface Report {
  readonly id: string;
  readonly recommendationId: string;
  readonly reportNumber: string;
  readonly status: ReportStatus;
  readonly payload: ReportPayload;
  readonly fileRef: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}
