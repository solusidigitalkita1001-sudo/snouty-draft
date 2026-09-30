/**
 * Kontrak event SSE. docs/API_CONTRACTS.md §3.
 *
 * Lima tahap analisis adalah batas pipeline NYATA, bukan timer. Angka 620 ms per
 * langkah di prototipe hanya ilustrasi (SPEC §33b).
 */
export type AnalysisStage =
  | 'UNDERSTANDING'
  | 'ANALYZING_INSTALLATION'
  | 'MATCHING_PRODUCTS'
  | 'COMPOSING'
  | 'PREPARING_SCHEMATIC';

/** Label dirender apa adanya — salinan diambil persis dari desain. */
export const ANALYSIS_STAGE_LABELS: Readonly<Record<AnalysisStage, string>> = {
  UNDERSTANDING: 'Memahami kebutuhan',
  ANALYZING_INSTALLATION: 'Menganalisis instalasi',
  MATCHING_PRODUCTS: 'Mencocokkan produk Pralon',
  COMPOSING: 'Menyusun rekomendasi',
  PREPARING_SCHEMATIC: 'Menyiapkan skema',
};

export type StageStatus = 'active' | 'done' | 'failed';

export interface TokenUsage {
  readonly in: number;
  readonly out: number;
  readonly costUsd: number;
}
