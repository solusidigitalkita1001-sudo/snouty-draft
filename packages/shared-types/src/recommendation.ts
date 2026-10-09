/**
 * Agregat Recommendation — hasil konsultasi yang bisa dibaca, disimpan, dan diaudit.
 * docs/DOMAIN_MODEL.md §7 · SPEC §8.
 *
 * Dua invarian membentuk tipe-tipe di sini:
 *
 * **REC-1.** `headline` dan `body` adalah prosa LLM yang **hanya menjelaskan** angka
 * yang sudah dihitung. Angka di dalamnya diekstrak dan dicocokkan dengan `stats`,
 * `SystemLine`, dan `BomItem`; yang tidak cocok membuat prosanya dibuang.
 *
 * **T-1.** Setiap nilai teknik yang tampil punya minimal satu trace — karena itu
 * `SystemLine` dan `BomItem` membawa `traceIds`, dan kolom "DASAR PERHITUNGAN"
 * dirender dari trace, bukan dari prosa.
 */

import type { KeyValue } from './assistant-card.js';
import type { Provenance } from './provenance.js';
import type { ProductMatchState } from './catalog.js';

/** Lima statistik di layar 06. */
export interface RecommendationStats {
  readonly outletCount: number;
  readonly mainSize: string;
  readonly branchCount: number;
  readonly fixtureConnectionSize: string;
  readonly productCount: number;
}

/** Peran sebuah baris/segmen dalam sistem — juga menentukan warna bar di UI. */
export type SystemRole = 'main' | 'riser' | 'branch' | 'fixture' | 'fitting';

/** Satu baris tabel "Rekomendasi Sistem" (layar 06). */
/** Satu langkah hitung yang bisa dibaca pengguna — judul + penjelasan aturan, tanpa kode aturan. */
export interface CalculationStep {
  readonly title: string;
  readonly text: string;
}

export interface SystemLine {
  readonly name: string;
  readonly path: string;
  readonly size: string;
  readonly reason: string;
  readonly provenance: Provenance;
  readonly traceIds: readonly string[];
  readonly role: SystemRole;
  /** Langkah hitung jalur ini, berurutan — panel "detail teknis". Rekomendasi lama tidak punya. */
  readonly steps?: readonly CalculationStep[];
}

export interface SelectedProduct {
  readonly productId: string;
  readonly size: string;
  readonly role: SystemRole;
  readonly matchState: ProductMatchState;
  readonly reason: string;
  /**
   * Varian lain yang sama-sama cocok (katalog Pralon: ujung, warna, panjang batang, merek) —
   * ≤ 10, urut kriteria pemilihan yang sama (docs/MATCHER_V2_PROPOSAL.md §1). Kartu menampilkan
   * satu; drawer boleh menampilkan sisanya.
   */
  readonly alternatives?: readonly { readonly productId: string; readonly name: string }[];
}

export type BomUnit = 'batang' | 'pcs' | 'kaleng' | 'meter';

/** Statistik layar 06 untuk solusi IRIGASI (OQ-47) — menggantikan lima statistik bangunan. */
export interface IrrigationStats {
  readonly areaHa: number;
  readonly designFlowLs: number;
  readonly mainSize: string;
  readonly pumpRequired: boolean;
  readonly productCount: number;
}

export interface BomItem {
  readonly item: string;
  readonly size: string;
  readonly quantity: number;
  readonly unit: BomUnit;
  /** Teks kolom "DASAR PERHITUNGAN" — dari trace aturan, bukan dari prosa LLM. */
  readonly basis: string;
  readonly provenance: Provenance;
  readonly traceIds: readonly string[];
  /** Hanya bila `PRICING_ENABLED` (OQ-03). */
  readonly unitPrice?: number;
  readonly subtotal?: number;
}

export interface Assumption {
  readonly text: string;
  /**
   * Field kebutuhan yang terdampak. Inilah yang membuat "Perbaiki asumsi ini →"
   * bisa membuka field yang tepat alih-alih melempar pengguna ke awal percakapan.
   * Kosong = baris penjelasan cara hitung, bukan asumsi yang bisa diubah (tanpa tombol).
   */
  readonly fieldPath: string;
  readonly ruleId?: string;
  /**
   * ID di registry asumsi terpusat (`packages/engineering/src/parameters/assumptions.ts`)
   * bila nilai ini lahir dari sana — supaya asumsi yang sama tampil dengan identitas yang
   * sama di setiap kasus dan bisa diganti nilainya di satu tempat.
   */
  readonly assumptionId?: string;
}

/** Status kandidat ukuran — kosakata tertutup dari engine (Kelompok F/H), label di UI. */
export type OptionStatus = 'ok' | 'too_fast' | 'too_slow' | 'high_loss' | 'too_small';

/**
 * Satu kandidat ukuran pipa yang DIPERTIMBANGKAN engine (brief Fase 14 §28 "Opsi"):
 * bukan hanya yang dipilih, supaya tradeoff-nya terlihat. Angka dari engine, catatan dari kode.
 */
export interface SolutionOption {
  readonly size: string;
  readonly status: OptionStatus;
  /** Dipilih sebagai rekomendasi utama. */
  readonly recommended: boolean;
  /** Satu ukuran di atas rekomendasi: kerugian lebih rendah, biaya pipa lebih tinggi. */
  readonly alternative: boolean;
  /** Angka kandidat berlabel bahasa pengguna (kecepatan, kerugian gesek, kapasitas, …). */
  readonly metrics: readonly KeyValue[];
  /** Tradeoff dalam bahasa pengguna — deterministik dari status. */
  readonly note: string;
}

export type OutputReadiness = 'ready' | 'partial' | 'missing_data';

/** Kesiapan satu keluaran (pemilihan bahan, sizing pipa, pompa, …) dari `ReadinessResolver`. */
export interface ReadinessItem {
  readonly output: string;
  readonly label: string;
  readonly readiness: OutputReadiness;
  /** Label parameter wajib yang masih kurang. */
  readonly missing: readonly string[];
  /** Label parameter yang akan memperbaiki hasil. */
  readonly improvable: readonly string[];
}

/**
 * Bagian tetap jawaban teknis (brief §28), diisi dari state dan hasil engine — bukan dari model.
 * Ringkasan = `headline`/`body`, Asumsi = `assumptions`, Produk = `products`; yang di sini adalah
 * bagian yang sebelumnya tidak punya tempat: data diketahui, perhitungan, opsi, kesiapan, data kurang.
 */
export interface ComposedResponse {
  /** Data yang diketahui — parameter dari pengguna (`origin: known`), label + nilai bersatuan. */
  readonly knownData: readonly KeyValue[];
  /** Parameter yang diisi asumsi (`origin: assumed`) — berdampingan dengan asumsi engine. */
  readonly assumedData: readonly KeyValue[];
  /** Perhitungan: satu baris per aturan yang dijalankan, penjelasan dari trace. */
  readonly calculations: readonly KeyValue[];
  readonly options: readonly SolutionOption[];
  readonly readiness: readonly ReadinessItem[];
  /** Data yang masih dibutuhkan: label parameter → pertanyaan bahasa pengguna (maks. 4). */
  readonly missingData: readonly KeyValue[];
}

export interface Recommendation {
  readonly id: string;
  readonly conversationId: string;
  readonly snapshotId: string;
  /** Dibekukan saat pembuatan — laporan lama tetap menjelaskan katalog yang dipakai. */
  readonly catalogVersionId: string;
  readonly headline: string;
  readonly body: string;
  /** Jalur guna; tidak ada = bangunan (rekomendasi lama). `technical` = kasus teknis umum (Fase 14). */
  readonly kind?: 'building' | 'irrigation' | 'technical';
  readonly stats: RecommendationStats;
  /** Hanya untuk `kind: 'irrigation'`; `stats` tetap terisi demi pembaca lama. */
  readonly irrigationStats?: IrrigationStats;
  /** Statistik ringkasan kasus teknis umum (`kind: 'technical'`), label bahasa pengguna. */
  readonly highlights?: readonly KeyValue[];
  /** Bagian tetap jawaban teknis (Fase 14 §28); hanya `kind: 'technical'`. */
  readonly composition?: ComposedResponse;
  readonly systemLines: readonly SystemLine[];
  readonly products: readonly SelectedProduct[];
  readonly bom: readonly BomItem[];
  readonly assumptions: readonly Assumption[];
  /** Provenance paling lemah di seluruh isi — satu asumsi membuat solusinya asumsi. */
  readonly overallProvenance: Provenance;
  readonly createdAt: string;
}
