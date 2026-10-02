/**
 * Transport OpenRouter — satu-satunya bagian `ai` yang menyentuh jaringan.
 * docs/AI_BEHAVIOR.md. Digerbang keberadaan `OPENROUTER_API_KEY`: tanpa kunci,
 * provider ini tidak terdaftar (lihat modul), dan sistem memakai jalur
 * deterministik/klarifikasi.
 */

import { Injectable } from '@nestjs/common';
import { loadEnv } from '../../../config/env.js';
import type {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmTransport,
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

    const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      // Pesan aman; detail tetap di server lewat log pemanggil.
      throw new Error(`OpenRouter ${response.status}`);
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
