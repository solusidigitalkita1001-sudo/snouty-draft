/**
 * Port repository rekomendasi. docs/DOMAIN_MODEL.md §7.
 *
 * Append-only seperti snapshot: rekomendasi tidak pernah diubah di tempat. Perubahan
 * kebutuhan menghasilkan rekomendasi baru, sehingga laporan yang sudah diunduh tetap
 * bisa dijelaskan dengan isi yang sama.
 */

import type { Recommendation } from '@snouty/shared-types';
import type { CalculationTrace } from '@snouty/engineering';

export const RECOMMENDATION_REPOSITORY = Symbol('RECOMMENDATION_REPOSITORY');

export interface TraceToSave extends CalculationTrace {
  readonly id: string;
}

/**
 * Dari mana prosa rekomendasi berasal. `llm_retry` berarti percobaan pertama ditolak
 * REC-1; `template` berarti kedua percobaan ditolak, atau tidak ada model sama sekali.
 *
 * Disimpan di baris rekomendasi, bukan di `llm_calls`: hanya perakitan yang tahu prosa
 * mana yang ditolak, dan `ai` memang tidak boleh tahu (OQ-44).
 */
export type ProseSource = 'llm' | 'llm_retry' | 'template';

export interface RecommendationRepository {
  /** Menyimpan rekomendasi beserta seluruh trace-nya dalam satu transaksi. */
  save(
    recommendation: Recommendation,
    traces: readonly TraceToSave[],
    meta: { readonly proseSource: ProseSource },
  ): Promise<void>;
  findById(id: string): Promise<Recommendation | null>;
  /** Rekomendasi terbaru sebuah percakapan. */
  findLatestForConversation(conversationId: string): Promise<Recommendation | null>;
  findTraces(recommendationId: string): Promise<readonly TraceToSave[]>;
}
