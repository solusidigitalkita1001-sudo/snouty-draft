/**
 * Bentuk laporan di kawat — `POST /reports` dan `GET /reports/:id`. docs/REPORT.md §2, §8.
 *
 * Seluruh isi `ReportPayload` **disalin** dari `Recommendation` dan `CalculationTrace` saat
 * laporan dibuat, lalu dibekukan: laporan adalah dokumen yang dibawa pengguna ke toko, dan
 * harus terbaca sama bertahun kemudian meski katalog, aturan, dan harga sudah berubah.
 */

import type { Locale } from './locale.js';
import type { Provenance } from './provenance.js';
import type {
  Assumption,
  BomItem,
  SelectedProduct,
  SolutionNeed,
  SystemLine,
  TankStandView,
} from './recommendation.js';
import type { AnySchematic } from './schematic.js';

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
  /**
   * Rumus singkat berangka dari trace (`stepFormula`) — laporan mencetak ini, bukan penjelasan
   * panjangnya. Tidak ada untuk aturan tanpa rumus dan untuk payload lama.
   */
  readonly formula?: string;
  /**
   * Pembeda judul bila aturan yang sama berjalan lebih dari sekali (P27-12): ukuran yang
   * dihasilkan langkah itu. Tanpa ini dua baris berjudul sama persis dan pembaca tidak tahu baris
   * mana membicarakan jalur mana.
   */
  readonly qualifier?: string;
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
  /** Versi katalog yang dipakai — disimpan untuk pelacakan, tidak dicetak (P17-10). */
  readonly catalogVersionLabel: string;
  /**
   * Tanggal berlaku data produk (YYYY-MM-DD) — dicetak sebagai "Data produk per …" menggantikan label
   * versi (keputusan pemilik 2026-10-13). Payload lama tidak punya.
   */
  readonly catalogDate?: string;
  readonly overallProvenance: Provenance;
  /**
   * Bahasa dokumen — bahasa percakapan saat laporan dibuat (P15-05), ikut dibekukan bersama
   * isinya. Payload yang tersimpan sebelum field ini ada dibaca sebagai `'id'` (repository).
   */
  readonly locale: Locale;
  /**
   * Versi aturan hitung yang dipakai (sidik himpunan aturan@versi dari trace). Payload lama tidak
   * punya field ini. `outdated` = disusun dengan aturan yang sudah diganti/dihapus saat dibuat.
   */
  readonly ruleset?: { readonly stamp: string; readonly outdated: boolean };
  /**
   * Produk Pralon terpilih yang jumlah belinya belum bisa dihitung (panjang jalur / ukuran rumah
   * belum diketahui) — tetap didaftar, jumlahnya menyusul (keputusan pemilik 2026-10-12). Produk
   * yang sudah punya baris di `bom` tidak diulang. Payload lama tidak punya field ini.
   */
  readonly pendingItems?: readonly ReportPendingItem[];
  /**
   * Skema instalasi saat laporan dibuat — topologi yang sama dengan layar skema, dibekukan bersama
   * isi laporan (skema di web dibentuk ulang dari snapshot). Payload lama tidak punya field ini.
   */
  readonly schematic?: AnySchematic;
  /**
   * Produk terpilih (DD-01, P17-09): BOQ dan lampiran produk laporan diturunkan dari daftar yang
   * sama dengan layar (`boqFrom`). Payload lama tidak punya — memakai `pendingItems`.
   */
  readonly products?: readonly SelectedProduct[];
  /** Kebutuhan bergambar ringkasan (P17-04); hanya solusi bangunan sejak P17-04. */
  readonly needs?: readonly SolutionNeed[];
  /** Pilihan dudukan toren (P22-04); hanya solusi bangunan bersumber toren atap. */
  readonly tankStand?: TankStandView;
  /** Jumlah titik air dari engine — alur air di ringkasan. */
  readonly outletCount?: number;
}

/** Satu produk katalog tanpa jumlah: nama dari katalog, ukuran dari rekomendasi. */
export interface ReportPendingItem {
  readonly productId: string;
  readonly name: string;
  readonly size: string;
  /** Pipa dihitung per batang, fitting per buah — keterangannya berbeda (laporan 0009). */
  readonly kind?: 'pipe' | 'fitting';
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
  /**
   * Dihitung dengan versi aturan lama — dinilai saat dibaca dari trace rekomendasinya terhadap
   * aturan yang berlaku sekarang. Isi laporan tidak diubah; pengguna bisa menyusun laporan baru.
   */
  readonly outdated?: boolean;
  /** Terisi saat `READY`; rujukan penyimpanan, bukan URL yang bisa dibuka langsung. */
  readonly fileRef: string | null;
}
