/**
 * MessageService — orkestrasi satu giliran chat. docs/CONTEXT_ENGINE.md §3.
 *
 * Mengikat lapisan domain (routing, understanding) ke persistensi dan menghasilkan
 * daftar event SSE untuk dialirkan controller. Persistensi hidup di sini, bukan di
 * pipeline domain, supaya urutan tulis (pesan pengguna → snapshot → pesan asisten)
 * ada di satu tempat.
 *
 * Tanpa AI (kunci tidak diset), giliran tidak jatuh: ia mengalirkan `error`
 * `LLM_UNAVAILABLE` yang retryable — jujur bahwa pemahaman bahasa sedang tak
 * tersedia, sambil tetap membiarkan jalur edit deterministik bekerja.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  AssistantCard,
  AssistantStreamEvent,
  ConversationSubject,
  IrrigationField,
  RequirementFieldPath,
  RequirementState,
} from '@snouty/shared-types';
import { AI_SERVICE, type AiService } from '../../ai/domain/ai.port.js';
import { heuristicProductQuestion } from '../../ai/domain/heuristics.js';
import type { CompanyKnowledgeService } from '../../company-knowledge/application/company-knowledge.service.js';
import { composeCompanyAnswer } from '../../company-knowledge/domain/company-answer.js';
import { SECTIONS } from '../../company-knowledge/domain/company-profile.js';
import { runCompanyQuestion } from './company-question-pipeline.js';
import { productSubject } from '../domain/subject.js';
import { LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import { productFaqSystemPrompt } from '../../ai/application/prompts.js';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import { loadEnv } from '../../../config/env.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { ProductQuestionService } from '../../product-knowledge/application/product-question.service.js';
import { certainIntent } from '../../ai/domain/heuristics.js';
import { IntentRouter, type RoutingDecision } from './intent-router.js';
import { applyTechnicalAnswers, technicalAnswerValue } from '../domain/technical.js';
import { applyEdit, followUpCard, runUnderstanding } from './message-pipeline.js';
import {
  answerToUpdate,
  summarizeAnswers,
  type ClarificationAnswer,
} from '../domain/clarification.js';
import { withCompleteness } from '../domain/completeness.js';
import {
  applyIrrigationAnswers,
  irrigationAnswerValue,
  isIrrigationField,
} from '../domain/irrigation.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { defaultUpdateFor } from '../domain/requirement-defaults.js';
import { runProductQuestion } from './product-question-pipeline.js';
import { ReplyWriter, type ReplyTurn } from './reply-writer.js';
import { RequirementSnapshotStore } from './requirement-snapshot.store.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { ulid } from '../../../shared/ulid.js';
import { stageTimer, type StageTimer } from '../../../shared/logging/stage-timer.js';
import type { EventSink } from '../../../shared/sse/event-stream.js';
import type { Logger } from 'pino';

@Injectable()
export class MessageService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly store: RequirementSnapshotStore,
    private readonly router: IntentRouter,
    private readonly catalog: CatalogQueryService,
    private readonly productQuestions: ProductQuestionService,
    @Optional() private readonly reply: ReplyWriter | null = null,
    @Optional() @Inject(AI_SERVICE) private readonly ai: AiService | null = null,
    /** Log profil latensi per giliran (P14-07); opsional supaya tes lama tidak berubah. */
    @Optional() private readonly logger: Logger | null = null,
    /** Pengetahuan perusahaan (Fase 16); tanpa ini pertanyaan perusahaan dijawab teks tetap. */
    @Optional() private readonly company: CompanyKnowledgeService | null = null,
  ) {}

  /**
   * Memproses satu pesan pengguna dan mengembalikan event untuk dialirkan.
   * `now` disuntikkan demi determinisme pengujian.
   */
  async handle(
    conversationId: string,
    actor: ConversationOwner,
    text: string,
    now: string,
    emit?: EventSink,
  ): Promise<readonly AssistantStreamEvent[]> {
    // Kepemilikan diperiksa di lapisan application (docs/SECURITY.md §4).
    const row = await this.conversations.find(conversationId, actor);
    await this.conversations.appendUserMessage(conversationId, actor, text);

    // Judul dari pesan pertama: potongan pesannya dipasang SEKARANG (instan), lalu model
    // memperhalusnya di latar — judul tidak boleh menahan jawaban (di CPU, satu panggilan
    // judul pernah 57 detik rata-rata). Riwayat memuat ulang setelah giliran selesai, jadi
    // judul model terlihat paling lambat pada pembukaan berikutnya.
    if (row.title === null || row.title === undefined) {
      await this.conversations.rename(conversationId, actor, fallbackTitle(text));
      this.refineTitleInBackground(conversationId, actor, text, row.language);
    }

    const messageId = ulid();

    if (!this.ai) return llmUnavailable(messageId);

    try {
      return await this.answer(conversationId, actor, text, now, messageId, emit, row.language);
    } catch (error) {
      // Model terkonfigurasi tetapi tidak terjangkau (kunci ditolak, limit habis,
      // jaringan): nasibnya sama dengan "tanpa model" — jujur lewat event
      // LLM_UNAVAILABLE yang retryable, bukan 503 generik yang membatalkan giliran.
      if (error instanceof LlmUnavailableError) return llmUnavailable(messageId);
      throw error;
    }
  }

  private async answer(
    conversationId: string,
    actor: ConversationOwner,
    text: string,
    now: string,
    messageId: string,
    emit?: EventSink,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<readonly AssistantStreamEvent[]> {
    const ai = this.ai!;
    // Instrumentasi tahap (P14-07): waktu per tahap giliran, bukan hanya per panggilan model
    // (`llm_calls`). Dicatat ke log terstruktur supaya profil latensi bisa dibaca dari produksi.
    const timer = stageTimer();
    // Giliran dimulai SEKARANG di mata klien — bukan setelah klasifikasi intent (5–30 s di CPU).
    emit?.({ type: 'message.start', messageId });
    const snapshot = await this.store.current(conversationId);
    const state = snapshot?.state ?? emptyRequirementState(now);
    const hasExisting = (snapshot?.state.completeness.filled ?? 0) > 0;

    // Giliran terakhir dipakai klasifikasi intent (lanjutan vs pesan lepas), penulis
    // balasan, dan pagar anti-ulang — jadi selalu diambil.
    const recentTurns = await this.recentTurns(conversationId, actor);
    // Percakapan kasus teknis yang sedang berjalan: jawaban angka ("jaraknya 150 m") adalah
    // lanjutan kebutuhan — tanpa menunggu model menebaknya. Bentuk yang PASTI lain (produk,
    // pesaing, sapaan) tetap lewat router, yang juga memotongnya tanpa model.
    const continuation =
      state.useCase?.kind === 'technical' && certainIntent(text) === null
        ? ({
            intent: 'REQUIREMENT_STATEMENT',
            confidence: 1,
            shouldExtract: true,
            mutatesState: true,
          } satisfies RoutingDecision)
        : null;
    timer.mark('load');
    const decision =
      continuation ?? (await this.router.route(text, hasExisting, recentTurns, state.subject));
    timer.mark('route');

    // Pertanyaan perusahaan (Fase 16): ruas sendiri — pengetahuan perusahaan, bukan katalog;
    // subjeknya tersimpan supaya "boleh"/"lengkap dong" berikutnya tetap tentang perusahaan.
    if (decision.intent === 'COMPANY_QUESTION') {
      const result = await runCompanyQuestion(this.company ?? NO_COMPANY_KNOWLEDGE, {
        messageId,
        message: text,
        subject: state.subject,
        locale,
      });
      timer.mark('answer');
      await this.rememberSubject(conversationId, state, result.subject);
      await this.conversations.appendAssistantMessage(
        conversationId,
        textOf(result.events),
        cardsOf(result.events),
        null,
      );
      timer.mark('persist');
      this.logTurn(conversationId, decision, timer);
      return result.events;
    }

    // Pertanyaan produk: ruas sendiri, nol ekstraksi, jawaban dari katalog.
    if (decision.intent === 'PRODUCT_LOOKUP') {
      const events = await runProductQuestion(
        ai,
        this.catalog,
        this.productQuestions,
        { messageId, message: text, recentTurns, locale },
        this.reply,
        // Baku nonaktif: teks deterministiknya utuh; model 7B hampir selalu ditolak pagar
        // struktur — satu menit untuk hasil yang dibuang (env LLM_FAQ_REWRITE).
        loadEnv().LLM_FAQ_REWRITE ? productFaqSystemPrompt(locale) : null,
      );
      timer.mark('answer');
      // Subjek berganti ke produk yang disebut — pergantian topik yang disengaja pengguna.
      await this.rememberSubject(
        conversationId,
        state,
        productSubject(heuristicProductQuestion(text).productQuery, text, state.subject),
      );
      await this.conversations.appendAssistantMessage(
        conversationId,
        textOf(events),
        cardsOf(events),
        null,
      );
      timer.mark('persist');
      this.logTurn(conversationId, decision, timer);
      return events;
    }

    const result = await runUnderstanding(
      ai,
      {
        messageId,
        message: text,
        decision,
        state,
        now,
        recentTurns,
        locale,
        ...(emit ? { emit: withoutFirstStart(emit) } : {}),
      },
      this.reply,
    );
    timer.mark('answer');

    if (result.changed) {
      // Kebutuhan yang berubah menjadikan kasusnya subjek aktif: "lanjut" setelah ini berarti
      // melanjutkan kebutuhan, bukan kembali ke pertanyaan perusahaan/produk sebelumnya.
      await this.store.append(
        conversationId,
        { ...result.nextState, subject: caseSubject(result.nextState) },
        result.trigger,
      );
    }

    await this.conversations.appendAssistantMessage(
      conversationId,
      textOf(result.events),
      cardsOf(result.events),
      null,
    );
    timer.mark('persist');
    this.logTurn(conversationId, decision, timer);

    return result.events;
  }

  /**
   * Menyimpan subjek percakapan bila berubah — snapshot `subject_change` tanpa menyentuh
   * kebutuhan. Subjek yang sama tidak menulis apa pun.
   */
  private async rememberSubject(
    conversationId: string,
    state: RequirementState,
    subject: ConversationSubject,
  ): Promise<void> {
    if (JSON.stringify(state.subject) === JSON.stringify(subject)) return;
    await this.store.append(conversationId, { ...state, subject }, 'subject_change');
  }

  /** Profil latensi satu giliran: `{ load, route, answer, persist, total }` dalam ms. */
  private logTurn(conversationId: string, decision: RoutingDecision, timer: StageTimer): void {
    this.logger?.info(
      {
        conversationId,
        intent: decision.intent,
        confidence: decision.confidence,
        ms: timer.report(),
      },
      'giliran pesan',
    );
  }

  /** Judul model menggantikan potongan pesan bila datang; kegagalan apa pun diabaikan. */
  private refineTitleInBackground(
    conversationId: string,
    actor: ConversationOwner,
    firstMessage: string,
    locale: Locale,
  ): void {
    if (!this.ai) return;
    const ai = this.ai;
    void (async () => {
      try {
        const title = (await ai.titleFor(firstMessage, locale)).trim();
        // Model kecil kadang memuntahkan token lintas aksara ("konsultasi pipaحوا incenter");
        // judul seperti itu lebih buruk daripada potongan pesan — dibuang, bukan dipasang.
        if (isSaneTitle(title)) await this.conversations.rename(conversationId, actor, title);
      } catch {
        // Judul tidak sepadan dengan menggagalkan apa pun — potongan pesan sudah terpasang.
      }
    })();
  }

  /**
   * Edit inline panel kanan (docs/API_CONTRACTS.md §3): **nol panggilan LLM**. Nilai yang
   * diketik pengguna masuk sebagai `user_edited` — presedensi tertinggi — lewat merger yang
   * sama dengan ekstraksi, lalu disimpan sebagai snapshot `user_edit`. Bila tidak ada yang
   * berubah, tidak ada snapshot baru. Hitung ulang solusi bukan urusan rute ini: klien
   * memanggil `/analyze` lagi, karena itulah satu-satunya jalur yang menghasilkan trace.
   */
  async edit(
    conversationId: string,
    actor: ConversationOwner,
    edits: ReadonlyArray<{ readonly path: RequirementFieldPath; readonly value: unknown }>,
    now: string,
  ): Promise<RequirementState> {
    await this.conversations.find(conversationId, actor);
    const snapshot = await this.store.current(conversationId);
    const result = applyEdit(snapshot?.state ?? emptyRequirementState(now), edits, now);
    if (result.changed) await this.store.append(conversationId, result.state, 'user_edit');
    return result.state;
  }

  /**
   * Jawaban kartu klarifikasi — SEMUA pertanyaan dijawab lalu dikirim sekali (keputusan
   * pemilik 2026-10-06: jawaban ditampung, bukan satu giliran per chip). **Nol panggilan
   * LLM**: label chip kita yang membuat, nilainya domain yang tahu (`answerToUpdate`).
   * "Belum tahu" memakai default ASSUMED bila ada. Percakapan tetap koheren: satu gelembung
   * pengguna berisi ringkasan jawaban, satu gelembung asisten berisi kartu lanjutan yang
   * sama seperti setelah ekstraksi (`followUpCard`).
   */
  async answerClarification(
    conversationId: string,
    actor: ConversationOwner,
    answers: readonly ClarificationAnswer[],
    now: string,
  ): Promise<{ state: RequirementState; userText: string; card: AssistantCard | null }> {
    const conversation = await this.conversations.find(conversationId, actor);
    const snapshot = await this.store.current(conversationId);
    const state = snapshot?.state ?? emptyRequirementState(now);

    // Jawaban irigasi (`irrigation.*`) masuk ke jalur gunanya; sisanya ke merger kebutuhan.
    const irrigation: Partial<Record<IrrigationField, string>> = {};
    for (const answer of answers) {
      if (!isIrrigationField(answer.id)) continue;
      const value = irrigationAnswerValue(answer.id, answer.option);
      if (value !== null) irrigation[answer.id] = value;
    }
    const applied = applyIrrigationAnswers(state, irrigation);
    const afterIrrigation = Object.keys(irrigation).length > 0 ? applied.state : state;

    // Jawaban kasus teknis (id = kunci parameter universal) masuk ke parameter kasusnya.
    const technicalAnswers =
      afterIrrigation.useCase?.kind === 'technical'
        ? answers
            .map((answer) => technicalAnswerValue(answer.id, answer.option))
            .filter((value): value is NonNullable<typeof value> => value !== null)
        : [];
    const technical = applyTechnicalAnswers(afterIrrigation, technicalAnswers);
    const base = technical.state;

    const updates = answers
      .filter((answer) => !isIrrigationField(answer.id))
      .filter((answer) => !technicalAnswers.some((t) => t.key === answer.id))
      .map((answer) => answerToUpdate(answer, defaultUpdateFor))
      .filter((update): update is NonNullable<typeof update> => update !== null);
    const result = mergeRequirement(base, updates, now);
    const merged = withCompleteness(result.state);
    if (
      result.changed.length > 0 ||
      (Object.keys(irrigation).length > 0 && applied.changed) ||
      technical.changed
    ) {
      await this.store.append(conversationId, merged, 'clarification_answer');
    }

    const userText = summarizeAnswers(answers, conversation.language);
    await this.conversations.appendUserMessage(conversationId, actor, userText);
    const card = followUpCard(merged, conversation.language);
    await this.conversations.appendAssistantMessage(conversationId, '', card ? [card] : [], null);
    return { state: merged, userText, card };
  }

  /**
   * State kebutuhan terkini sebuah percakapan — untuk mengisi ulang panel saat riwayat
   * dibuka kembali. Kepemilikan diperiksa lewat `conversations.find` (NOT_FOUND bila
   * bukan milik aktor, sama seperti rute lain).
   */
  async requirement(
    conversationId: string,
    actor: ConversationOwner,
  ): Promise<RequirementState | null> {
    await this.conversations.find(conversationId, actor);
    const snapshot = await this.store.current(conversationId);
    return snapshot?.state ?? null;
  }

  /**
   * Enam giliran terakhir sebelum pesan yang sedang dijawab (pesan itu sendiri sudah
   * tersimpan, jadi dibuang), hanya yang bertext — kartu tanpa teks tidak membantu model.
   */
  private async recentTurns(
    conversationId: string,
    actor: ConversationOwner,
  ): Promise<readonly ReplyTurn[]> {
    const rows = await this.conversations.messages(conversationId, actor);
    return rows
      .slice(0, -1)
      .filter((row) => row.text.trim() !== '' && (row.role === 'user' || row.role === 'assistant'))
      .slice(-6)
      .map((row) => ({ role: row.role as ReplyTurn['role'], text: row.text }));
  }
}

function fallbackTitle(firstMessage: string): string {
  return firstMessage.trim().replace(/\s+/g, ' ').slice(0, 60);
}

/** 2–10 kata, aksara Latin saja, tanpa tanda kutip — bentuk yang diminta TITLE_SYSTEM_PROMPT. */
export function isSaneTitle(title: string): boolean {
  if (title.length < 3 || title.length > 80) return false;
  if (!/^[\p{Script=Latin}\p{N}\s,.\-–—/()&]+$/u.test(title)) return false;
  const words = title.split(/\s+/).filter((w) => w.length > 0);
  return words.length >= 2 && words.length <= 10;
}

/**
 * `message.start` sudah dikirim service sebelum routing (supaya klien tahu giliran dimulai
 * sebelum 5–30 detik klasifikasi intent); pipeline tetap menaruhnya di array hasil, tetapi
 * salinannya tidak boleh dikirim dua kali.
 */
function withoutFirstStart(emit: EventSink): EventSink {
  let skipped = false;
  return (event) => {
    if (!skipped && event.type === 'message.start') {
      skipped = true;
      return;
    }
    emit(event);
  };
}

/** Tanpa layanan perusahaan (tes lama, modul belum terpasang): bagian statis saja, tanpa katalog. */
const NO_COMPANY_KNOWLEDGE: Pick<CompanyKnowledgeService, 'answer'> = {
  answer: (question) =>
    Promise.resolve(
      composeCompanyAnswer({
        facts: { sections: SECTIONS, productFamilies: new Map() },
        ...question,
      }),
    ),
};

/** Subjek KASUS dari kebutuhan yang tercatat: jalur guna khusus bila ada, selain itu bangunan. */
function caseSubject(state: RequirementState): ConversationSubject {
  const entity =
    state.useCase?.kind === 'technical'
      ? state.useCase.caseId
      : state.useCase?.kind === 'irrigation'
        ? 'irrigation'
        : 'building';
  return { kind: 'case', entity, topic: 'requirement', depth: 'standard' };
}

function llmUnavailable(messageId: string): readonly AssistantStreamEvent[] {
  return [
    { type: 'message.start', messageId },
    { type: 'error', code: 'LLM_UNAVAILABLE', retryable: true },
    { type: 'message.end', messageId, usage: { in: 0, out: 0, costUsd: 0 } },
  ];
}

function cardsOf(events: readonly AssistantStreamEvent[]) {
  return events
    .filter((e): e is Extract<AssistantStreamEvent, { type: 'card' }> => e.type === 'card')
    .map((e) => e.card);
}

function textOf(events: readonly AssistantStreamEvent[]): string {
  return events
    .filter((e): e is Extract<AssistantStreamEvent, { type: 'token' }> => e.type === 'token')
    .map((e) => e.text)
    .join('');
}
