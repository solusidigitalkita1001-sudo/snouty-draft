/**
 * Transport OpenRouter: kegagalan penyedia menjadi `LlmUnavailableError` yang bertipe,
 * bukan `Error` polos. Ditemukan live 2026-10-05: kunci dengan limit harian $0 membuat
 * setiap pesan chat menjawab 503 SERVICE_UNAVAILABLE generik, padahal kontrak
 * menjanjikan LLM_UNAVAILABLE — dan UI punya teks khusus untuk itu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../domain/ai.errors.js';
import { OpenRouterTransport } from './openrouter-transport.js';

const fetchMock = vi.fn<typeof fetch>();

/** `loadEnv()` memvalidasi seluruh skema, jadi transport butuh env minimal yang sah. */
const TEST_ENV: Record<string, string> = {
  DB_HOST: '127.0.0.1',
  DB_DATABASE: 'snouty_test',
  DB_USERNAME: 'root',
  DB_PASSWORD: 'test',
  JWT_ACCESS_SECRET: 'rahasia-uji-akses-yang-panjangnya-cukup-32',
  JWT_REFRESH_SECRET: 'rahasia-uji-refresh-yang-panjangnya-cukup-32',
  OPENROUTER_API_KEY: 'sk-or-uji',
};
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of Object.keys(TEST_ENV)) {
    saved[key] = process.env[key];
    process.env[key] = TEST_ENV[key];
  }
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  for (const key of Object.keys(TEST_ENV)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

const request = { model: 'anthropic/claude-haiku-4.5', messages: [], jsonMode: false };

describe('OpenRouterTransport', () => {
  it('403 (kunci ditolak / limit habis) → LlmUnavailableError berkode LLM_UNAVAILABLE', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"code":403}}', { status: 403 }));

    await expect(new OpenRouterTransport().complete(request)).rejects.toMatchObject({
      name: 'LlmUnavailableError',
      code: 'LLM_UNAVAILABLE',
      status: 403,
    });
  });

  it('jaringan putus → LlmUnavailableError tanpa status', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(new OpenRouterTransport().complete(request)).rejects.toBeInstanceOf(
      LlmUnavailableError,
    );
  });

  it('pesan galatnya aman ditampilkan dan tidak memuat kunci', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 429 }));

    const error = await new OpenRouterTransport().complete(request).catch((e: unknown) => e);
    expect(String((error as Error).message)).not.toContain('sk-or');
    expect((error as Error).message).toBe(
      'Model bahasa sedang tidak tersedia. Coba lagi sebentar lagi.',
    );
  });

  it('LLM_REASONING_EFFORT dikirim bila diset; tanpa itu tidak ada field reasoning_effort', async () => {
    // qwen3.5 di Ollama tanpa "none": 297 detik dan 2.690 token penalaran untuk satu kalimat
    // (diukur di server produksi 2026-10-09); dengan "none": 4,6 detik.
    const ok = () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), { status: 200 });
    fetchMock.mockResolvedValueOnce(ok());
    await new OpenRouterTransport().complete(request);
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).not.toHaveProperty(
      'reasoning_effort',
    );

    process.env['LLM_REASONING_EFFORT'] = 'none';
    try {
      fetchMock.mockResolvedValueOnce(ok());
      await new OpenRouterTransport().complete(request);
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toMatchObject({
        reasoning_effort: 'none',
      });
    } finally {
      delete process.env['LLM_REASONING_EFFORT'];
    }
  });

  it('respons sukses dipetakan ke konten + token + biaya', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'siap' } }],
          usage: { prompt_tokens: 3, completion_tokens: 1, cost: 0.00001 },
        }),
        { status: 200 },
      ),
    );

    await expect(new OpenRouterTransport().complete(request)).resolves.toEqual({
      content: 'siap',
      promptTokens: 3,
      completionTokens: 1,
      costUsd: 0.00001,
    });
  });
});

describe('endpoint per panggilan (P30-01)', () => {
  const ok = () =>
    new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 });

  it('memakai basis URL dan kunci endpoint itu, bukan yang baku', async () => {
    fetchMock.mockResolvedValue(ok());
    await new OpenRouterTransport().complete({
      ...request,
      endpoint: { baseUrl: 'https://penyedia.contoh/v1', apiKey: 'sk-pengetahuan' },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://penyedia.contoh/v1/chat/completions');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer sk-pengetahuan');
  });

  it('endpoint tanpa kunci (Ollama) dikirim tanpa header authorization', async () => {
    fetchMock.mockResolvedValue(ok());
    await new OpenRouterTransport().complete({
      ...request,
      endpoint: { baseUrl: 'http://ollama:11434/v1' },
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('tanpa endpoint, panggilan tetap ke endpoint baku dengan kunci baku', async () => {
    fetchMock.mockResolvedValue(ok());
    await new OpenRouterTransport().complete(request);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer sk-or-uji');
  });
});
