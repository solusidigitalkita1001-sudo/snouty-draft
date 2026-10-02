/**
 * Perekam audit biaya LLM. docs/AI_BEHAVIOR.md · docs/PRIVACY.md.
 *
 * Bentuk `LlmCallRecord` SENGAJA tidak punya field untuk isi prompt — tidak bisa
 * merekam apa yang tidak ada. Itulah yang membuat janji "isi prompt tidak disimpan"
 * struktural, bukan sekadar kehati-hatian pemanggil.
 */

import type { LlmTier } from './model-routing.js';

export const LLM_CALL_RECORDER = Symbol('LLM_CALL_RECORDER');

export type LlmCallOutcome = 'success' | 'validation_failed' | 'error';

export interface LlmCallRecord {
  readonly task: string;
  readonly tier: LlmTier;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsd: number;
  readonly latencyMs: number;
  readonly outcome: LlmCallOutcome;
  readonly correlationId: string | null;
}

export interface LlmCallRecorder {
  record(record: LlmCallRecord): Promise<void>;
}
