/**
 * Alamat embedding terpisah (2026-10-08): model chat boleh pindah ke penyedia hosted sementara
 * contoh pemahaman tetap disandikan bge-m3 di Ollama lokal — dan kunci penyedia chat tidak ikut
 * terkirim ke endpoint embedding.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAiEmbeddingEncoder } from './openai-embedding.encoder.js';

const fetchMock = vi.fn<typeof fetch>();

const BASE_ENV: Record<string, string> = {
  DB_HOST: '127.0.0.1',
  DB_DATABASE: 'snouty_test',
  DB_USERNAME: 'root',
  DB_PASSWORD: 'test',
  JWT_ACCESS_SECRET: 'rahasia-uji-akses-yang-panjangnya-cukup-32',
  JWT_REFRESH_SECRET: 'rahasia-uji-refresh-yang-panjangnya-cukup-32',
  OPENROUTER_API_KEY: 'sk-or-uji',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
};
const KEYS = [...Object.keys(BASE_ENV), 'EMBEDDING_BASE_URL', 'EMBEDDING_API_KEY'];
const saved: Record<string, string | undefined> = {};

function useEnv(extra: Record<string, string> = {}): void {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, BASE_ENV, extra);
}

const ok = () =>
  new Response(JSON.stringify({ data: [{ index: 0, embedding: [3, 4] }] }), { status: 200 });

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

describe('OpenAiEmbeddingEncoder', () => {
  it('tanpa EMBEDDING_BASE_URL: memakai basis URL dan kunci penyedia chat (perilaku lama)', async () => {
    useEnv();
    fetchMock.mockResolvedValueOnce(ok());
    const [vector] = await new OpenAiEmbeddingEncoder('bge-m3').encode(['halo']);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/embeddings');
    expect((init!.headers as Record<string, string>)['authorization']).toBe('Bearer sk-or-uji');
    expect(Array.from(vector!)).toEqual([0.6000000238418579, 0.800000011920929]);
  });

  it('dengan EMBEDDING_BASE_URL: ke Ollama lokal, tanpa kunci penyedia chat', async () => {
    useEnv({ EMBEDDING_BASE_URL: 'http://ollama:11434/v1' });
    fetchMock.mockResolvedValueOnce(ok());
    await new OpenAiEmbeddingEncoder('bge-m3').encode(['halo']);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ollama:11434/v1/embeddings');
    expect((init!.headers as Record<string, string>)['authorization']).toBeUndefined();
  });
});
