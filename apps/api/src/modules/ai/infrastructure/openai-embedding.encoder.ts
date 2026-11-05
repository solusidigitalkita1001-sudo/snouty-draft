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

/**
 * Dua, bukan tiga puluh dua.
 *
 * Batch TIDAK memberi keuntungan apa pun di sini: diukur pada bge-m3 lokal, biaya per kalimat
 * rata ~40 ms untuk ukuran 2, 4, 8, 16, dan 32 — penyandi ini mengerjakannya satu per satu di
 * balik layar. Yang ada hanyalah risikonya. Di server produksi (ollama-embed, `cpus: 1.5`,
 * `OLLAMA_NUM_PARALLEL=4`) biaya per kalimat melonjak tepat di ukuran 4: 1 → 0,33 s, 2 → 0,44 s,
 * lalu 4 → 45 s, 8 → 120 s, 32 → 146 s. Satu permintaan sebesar itu menembus
 * `LLM_CALL_TIMEOUT_MS`, dan karena pemanasan menyandikan contoh BARU dalam satu batch, setiap
 * penambahan contoh membuat pemahaman mati total sampai batch itu berhasil — yang tidak pernah
 * terjadi (produksi 2026-11-05, rilis P35: tiga giliran berturut-turut dijawab "giliran ini
 * kehabisan waktu").
 *
 * Dengan dua, permintaan terlama yang pernah diukur di server itu 0,44 detik.
 */
const BATCH = 2;

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
    // Alamat embedding terpisah: kunci penyedia chat tidak dikirim ke endpoint lain.
    const baseUrl = env.EMBEDDING_BASE_URL ?? env.OPENROUTER_BASE_URL;
    const key = env.EMBEDDING_BASE_URL ? env.EMBEDDING_API_KEY : env.OPENROUTER_API_KEY;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Ollama tidak memeriksa kunci; header hanya dikirim bila kuncinya memang ada.
          ...(key ? { authorization: `Bearer ${key}` } : {}),
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
