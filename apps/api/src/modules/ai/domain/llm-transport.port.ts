/**
 * Port transport LLM — lapisan tipis yang benar-benar melakukan panggilan jaringan.
 *
 * Dipisah dari `AiService` dengan sengaja: adapter (bangun prompt, validasi, retry,
 * catat biaya) bisa diuji penuh dengan transport palsu, tanpa jaringan maupun kunci.
 * Hanya `OpenRouterTransport` yang benar-benar menyentuh HTTP.
 */

export const LLM_TRANSPORT = Symbol('LLM_TRANSPORT');

export interface LlmMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export interface LlmCompletionRequest {
  readonly model: string;
  readonly messages: readonly LlmMessage[];
  /** Minta keluaran JSON bila didukung model. */
  readonly jsonMode: boolean;
}

export interface LlmCompletionResult {
  readonly content: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** Biaya USD bila provider melaporkannya; jika tidak, 0. */
  readonly costUsd: number;
}

export interface LlmTransport {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
