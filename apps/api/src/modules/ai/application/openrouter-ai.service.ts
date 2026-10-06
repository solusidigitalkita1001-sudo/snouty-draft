/**
 * Adapter AI di atas OpenRouter. docs/AI_BEHAVIOR.md.
 *
 * Logika yang menentukan hidup di sini dan diuji dengan transport palsu:
 *
 *   - **Routing:** tugas → tingkat (murni) → ID model lewat env. ID tak di kode.
 *   - **Retry sekali, lalu berhenti.** Keluaran tak valid → ulangi **sekali** di
 *     tingkat `strong` dengan pesan error dilampirkan → masih gagal → **lempar**.
 *     Tidak pernah ada percobaan ketiga, tidak pernah keluaran tak tervalidasi
 *     diteruskan ke engine. Pemanggil menangkap lemparan ini dan jatuh ke
 *     pertanyaan klarifikasi.
 *   - **Audit biaya tiap percobaan** ke `llm_calls` — tanpa isi prompt.
 *
 * Hanya transport yang menyentuh jaringan; adapter ini tidak tahu soal HTTP.
 */

import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { loadEnv } from '../../../config/env.js';
import {
  ExtractionSchema,
  IntentSchema,
  ProductQuestionSchema,
  type ProductQuestionParse,
  type Extraction,
  type IntentClassification,
} from '../domain/extraction-schema.js';
import type { AiService, IntentInput } from '../domain/ai.port.js';
import {
  LLM_CALL_RECORDER,
  type LlmCallOutcome,
  type LlmCallRecorder,
} from '../domain/llm-call.recorder.js';
import {
  LLM_TRANSPORT,
  LlmAbortedError,
  type LlmMessage,
  type LlmTransport,
} from '../domain/llm-transport.port.js';
import { TIER_ENV_KEY, tierForTask, type LlmTask, type LlmTier } from '../domain/model-routing.js';
import { AiOutputInvalidError, LlmUnavailableError } from '../domain/ai.errors.js';
import { certainIntent, heuristicProductQuestion } from '../domain/heuristics.js';
import {
  EXTRACTION_SYSTEM_PROMPT,
  INTENT_SYSTEM_PROMPT,
  PRODUCT_QUESTION_SYSTEM_PROMPT,
  TITLE_SYSTEM_PROMPT,
} from './prompts.js';

/** Konteks per permintaan — correlation ID mengalir ke audit biaya. */
export interface AiCallContext {
  readonly correlationId: string | null;
}

@Injectable()
export class OpenRouterAiService implements AiService {
  constructor(
    @Inject(LLM_TRANSPORT) private readonly transport: LlmTransport,
    @Inject(LLM_CALL_RECORDER) private readonly recorder: LlmCallRecorder,
    /** Jam disuntikkan demi latensi yang terukur dan dapat diuji. */
    private readonly clock: () => number = Date.now,
  ) {}

  async extract(
    message: string,
    context: AiCallContext = { correlationId: null },
  ): Promise<Extraction> {
    return this.callStructured(
      'extraction',
      ExtractionSchema,
      EXTRACTION_SYSTEM_PROMPT,
      message,
      context,
    );
  }

  async classifyIntent(
    input: IntentInput,
    context: AiCallContext = { correlationId: null },
  ): Promise<IntentClassification> {
    // Jalur cepat untuk bentuk yang pasti (sapaan, merek pesaing, konsep produk): nol
    // panggilan model — di CPU, satu panggilan adalah 10–30 detik (domain/heuristics.ts).
    const certain = certainIntent(input.message);
    if (certain) return certain;

    const history = (input.recentTurns ?? [])
      .slice(-4)
      .map((t) => `${t.role === 'user' ? 'Pengguna' : 'SNOUTY'}: ${t.text.slice(0, 300)}`)
      .join('\n');
    const user = [
      `hasExistingRequirements=${input.hasExistingRequirements}`,
      history === '' ? '' : `PERCAKAPAN SEBELUMNYA (tertua dulu):\n${history}`,
      `PESAN SEKARANG: ${input.message}`,
    ]
      .filter((part) => part !== '')
      .join('\n\n');
    return this.callStructured(
      'intent_classification',
      IntentSchema,
      INTENT_SYSTEM_PROMPT,
      user,
      context,
    );
  }

  async parseProductQuestion(
    message: string,
    context: AiCallContext = { correlationId: null },
  ): Promise<ProductQuestionParse> {
    // Keluarga produk yang tersurat (PVC, HDPE, …) dipetakan dari bentuk kalimat; model hanya
    // untuk kalimat yang tidak menyebutnya secara eksplisit (domain/heuristics.ts).
    const heuristic = heuristicProductQuestion(message);
    if (heuristic.productQuery !== null) return ProductQuestionSchema.parse(heuristic);

    return this.callStructured(
      'product_question',
      ProductQuestionSchema,
      PRODUCT_QUESTION_SYSTEM_PROMPT,
      message,
      context,
    );
  }

  async titleFor(
    firstMessage: string,
    context: AiCallContext = { correlationId: null },
  ): Promise<string> {
    const result = await this.bounded((signal) =>
      this.callOnce(
        'conversation_title',
        tierForTask('conversation_title'),
        TITLE_SYSTEM_PROMPT,
        firstMessage,
        false,
        context,
        undefined,
        signal,
      ),
    );
    return result.content.trim().slice(0, 160);
  }

  /**
   * Prosa penjelas. Sengaja **tidak** lewat `callStructured`, meski ia pun keluaran
   * JSON: skemanya milik pemanggil, dan percobaan ulangnya diatur REC-1 di perakitan
   * rekomendasi. Dua lapis retry berarti empat percobaan dari dua tempat yang tidak
   * saling tahu — dan yang kedua tidak akan pernah tahu alasan sebenarnya sebuah
   * prosa ditolak, yaitu angka asing.
   *
   * Yang tetap dilakukan di sini: routing tingkat dan audit biaya ke `llm_calls`.
   */
  async writeProse(
    input: {
      readonly systemPrompt: string;
      readonly userMessage: string;
      readonly timeoutMs?: number;
    },
    context: AiCallContext = { correlationId: null },
  ): Promise<unknown> {
    const controller = input.timeoutMs ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : null;
    try {
      const result = await this.callOnce(
        'explanation_prose',
        tierForTask('explanation_prose'),
        input.systemPrompt,
        input.userMessage,
        true,
        context,
        undefined,
        controller?.signal,
      );
      return safeJson(result.content);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Satu panggilan terstruktur dengan retry sekali. `retryTask` naik ke tingkat
   * `strong`; pesan error dari percobaan pertama dilampirkan supaya model tahu apa
   * yang harus diperbaiki.
   */
  private async callStructured<T>(
    task: LlmTask,
    schema: z.ZodType<T>,
    systemPrompt: string,
    userMessage: string,
    context: AiCallContext,
  ): Promise<T> {
    // Skema yang memvalidasi keluaran juga DIKIRIM ke model. Sebelumnya prompt hanya
    // berkata "sesuai skema" tanpa pernah menyebutkan skemanya — model harus menebak
    // nama field dan label, lalu gagal validasi. Satu sumber untuk keduanya.
    const system = `${systemPrompt}\n\nSkema JSON keluaran (wajib persis, tanpa field lain):\n${JSON.stringify(z.toJSONSchema(schema))}`;

    // Setiap percobaan dibatasi waktu (LLM_CALL_TIMEOUT_MS). Percobaan pertama yang lewat batas
    // = model tidak terjangkau (giliran jujur, retryable); percobaan ulang yang lewat batas =
    // keluaran tidak valid (pemanggil jatuh ke klarifikasi). Keduanya lebih baik daripada
    // menggantung — satu percobaan ulang pernah 524 detik di laptop yang kehabisan RAM.
    let first;
    try {
      first = await this.bounded((signal) =>
        this.callOnce(
          task,
          tierForTask(task),
          system,
          userMessage,
          true,
          context,
          undefined,
          signal,
        ),
      );
    } catch (error) {
      if (error instanceof LlmAbortedError) throw new LlmUnavailableError(null);
      throw error;
    }
    const parsedFirst = schema.safeParse(safeJson(first.content));
    if (parsedFirst.success) return parsedFirst.data;

    // Percobaan kedua dan TERAKHIR — tingkat kuat, error dilampirkan.
    const retryUser = `${userMessage}\n\n[Keluaran sebelumnya tidak valid: ${parsedFirst.error.message}. Kembalikan JSON yang sesuai skema.]`;
    let second;
    try {
      second = await this.bounded((signal) =>
        this.callOnce(
          'extraction_retry',
          'strong',
          system,
          retryUser,
          true,
          context,
          'validation_failed',
          signal,
        ),
      );
    } catch (error) {
      if (error instanceof LlmAbortedError) {
        throw new AiOutputInvalidError(task, 'percobaan ulang melewati batas waktu');
      }
      throw error;
    }
    const parsedSecond = schema.safeParse(safeJson(second.content));
    if (parsedSecond.success) return parsedSecond.data;

    // Tidak ada percobaan ketiga. Pemanggil jatuh ke klarifikasi.
    throw new AiOutputInvalidError(task, parsedSecond.error.message);
  }

  /** Menjalankan satu panggilan dengan batas waktu `LLM_CALL_TIMEOUT_MS`; lewat → `LlmAbortedError`. */
  private async bounded<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), loadEnv().LLM_CALL_TIMEOUT_MS);
    try {
      return await run(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private async callOnce(
    task: LlmTask,
    tier: LlmTier,
    systemPrompt: string,
    userMessage: string,
    jsonMode: boolean,
    context: AiCallContext,
    priorOutcome?: LlmCallOutcome,
    signal?: AbortSignal,
  ): Promise<{ content: string }> {
    const model = this.modelFor(tier);
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const started = this.clock();
    try {
      const result = await this.transport.complete({
        model,
        messages,
        jsonMode,
        ...(signal ? { signal } : {}),
      });
      await this.safeRecord({
        task,
        tier,
        model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costUsd: result.costUsd,
        latencyMs: this.clock() - started,
        outcome: priorOutcome ?? 'success',
        correlationId: context.correlationId,
      });
      return { content: result.content };
    } catch (error) {
      await this.safeRecord({
        task,
        tier,
        model,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: this.clock() - started,
        outcome: 'error',
        correlationId: context.correlationId,
      });
      throw error;
    }
  }

  private modelFor(tier: LlmTier): string {
    const env = loadEnv();
    const key = TIER_ENV_KEY[tier] as keyof typeof env;
    const model = env[key];
    if (!model || typeof model !== 'string') {
      throw new Error(`model untuk tingkat '${tier}' belum dikonfigurasi (${TIER_ENV_KEY[tier]})`);
    }
    return model;
  }

  /** Audit biaya tidak boleh menjatuhkan permintaan yang berhasil. */
  private async safeRecord(record: Parameters<LlmCallRecorder['record']>[0]): Promise<void> {
    try {
      await this.recorder.record(record);
    } catch {
      // Kehilangan satu baris audit biaya tidak sepadan dengan menggagalkan balasan.
    }
  }
}

function safeJson(raw: string): unknown {
  try {
    return withoutNulls(JSON.parse(raw));
  } catch {
    return raw; // biarkan zod menolaknya — error-nya lebih informatif
  }
}

/**
 * `null` dari model berarti "tidak disebut" — sama dengan field yang dihilangkan.
 *
 * Skema ekstraksi memakai `optional()` dan menolak `null` (lihat `extraction-schema.ts`);
 * prompt sudah meminta field yang tidak disebut dihilangkan, tetapi model kecil (qwen2.5 7B
 * di server, 2026-10-06) tetap menulis `null` untuk setiap field yang ia tidak tahu, lalu
 * dua percobaan gagal validasi dan tahap pemahaman gugur — padahal isinya benar. Membuang
 * properti bernilai `null` sebelum validasi menyamakan keduanya tanpa melonggarkan skema:
 * `null` di dalam array dibiarkan (bukan "tidak disebut"), dan nilai lain tidak disentuh.
 */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value === null || typeof value !== 'object') return value;
  const kept: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (inner !== null) kept[key] = withoutNulls(inner);
  }
  return kept;
}
