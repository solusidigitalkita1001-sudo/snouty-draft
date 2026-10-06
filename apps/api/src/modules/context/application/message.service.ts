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
  AssistantStreamEvent,
  RequirementFieldPath,
  RequirementState,
} from '@snouty/shared-types';
import { AI_SERVICE, type AiService } from '../../ai/domain/ai.port.js';
import { LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import { PRODUCT_FAQ_SYSTEM_PROMPT } from '../../ai/application/prompts.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { ProductQuestionService } from '../../product-knowledge/application/product-question.service.js';
import { IntentRouter } from './intent-router.js';
import { applyEdit, runUnderstanding } from './message-pipeline.js';
import { runProductQuestion } from './product-question-pipeline.js';
import { ReplyWriter, type ReplyTurn } from './reply-writer.js';
import { RequirementSnapshotStore } from './requirement-snapshot.store.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { ulid } from '../../../shared/ulid.js';

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
  ): Promise<readonly AssistantStreamEvent[]> {
    // Kepemilikan diperiksa di lapisan application (docs/SECURITY.md §4).
    const row = await this.conversations.find(conversationId, actor);
    await this.conversations.appendUserMessage(conversationId, actor, text);

    // Judul dari pesan pertama (tingkat cepat); tanpa model, potongan pesannya sendiri.
    // Sebelumnya tidak pernah diset — setiap item riwayat berjudul "Konsultasi baru".
    if (row.title === null || row.title === undefined) {
      await this.conversations.rename(conversationId, actor, await this.titleFor(text));
    }

    const messageId = ulid();

    if (!this.ai) return llmUnavailable(messageId);

    try {
      return await this.answer(conversationId, actor, text, now, messageId);
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
  ): Promise<readonly AssistantStreamEvent[]> {
    const ai = this.ai!;
    const snapshot = await this.store.current(conversationId);
    const state = snapshot?.state ?? emptyRequirementState(now);
    const hasExisting = (snapshot?.state.completeness.filled ?? 0) > 0;

    // Giliran terakhir dipakai klasifikasi intent (lanjutan vs pesan lepas), penulis
    // balasan, dan pagar anti-ulang — jadi selalu diambil.
    const recentTurns = await this.recentTurns(conversationId, actor);
    const decision = await this.router.route(text, hasExisting, recentTurns);

    // Pertanyaan produk: ruas sendiri, nol ekstraksi, jawaban dari katalog.
    if (decision.intent === 'PRODUCT_LOOKUP') {
      const events = await runProductQuestion(
        ai,
        this.catalog,
        this.productQuestions,
        { messageId, message: text, recentTurns },
        this.reply,
        PRODUCT_FAQ_SYSTEM_PROMPT,
      );
      await this.conversations.appendAssistantMessage(
        conversationId,
        textOf(events),
        cardsOf(events),
        null,
      );
      return events;
    }

    const result = await runUnderstanding(
      ai,
      { messageId, message: text, decision, state, now, recentTurns },
      this.reply,
    );

    if (result.changed) {
      await this.store.append(conversationId, result.nextState, result.trigger);
    }

    await this.conversations.appendAssistantMessage(
      conversationId,
      textOf(result.events),
      cardsOf(result.events),
      null,
    );

    return result.events;
  }

  private async titleFor(firstMessage: string): Promise<string> {
    const fallback = firstMessage.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!this.ai) return fallback;
    try {
      const title = (await this.ai.titleFor(firstMessage)).trim();
      return title === '' ? fallback : title;
    } catch {
      // Judul tidak sepadan dengan menggagalkan giliran — potongan pesan sudah cukup.
      return fallback;
    }
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
