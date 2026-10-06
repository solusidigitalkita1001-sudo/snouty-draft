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
export interface SystemLine {
  readonly name: string;
  readonly path: string;
  readonly size: string;
  readonly reason: string;
  readonly provenance: Provenance;
  readonly traceIds: readonly string[];
  readonly role: SystemRole;
}

export interface SelectedProduct {
  readonly productId: string;
  readonly size: string;
  readonly role: SystemRole;
  readonly matchState: ProductMatchState;
  readonly reason: string;
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

export interface Recommendation {
  readonly id: string;
  readonly conversationId: string;
  readonly snapshotId: string;
  /** Dibekukan saat pembuatan — laporan lama tetap menjelaskan katalog yang dipakai. */
  readonly catalogVersionId: string;
  readonly headline: string;
  readonly body: string;
  /** Jalur guna; tidak ada = bangunan (rekomendasi lama). */
  readonly kind?: 'building' | 'irrigation';
  readonly stats: RecommendationStats;
  /** Hanya untuk `kind: 'irrigation'`; `stats` tetap terisi demi pembaca lama. */
  readonly irrigationStats?: IrrigationStats;
  readonly systemLines: readonly SystemLine[];
  readonly products: readonly SelectedProduct[];
  readonly bom: readonly BomItem[];
  readonly assumptions: readonly Assumption[];
  /** Provenance paling lemah di seluruh isi — satu asumsi membuat solusinya asumsi. */
  readonly overallProvenance: Provenance;
  readonly createdAt: string;
}
