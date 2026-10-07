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
import type { ConversationSubject, Intent } from '@snouty/shared-types';
import { AI_SERVICE, type AiService } from '../../ai/domain/ai.port.js';
import type { IntentClassification } from '../../ai/domain/extraction-schema.js';
import { asksAboutCompany, certainIntent } from '../../ai/domain/heuristics.js';
import {
  asksAdvice,
  hasRequirementSignals,
  mentionsCompetitor,
} from '../domain/message-signals.js';
import { intentForSubject, isFollowUp, isFormatFollowUp } from '../domain/subject.js';
import { materialsIn } from './pipe-knowledge.js';
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
  // Pagar yang sama untuk PERUSAHAAN: label model hanya berlaku bila pesannya memang menyebut
  // Pralon/perusahaan. Model 7B melabeli "hi, I want to ask something" sebagai COMPANY_QUESTION
  // (checkpoint Fase 15, S4) — sapaan itu pembuka, bukan profil perusahaan.
  if (
    classification.intent === 'COMPANY_QUESTION' &&
    !asksAboutCompany(message) &&
    !/\bpralon\b/i.test(message)
  ) {
    classification = { intent: 'OUT_OF_SCOPE', confidence: classification.confidence };
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

/**
 * Subjek percakapan yang aktif (Fase 16) menyelesaikan pesan yang tidak berdiri sendiri:
 * "boleh", "lengkap dong", "semuanya" atas subjek PERUSAHAAN adalah pertanyaan perusahaan
 * lanjutan — bukan pesan lepas untuk diklasifikasi ulang (yang berakhir "Produk mana yang
 * Anda maksud?"). Subjek hanya berganti bila pengguna menyebut hal baru.
 */
export function subjectContinuation(
  message: string,
  subject: ConversationSubject | undefined,
): RoutingDecision | null {
  if (!subject) return null;
  // Permintaan ubah bentuk ("bikinin tabelnya dong") juga lanjutan — selama tidak menyebut
  // bahan/produk atau kebutuhan baru.
  const reformat =
    isFormatFollowUp(message) &&
    materialsIn(message).length === 0 &&
    !hasRequirementSignals(message);
  if (!isFollowUp(message) && !reformat) return null;
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
  message: string,
  subject: ConversationSubject | undefined,
  classified: IntentClassification,
): IntentClassification {
  if (subject?.kind !== 'company') return classified;
  if (!YIELDS_TO_SUBJECT.has(classified.intent)) return classified;
  if (materialsIn(message).length > 0 || hasRequirementSignals(message)) return classified;
  if (!/\bpralon\b/i.test(message) && !asksAboutCompany(message)) return classified;
  return { intent: 'COMPANY_QUESTION', confidence: Math.max(classified.confidence, 0.9) };
}

const YIELDS_TO_SUBJECT: ReadonlySet<Intent> = new Set<Intent>([
  'PRODUCT_LOOKUP',
  'OUT_OF_SCOPE',
  'CLARIFICATION_NEEDED',
]);

const EXPLANATION_SIGNALS =
  /\b(kenapa|mengapa|kok|alasan(nya)?|dasar(nya)?|why|reason|basis|how come)\b/i;

/**
 * Keputusan yang tidak butuh model: pesan pertama (belum ada kebutuhan) dengan isyarat
 * kebutuhan dan bukan pertanyaan "kenapa". `null` = tanya model.
 */
export function fastPathIntent(
  message: string,
  hasExistingRequirements: boolean,
): IntentClassification | null {
  if (hasExistingRequirements) return null;
  if (!hasRequirementSignals(message) || EXPLANATION_SIGNALS.test(message)) return null;
  if (mentionsCompetitor(message)) return null;
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
    message: string,
    hasExistingRequirements: boolean,
    recentTurns: readonly ReplyTurn[] = [],
    subject: ConversationSubject | undefined = undefined,
  ): Promise<RoutingDecision> {
    // Pesan lanjutan atas subjek aktif tidak diklasifikasi ulang (Fase 16) — nol model.
    const continued = subjectContinuation(message, subject);
    if (continued) return continued;

    // Pralon sebagai PERUSAHAAN diputuskan di kode, bukan oleh model: "pralon itu apa?" tidak
    // pernah menjadi pencarian produk apa pun kata model (Fase 16).
    if (certainIntent(message)?.intent === 'COMPANY_QUESTION') {
      return {
        intent: 'COMPANY_QUESTION',
        confidence: 0.9,
        shouldExtract: false,
        mutatesState: false,
      };
    }

    // Jalur cepat tanpa model (P14-07): pesan PERTAMA yang membawa isyarat kebutuhan berakhir
    // REQUIREMENT_STATEMENT apa pun kata model — `withRequirementPrecedence` menimpa
    // PRODUCT_LOOKUP/OUT_OF_SCOPE/ragu, dan mutasi/jawaban klarifikasi tidak mungkin tanpa state.
    // Satu-satunya label yang masih bisa menang adalah EXPLANATION_REQUEST, dan bentuknya
    // terbaca dari kata tanya. Di CPU, panggilan yang dilewati ini 4–6 detik per giliran.
    const fast = fastPathIntent(message, hasExistingRequirements);
    const classification = withSubjectPrecedence(
      message,
      subject,
      withRequirementPrecedence(
        message,
        fast ?? (await this.ai.classifyIntent({ message, hasExistingRequirements, recentTurns })),
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
