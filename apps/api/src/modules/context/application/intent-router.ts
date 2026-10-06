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
import type { IntentClassification } from '../../ai/domain/extraction-schema.js';
import {
  asksAdvice,
  hasRequirementSignals,
  mentionsCompetitor,
} from '../domain/message-signals.js';
import type { ReplyTurn } from './reply-writer.js';

/** Label model yang kalah oleh isyarat kebutuhan di teks — lihat `withRequirementPrecedence`. */
const YIELDS_TO_REQUIREMENT: ReadonlySet<Intent> = new Set<Intent>([
  'PRODUCT_LOOKUP',
  'OUT_OF_SCOPE',
  'CLARIFICATION_NEEDED',
]);

/**
 * Presedensi kebutuhan (docs/AI_BEHAVIOR.md §4): pesan yang membawa kebutuhan bangunan
 * ("… buat rumah 2 lantai?") adalah pernyataan kebutuhan walaupun juga menyebut produk atau
 * model ragu. Model 7B menyebutnya PRODUCT_LOOKUP karena kata PVC/HDPE, lalu pengguna
 * mendapat penjelasan bahan yang sama untuk kedua kalinya. Aturannya di kode: tidak
 * bergantung pada model mana yang sedang dipakai, dan bisa diuji tanpa model.
 */
export function withRequirementPrecedence(
  message: string,
  classified: IntentClassification,
): IntentClassification {
  let classification = classified;
  // Policy 1 hanya untuk pesaing: pesan yang cuma menyebut Pralon ("produk Pralon yang
  // terkenal apa?") bukan pertanyaan kompetitor walau model berkata begitu — ia pertanyaan
  // produk. Tanpa pagar ini pengguna mendapat kartu "kriteria netral" untuk pertanyaan
  // tentang Pralon sendiri (laporan pemilik 2026-10-06).
  if (classification.intent === 'COMPETITOR_QUESTION' && !mentionsCompetitor(message)) {
    classification = { intent: 'PRODUCT_LOOKUP', confidence: classification.confidence };
  }

  const yields =
    YIELDS_TO_REQUIREMENT.has(classification.intent) ||
    classification.confidence < INTENT_CONFIDENCE_THRESHOLD;
  // Permintaan REKOMENDASI ("rekomendasi produk buat …") bukan lookup: tanpa kebutuhan yang
  // diekstrak tidak ada yang bisa direkomendasikan, dan "Produk mana yang Anda maksud?" adalah
  // jawaban yang salah untuknya (laporan pemilik 2026-10-06, "drainase sawah").
  const recommendationAsLookup = classification.intent === 'PRODUCT_LOOKUP' && asksAdvice(message);
  if (!recommendationAsLookup && (!yields || !hasRequirementSignals(message)))
    return classification;
  return {
    intent: 'REQUIREMENT_STATEMENT',
    confidence: Math.max(classification.confidence, INTENT_CONFIDENCE_THRESHOLD),
  };
}

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

  async route(
    message: string,
    hasExistingRequirements: boolean,
    recentTurns: readonly ReplyTurn[] = [],
  ): Promise<RoutingDecision> {
    const classification = withRequirementPrecedence(
      message,
      await this.ai.classifyIntent({ message, hasExistingRequirements, recentTurns }),
    );

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
