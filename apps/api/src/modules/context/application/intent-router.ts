/**
 * IntentRouter — menentukan apa yang harus terjadi atas sebuah pesan.
 * docs/CONTEXT_ENGINE.md §3, §6 · docs/AI_BEHAVIOR.md.
 *
 * Klasifikasi intent dikerjakan model (port `ai`), tetapi **keputusan atas hasilnya
 * deterministik dan hidup di sini** — bukan di prompt (SPEC §5). Dua pembedaan yang
 * menentukan:
 *
 *   - `PRODUCT_LOOKUP` dijawab query MySQL, bukan ekstraksi kebutuhan.
 *   - `REQUIREMENT_MUTATION` ("tambah satu kamar mandi") mengubah state;
 *     `EXPLANATION_REQUEST` ("kenapa ukuran ini") tidak. Salah di sini berarti
 *     mengubah kebutuhan pengguna tanpa diminta — maka **bila ragu, bertanya**:
 *     keyakinan di bawah ambang menjadi `CLARIFICATION_NEEDED`, bukan tebakan.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Intent } from '@snouty/shared-types';
import { AI_SERVICE, type AiService } from '../../ai/domain/ai.port.js';

/** Di bawah ini, sistem bertanya alih-alih menebak (docs/AI_BEHAVIOR.md). */
export const INTENT_CONFIDENCE_THRESHOLD = 0.6;

/** Intent yang membawa kebutuhan untuk diekstrak dan di-merge ke state. */
const EXTRACTING_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  'REQUIREMENT_STATEMENT',
  'REQUIREMENT_MUTATION',
  'CLARIFICATION_ANSWER',
]);

/** Intent yang MEMUTASI state kebutuhan (vs sekadar menyatakannya pertama kali). */
const MUTATING_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  'REQUIREMENT_MUTATION',
  'CLARIFICATION_ANSWER',
]);

export interface RoutingDecision {
  readonly intent: Intent;
  readonly confidence: number;
  /** Perlu memanggil ekstraksi + merge? Edit/penjelasan/lookup → false (nol LLM ekstraksi). */
  readonly shouldExtract: boolean;
  /** Mengubah state yang sudah ada? Menentukan apakah snapshot baru ditulis. */
  readonly mutatesState: boolean;
}

@Injectable()
export class IntentRouter {
  constructor(@Inject(AI_SERVICE) private readonly ai: AiService) {}

  async route(message: string, hasExistingRequirements: boolean): Promise<RoutingDecision> {
    const classification = await this.ai.classifyIntent({
      message,
      hasExistingRequirements,
    });

    // Ragu → bertanya. Mengubah kebutuhan tanpa diminta jauh lebih mahal daripada
    // satu pertanyaan tambahan (CONTEXT_ENGINE §6).
    if (classification.confidence < INTENT_CONFIDENCE_THRESHOLD) {
      return {
        intent: 'CLARIFICATION_NEEDED',
        confidence: classification.confidence,
        shouldExtract: false,
        mutatesState: false,
      };
    }

    return {
      intent: classification.intent,
      confidence: classification.confidence,
      shouldExtract: EXTRACTING_INTENTS.has(classification.intent),
      mutatesState: MUTATING_INTENTS.has(classification.intent),
    };
  }
}
