/**
 * Bentuk laporan di kawat — `POST /reports` dan `GET /reports/:id`. docs/REPORT.md §2, §8.
 *
 * Seluruh isi `ReportPayload` **disalin** dari `Recommendation` dan `CalculationTrace` saat
 * laporan dibuat, lalu dibekukan: laporan adalah dokumen yang dibawa pengguna ke toko, dan
 * harus terbaca sama bertahun kemudian meski katalog, aturan, dan harga sudah berubah.
 */

import type { Provenance } from './provenance.js';
import type { Assumption, BomItem, SystemLine } from './recommendation.js';

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

/** Harga nonaktif (OQ-03) → `enabled: false`, nilainya nol dan bloknya tidak dirender. */
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

/** Respons `POST /reports` (202): PDF-nya menyusul lewat antrean. */
export interface ReportCreated {
  readonly id: string;
  readonly reportNumber: string;
  readonly status: ReportStatus;
  readonly createdAt: string;
}

/** Respons `GET /reports/:id` — pratinjau di layar, alur yang dipilih desain (§8). */
export interface ReportPreview extends ReportCreated {
  readonly payload: ReportPayload;
  /** Terisi saat `READY`; rujukan penyimpanan, bukan URL yang bisa dibuka langsung. */
  readonly fileRef: string | null;
}
