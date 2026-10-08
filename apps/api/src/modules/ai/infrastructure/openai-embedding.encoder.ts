/**
 * Penyandi teks lewat endpoint `/embeddings` yang kompatibel OpenAI — Ollama (`bge-m3`,
 * `nomic-embed-text`) maupun OpenRouter melayaninya dengan bentuk yang sama.
 *
 * Model embedding kecil (±0,5 miliar parameter) menyandikan satu kalimat dalam puluhan
 * milidetik di CPU, dan Ollama menjalankannya di runner terpisah dari model generatif —
 * tidak ikut antre di belakang generasi 7B yang berjalan.
 */
import { loadEnv } from '../../../config/env.js';
import { LlmUnavailableError } from '../domain/ai.errors.js';
import type { TextEncoder } from '../domain/text-encoder.port.js';

interface EmbeddingResponse {
  data?: { index?: number; embedding?: number[] }[];
}

const BATCH = 32;

export class OpenAiEmbeddingEncoder implements TextEncoder {
  constructor(readonly id: string) {}

  async encode(texts: readonly string[]): Promise<readonly Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      out.push(...(await this.encodeBatch(texts.slice(i, i + BATCH))));
    }
    return out;
  }

  private async encodeBatch(texts: readonly string[]): Promise<Float32Array[]> {
    const env = loadEnv();
    let response: Response;
    try {
      response = await fetch(`${env.OPENROUTER_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.OPENROUTER_API_KEY ?? ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: this.id, input: texts }),
        signal: AbortSignal.timeout(env.LLM_CALL_TIMEOUT_MS),
      });
    } catch {
      throw new LlmUnavailableError(null);
    }
    if (!response.ok) throw new LlmUnavailableError(response.status);

    const body = (await response.json()) as EmbeddingResponse;
    const rows = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (rows.length !== texts.length) throw new LlmUnavailableError(null);
    return rows.map((row) => normalized(row.embedding ?? []));
  }
}

function normalized(values: readonly number[]): Float32Array {
  const vector = Float32Array.from(values);
  let sum = 0;
  for (const v of vector) sum += v * v;
  const length = Math.sqrt(sum);
  if (length > 0) for (let i = 0; i < vector.length; i += 1) vector[i] = vector[i]! / length;
  return vector;
}
