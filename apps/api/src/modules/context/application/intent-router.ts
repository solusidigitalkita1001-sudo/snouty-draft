/**
 * IntentRouter — menentukan apa yang harus terjadi atas sebuah pesan.
 * docs/CONTEXT_ENGINE.md §3, §6 · docs/AI_BEHAVIOR.md.
 *
 * Bentuk kalimat dikenali modul `understanding` (contoh sebagai data + kemiripan makna) dan,
 * hanya bila itu ragu, oleh model generatif (port `ai`). **Keputusan atas hasilnya deterministik
 * dan hidup di sini** — bukan di prompt dan bukan di daftar frasa (aturan proyek 2026-10-07).
 * Dua pembedaan yang menentukan:
 *
 *   - `PRODUCT_LOOKUP` dijawab query MySQL, bukan ekstraksi kebutuhan.
 *   - `REQUIREMENT_MUTATION` ("tambah satu kamar mandi") mengubah state;
 *     `EXPLANATION_REQUEST` ("kenapa ukuran ini") tidak. Salah di sini berarti
 *     mengubah kebutuhan pengguna tanpa diminta — maka **bila ragu, bertanya**:
 *     keyakinan di bawah ambang menjadi `CLARIFICATION_NEEDED`, bukan tebakan.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ConversationSubject, Intent } from '@snouty/shared-types';
import { AI_SERVICE, type AiService } from '../../ai/domain/ai.port.js';
import type { IntentClassification } from '../../ai/domain/extraction-schema.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import { isProductQuestion, isSocial, type FineIntent } from '../../understanding/domain/labels.js';
import {
  intentForSubject,
  isChoiceFollowUp,
  isFollowUp,
  isFormatFollowUp,
} from '../domain/subject.js';
import type { ReplyTurn } from './reply-writer.js';

/** Label model yang kalah oleh isyarat kebutuhan di teks — lihat `withRequirementPrecedence`. */
const YIELDS_TO_REQUIREMENT: ReadonlySet<Intent> = new Set<Intent>([
  'PRODUCT_LOOKUP',
  'OUT_OF_SCOPE',
  'CLARIFICATION_NEEDED',
]);

/** Keyakinan yang diberikan pada intent yang dikenali dari contoh — di atas ambang, di bawah 1. */
const UNDERSTOOD_CONFIDENCE = 0.9;

/**
 * Intent yang PASTI dari hasil pemahaman — pemetaan label halus (data) ke intent kasar (perilaku),
 * beserta pagarnya. `null` = ragu, tanya model generatif.
 *
 * Pagar yang hidup di sini, bukan di data:
 *   - pertanyaan perusahaan yang juga menyebut kebutuhan bangunan ("pabrik Pralon di mana?" vs
 *     "rumah 2 lantai") → bukan pertanyaan perusahaan;
 *   - label pesaing hanya sah bila pesan memang menyebut merek/rujukan pesaing (Policy 1);
 *   - mutasi dan jawaban klarifikasi mustahil tanpa kebutuhan yang sudah ada → pernyataan kebutuhan;
 *   - lanjutan ("boleh", "lanjut") tanpa subjek aktif tidak punya apa pun untuk dilanjutkan.
 */
export function certainIntent(
  u: MessageUnderstanding,
  hasExistingRequirements: boolean,
): IntentClassification | null {
  const fine = u.intent?.label;
  if (fine === undefined) return null;
  const sure = (intent: Intent): IntentClassification => ({
    intent,
    confidence: UNDERSTOOD_CONFIDENCE,
  });

  if (fine === 'greeting' || fine === 'out_of_scope' || isSocial(fine)) return sure('OUT_OF_SCOPE');
  if (fine === 'company_question') {
    // "pabrik Pralon di mana?" menyebut Pralon → perusahaan, walau "pabrik" juga kata kebutuhan;
    // bentuk perusahaan tanpa menyebut Pralon tetapi dengan kebutuhan → biar presedensi memutuskan.
    return u.mentionsOwnBrand || !u.mentionsRequirement ? sure('COMPANY_QUESTION') : null;
  }
  if (fine === 'competitor_question') {
    return u.mentionsCompetitor ? sure('COMPETITOR_QUESTION') : sure('PRODUCT_LOOKUP');
  }
  if (fine === 'requirement_building' || fine === 'requirement_irrigation') {
    return sure('REQUIREMENT_STATEMENT');
  }
  if (fine === 'requirement_technical') return sure('REQUIREMENT_STATEMENT');
  if (fine === 'requirement_mutation') {
    return sure(hasExistingRequirements ? 'REQUIREMENT_MUTATION' : 'REQUIREMENT_STATEMENT');
  }
  if (fine === 'clarification_answer') {
    return sure(hasExistingRequirements ? 'CLARIFICATION_ANSWER' : 'REQUIREMENT_STATEMENT');
  }
  if (fine === 'explanation_request') return sure('EXPLANATION_REQUEST');
  if (isProductQuestion(fine)) {
    // Merek pesaing di pertanyaan produk adalah urusan Policy 1, bukan pencarian katalog.
    if (u.mentionsCompetitor) return sure('COMPETITOR_QUESTION');
    return sure('PRODUCT_LOOKUP');
  }
  // Lanjutan tanpa subjek (pemanggil sudah mencoba `subjectContinuation`): tidak ada yang
  // dilanjutkan — jawabannya pembuka, bukan 40 detik model untuk sampai ke kesimpulan yang sama.
  if ((fine as FineIntent).startsWith('follow_up_')) return sure('OUT_OF_SCOPE');
  return null;
}

/**
 * Presedensi kebutuhan (docs/AI_BEHAVIOR.md §4): pesan yang membawa kebutuhan bangunan
 * ("… buat rumah 2 lantai?") adalah pernyataan kebutuhan walaupun juga menyebut produk atau
 * model ragu. Model 7B menyebutnya PRODUCT_LOOKUP karena kata PVC/HDPE, lalu pengguna
 * mendapat penjelasan bahan yang sama untuk kedua kalinya. Aturannya di kode: tidak
 * bergantung pada model mana yang sedang dipakai, dan bisa diuji tanpa model.
 */
export function withRequirementPrecedence(
  u: MessageUnderstanding,
  classified: IntentClassification,
): IntentClassification {
  let classification = classified;
  // Policy 1 hanya untuk pesaing: pesan yang cuma menyebut Pralon ("produk Pralon yang
  // terkenal apa?") bukan pertanyaan kompetitor walau model berkata begitu — ia pertanyaan
  // produk. Tanpa pagar ini pengguna mendapat kartu "kriteria netral" untuk pertanyaan
  // tentang Pralon sendiri (laporan pemilik 2026-10-06).
  if (classification.intent === 'COMPETITOR_QUESTION' && !u.mentionsCompetitor) {
    classification = { intent: 'PRODUCT_LOOKUP', confidence: classification.confidence };
  }
  // Pagar yang sama untuk PERUSAHAAN: label model hanya berlaku bila pesannya memang menyebut
  // Pralon atau dikenali sebagai pertanyaan perusahaan. Model 7B melabeli "hi, I want to ask
  // something" sebagai COMPANY_QUESTION (checkpoint Fase 15, S4) — sapaan itu pembuka.
  if (
    classification.intent === 'COMPANY_QUESTION' &&
    !u.mentionsOwnBrand &&
    u.intent?.label !== 'company_question'
  ) {
    classification = { intent: 'OUT_OF_SCOPE', confidence: classification.confidence };
  }

  const yields =
    YIELDS_TO_REQUIREMENT.has(classification.intent) ||
    classification.confidence < INTENT_CONFIDENCE_THRESHOLD;
  // Permintaan REKOMENDASI ("rekomendasi produk buat …") bukan lookup: tanpa kebutuhan yang
  // diekstrak tidak ada yang bisa direkomendasikan, dan "Produk mana yang Anda maksud?" adalah
  // jawaban yang salah untuknya (laporan pemilik 2026-10-06, "drainase sawah").
  const recommendationAsLookup =
    classification.intent === 'PRODUCT_LOOKUP' && u.intent?.label === 'advice_request';
  if (!recommendationAsLookup && (!yields || !u.mentionsRequirement)) return classification;
  return {
    intent: 'REQUIREMENT_STATEMENT',
    confidence: Math.max(classification.confidence, INTENT_CONFIDENCE_THRESHOLD),
  };
}

/**
 * Subjek percakapan yang aktif (Fase 16) menyelesaikan pesan yang tidak berdiri sendiri:
 * "boleh", "lengkap dong", "semuanya" atas subjek PERUSAHAAN adalah pertanyaan perusahaan
 * lanjutan — bukan pesan lepas untuk diklasifikasi ulang (yang berakhir "Produk mana yang
 * Anda maksud?"). Subjek hanya berganti bila pengguna menyebut hal baru.
 */
export function subjectContinuation(
  u: MessageUnderstanding,
  subject: ConversationSubject | undefined,
): RoutingDecision | null {
  if (!subject) return null;
  const choice = subject.kind === 'product' && isChoiceFollowUp(u);
  if (!isFollowUp(u) && !isFormatFollowUp(u) && !choice) return null;
  const intent = intentForSubject(subject.kind);
  return {
    intent,
    confidence: 1,
    shouldExtract: intent === 'REQUIREMENT_STATEMENT',
    mutatesState: intent === 'REQUIREMENT_STATEMENT',
  };
}

/**
 * Presedensi subjek: selama subjeknya perusahaan, pesan yang menyebut Pralon tanpa menyebut
 * produk atau kebutuhan tetap pertanyaan perusahaan walau model berkata PRODUCT_LOOKUP/ragu.
 * "Pralon" yang muncul lagi tidak mengembalikan percakapan ke mode produk.
 */
export function withSubjectPrecedence(
  u: MessageUnderstanding,
  subject: ConversationSubject | undefined,
  classified: IntentClassification,
): IntentClassification {
  if (subject?.kind !== 'company') return classified;
  if (!YIELDS_TO_SUBJECT.has(classified.intent)) return classified;
  if (u.families.length > 0 || u.mentionsRequirement) return classified;
  if (!u.mentionsOwnBrand && u.intent?.label !== 'company_question') return classified;
  return { intent: 'COMPANY_QUESTION', confidence: Math.max(classified.confidence, 0.9) };
}

const YIELDS_TO_SUBJECT: ReadonlySet<Intent> = new Set<Intent>([
  'PRODUCT_LOOKUP',
  'OUT_OF_SCOPE',
  'CLARIFICATION_NEEDED',
]);

/**
 * Keputusan yang tidak butuh model: pesan pertama (belum ada kebutuhan) yang menyebut hal-hal
 * kebutuhan dan bukan pertanyaan "kenapa" / pesaing. `null` = tanya model.
 */
export function fastPathIntent(
  u: MessageUnderstanding,
  hasExistingRequirements: boolean,
): IntentClassification | null {
  if (hasExistingRequirements) return null;
  if (!u.mentionsRequirement || u.intent?.label === 'explanation_request') return null;
  if (u.mentionsCompetitor) return null;
  return { intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 };
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
    u: MessageUnderstanding,
    hasExistingRequirements: boolean,
    recentTurns: readonly ReplyTurn[] = [],
    subject: ConversationSubject | undefined = undefined,
  ): Promise<RoutingDecision> {
    // Pesan lanjutan atas subjek aktif tidak diklasifikasi ulang (Fase 16) — nol model.
    const continued = subjectContinuation(u, subject);
    if (continued) return continued;

    // Bentuk yang dikenali dari contoh diputuskan di kode, bukan oleh model: "pralon itu apa?"
    // tidak pernah menjadi pencarian produk apa pun kata model (Fase 16). Pesan PERTAMA yang
    // menyebut hal-hal kebutuhan berakhir REQUIREMENT_STATEMENT (P14-07). Model generatif hanya
    // untuk yang tidak mirip contoh mana pun — di CPU, satu panggilan 10–60 detik.
    const certain = certainIntent(u, hasExistingRequirements);
    const fast = certain ?? fastPathIntent(u, hasExistingRequirements);
    const classification = withSubjectPrecedence(
      u,
      subject,
      withRequirementPrecedence(
        u,
        fast ??
          (await this.ai.classifyIntent({
            message: u.text,
            hasExistingRequirements,
            recentTurns,
          })),
      ),
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
