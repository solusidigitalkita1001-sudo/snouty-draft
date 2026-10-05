/**
 * Bentuk data laporan dua halaman. docs/REPORT.md §2.
 *
 * Bentuk kawatnya (`ReportPayload` dan kawan-kawan) hidup di `@snouty/shared-types` sejak
 * pratinjau laporan dibangun di web — satu definisi untuk API, worker, dan UI. Yang tinggal
 * di sini hanya `Report`, catatan internal yang tidak pernah utuh sampai ke klien.
 *
 * Seluruh isi payload **disalin** dari `Recommendation` dan `CalculationTrace` saat laporan
 * dibuat, lalu dibekukan. Laporan adalah dokumen yang dibawa pengguna ke toko; ia harus
 * terbaca sama bertahun kemudian meski katalog, aturan, dan harga sudah berubah. Merujuk
 * ulang ke tabel lain saat mencetak akan membuat laporan lama ikut berubah diam-diam.
 */

import type { ReportPayload, ReportStatus } from '@snouty/shared-types';

export type {
  ReportBasisRow,
  ReportIdentity,
  ReportPayload,
  ReportPricing,
  ReportRequirementRow,
  ReportStatus,
} from '@snouty/shared-types';

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
