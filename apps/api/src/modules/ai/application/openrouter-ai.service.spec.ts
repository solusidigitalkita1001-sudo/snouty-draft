/**
 * P4-09a (sebagian) — retry sekali lalu lempar; tiap percobaan tercatat;
 * `LlmCallRecord` tidak punya field isi prompt.
 */
import { describe, expect, it } from 'vitest';
import { AiOutputInvalidError } from '../domain/ai.errors.js';
import type { LlmCallRecord, LlmCallRecorder } from '../domain/llm-call.recorder.js';
import type { LlmCompletionRequest, LlmTransport } from '../domain/llm-transport.port.js';
import { OpenRouterAiService } from './openrouter-ai.service.js';

const ENV = {
  LLM_MODEL_FAST: 'fast-model',
  LLM_MODEL_BALANCED: 'balanced-model',
  LLM_MODEL_STRONG: 'strong-model',
  OPENROUTER_API_KEY: 'test-key',
};

async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved = { ...process.env };
  Object.assign(process.env, ENV, {
    NODE_ENV: 'test',
    DB_HOST: 'localhost',
    DB_DATABASE: 'x',
    DB_USERNAME: 'x',
    DB_PASSWORD: 'x',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
    JWT_REFRESH_SECRET: 'y'.repeat(32),
  });
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

function transportReturning(...contents: string[]): {
  transport: LlmTransport;
  calls: LlmCompletionRequest[];
} {
  const calls: LlmCompletionRequest[] = [];
  let i = 0;
  return {
    calls,
    transport: {
      complete: (req) => {
        calls.push(req);
        const content = contents[Math.min(i, contents.length - 1)]!;
        i += 1;
        return Promise.resolve({ content, promptTokens: 10, completionTokens: 5, costUsd: 0.001 });
      },
    },
  };
}

function recorderCapturing(): { recorder: LlmCallRecorder; records: LlmCallRecord[] } {
  const records: LlmCallRecord[] = [];
  return { records, recorder: { record: (r) => (records.push(r), Promise.resolve()) } };
}

describe('OpenRouterAiService', () => {
  it('ekstraksi valid pada percobaan pertama: satu panggilan, satu catatan sukses', async () => {
    await withEnv(async () => {
      const { transport, calls } = transportReturning('{"building":{"floors":2}}');
      const { recorder, records } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      const result = await svc.extract('rumah 2 lantai');
      expect(result.building?.floors).toBe(2);
      expect(calls).toHaveLength(1);
      expect(records).toHaveLength(1);
      expect(records[0]!.outcome).toBe('success');
      expect(records[0]!.model).toBe('balanced-model');
    });
  });

  it('tidak valid lalu valid: retry sekali di tingkat strong, dua catatan', async () => {
    await withEnv(async () => {
      const { transport, calls } = transportReturning('bukan json', '{"building":{"floors":3}}');
      const { recorder, records } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      const result = await svc.extract('rumah 3 lantai');
      expect(result.building?.floors).toBe(3);
      expect(calls).toHaveLength(2);
      expect(calls[1]!.model).toBe('strong-model');
      expect(records.map((r) => r.outcome)).toEqual(['success', 'validation_failed']);
    });
  });

  it('dua-duanya tidak valid: melempar, TIDAK ada percobaan ketiga', async () => {
    await withEnv(async () => {
      const { transport, calls } = transportReturning('bukan json', 'masih bukan json');
      const { recorder } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      await expect(svc.extract('pesan membingungkan')).rejects.toBeInstanceOf(AiOutputInvalidError);
      expect(calls).toHaveLength(2);
    });
  });

  it('LlmCallRecord tidak pernah membawa isi prompt (PRIVACY)', async () => {
    await withEnv(async () => {
      const { transport } = transportReturning('{"water":{"source":"pump"}}');
      const { recorder, records } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      await svc.extract('RAHASIA-PROMPT-12345 pompa');
      const serialized = JSON.stringify(records);
      expect(serialized).not.toContain('RAHASIA-PROMPT-12345');
      expect(Object.keys(records[0]!)).not.toContain('prompt');
    });
  });
});

describe('writeProse', () => {
  it('memakai tingkat balanced dan mengembalikan keluaran MENTAH tanpa validasi', async () => {
    // Mentah disengaja: skema prosa milik pemanggil, dan hanya pemanggil yang tahu
    // angka mana yang sah (REC-1). Di sini bahkan bentuk yang salah ikut lewat.
    await withEnv(async () => {
      const { transport, calls } = transportReturning('{"headline":"h","tidakDikenal":1}');
      const { recorder, records } = recorderCapturing();
      const service = new OpenRouterAiService(transport, recorder, () => 0);

      const raw = await service.writeProse({ systemPrompt: 'sys', userMessage: 'data' });

      expect(raw).toEqual({ headline: 'h', tidakDikenal: 1 });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.model).toBe('balanced-model');
      expect(records.map((r) => r.task)).toEqual(['explanation_prose']);
    });
  });

  it('TIDAK mencoba ulang sendiri — satu panggilan, titik', async () => {
    // Percobaan ulang prosa diatur REC-1 di perakitan rekomendasi. Dua lapis retry
    // berarti empat percobaan dari dua tempat yang tidak saling tahu.
    await withEnv(async () => {
      const { transport, calls } = transportReturning('bukan json sama sekali');
      const { recorder } = recorderCapturing();
      const service = new OpenRouterAiService(transport, recorder, () => 0);

      await service.writeProse({ systemPrompt: 'sys', userMessage: 'data' });

      expect(calls).toHaveLength(1);
    });
  });

  it('mencatat biaya tanpa menyimpan isi prompt', async () => {
    await withEnv(async () => {
      const { transport } = transportReturning('{"headline":"h","body":"b"}');
      const { recorder, records } = recorderCapturing();
      const service = new OpenRouterAiService(transport, recorder, () => 0);

      await service.writeProse({ systemPrompt: 'RAHASIA-SYS', userMessage: 'RAHASIA-USER' });

      expect(JSON.stringify(records)).not.toContain('RAHASIA');
      expect(records[0]?.promptTokens).toBe(10);
    });
  });
});
