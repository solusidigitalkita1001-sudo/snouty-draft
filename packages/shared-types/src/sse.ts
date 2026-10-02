/**
 * Kontrak event SSE. docs/API_CONTRACTS.md §3.
 *
 * Lima tahap analisis adalah batas pipeline NYATA, bukan timer. Angka 620 ms per
 * langkah di prototipe hanya ilustrasi (SPEC §33b).
 */

import type { AssistantCard } from './assistant-card.js';
import type { ErrorCode } from './errors.js';
import type { RequirementState } from './requirement.js';
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

/**
 * Event yang dialirkan selama satu giliran asisten. docs/API_CONTRACTS.md §3.
 *
 * Union tertutup: sama seperti `AssistantCard`, tidak ada jalur untuk markup bebas.
 * `stage` menandai batas pipeline nyata, bukan timer — ia dipancarkan saat tahapnya
 * benar-benar mulai/selesai/gagal.
 */
export type AssistantStreamEvent =
  | { readonly type: 'message.start'; readonly messageId: string }
  | {
      readonly type: 'stage';
      readonly stage: AnalysisStage;
      readonly status: StageStatus;
      readonly detail?: string;
    }
  | { readonly type: 'token'; readonly text: string }
  | { readonly type: 'requirement.updated'; readonly state: RequirementState }
  | { readonly type: 'card'; readonly card: AssistantCard }
  | { readonly type: 'solution.ready'; readonly recommendationId: string }
  | {
      readonly type: 'error';
      readonly code: ErrorCode;
      readonly retryable: boolean;
      readonly retryAfterSec?: number;
    }
  | { readonly type: 'message.end'; readonly messageId: string; readonly usage: TokenUsage };

export type AssistantStreamEventType = AssistantStreamEvent['type'];
