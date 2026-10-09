/**
 * Transport OpenRouter — satu-satunya bagian `ai` yang menyentuh jaringan.
 * docs/AI_BEHAVIOR.md. Digerbang keberadaan `OPENROUTER_API_KEY`: tanpa kunci,
 * provider ini tidak terdaftar (lihat modul), dan sistem memakai jalur
 * deterministik/klarifikasi.
 */

import { Injectable } from '@nestjs/common';
import { loadEnv } from '../../../config/env.js';
import { LlmUnavailableError } from '../domain/ai.errors.js';
import {
  LlmAbortedError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmTransport,
} from '../domain/llm-transport.port.js';

interface OpenRouterChoice {
  message?: { content?: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
}

@Injectable()
export class OpenRouterTransport implements LlmTransport {
  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const env = loadEnv();
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY tidak diset — transport live tidak boleh dipanggil');
    }

    let response: Response;
    try {
      response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          ...(env.LLM_REASONING_EFFORT ? { reasoning_effort: env.LLM_REASONING_EFFORT } : {}),
        }),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      // Dibatalkan pemanggil (batas waktu): bukan "model tidak terjangkau".
      if (request.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new LlmAbortedError();
      }
      // Jaringan putus / DNS gagal: tidak ada respons sama sekali.
      throw new LlmUnavailableError(null);
    }

    if (!response.ok) {
      // Kunci ditolak (401/403), limit habis (402/429), penyedia tumbang (5xx): semuanya
      // "model tidak terjangkau" bagi pengguna. Status disimpan untuk log; pesan aman.
      // Sebelumnya ini `Error('OpenRouter 403')` polos — dan filter memetakannya ke 503
      // SERVICE_UNAVAILABLE generik, bukan LLM_UNAVAILABLE yang dijanjikan kontrak.
      throw new LlmUnavailableError(response.status);
    }

    const body = (await response.json()) as OpenRouterResponse;
    return {
      content: body.choices?.[0]?.message?.content ?? '',
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      costUsd: body.usage?.cost ?? 0,
    };
  }
}
