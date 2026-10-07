/**
 * P4-09a (sebagian) — retry sekali lalu lempar; tiap percobaan tercatat;
 * `LlmCallRecord` tidak punya field isi prompt.
 */
import { describe, expect, it, vi } from 'vitest';
import { AiOutputInvalidError, LlmUnavailableError } from '../domain/ai.errors.js';
import type { LlmCallRecord, LlmCallRecorder } from '../domain/llm-call.recorder.js';
import {
  LlmAbortedError,
  type LlmCompletionRequest,
  type LlmTransport,
} from '../domain/llm-transport.port.js';
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

  it('`null` untuk field yang tidak disebut = dihilangkan: valid tanpa percobaan ulang', async () => {
    await withEnv(async () => {
      // Keluaran asli qwen2.5 7B di server untuk "rumah 2 lantai, 3 kamar mandi, air dari toren atap".
      const { transport, calls } = transportReturning(
        '{"building":{"type":"residential","floors":2,"floorHeightM":null,"mainRunMeters":null},' +
          '"fixtures":{"bathrooms":3,"basins":null,"kitchens":null,"outletCount":null},' +
          '"water":{"source":"rooftop_tank","installationType":null,"boosterPump":null}}',
      );
      const { recorder, records } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      const result = await svc.extract('rumah 2 lantai, 3 kamar mandi, air dari toren atap');
      expect(result).toEqual({
        building: { type: 'residential', floors: 2 },
        fixtures: { bathrooms: 3 },
        water: { source: 'rooftop_tank' },
      });
      expect(calls).toHaveLength(1);
      expect(records.map((r) => r.outcome)).toEqual(['success']);
    });
  });

  it('field di luar batas (floorHeightM 0) dibuang, sisanya dipakai — tanpa panggilan ulang', async () => {
    await withEnv(async () => {
      // Keluaran asli qwen2.5 7B di produksi 2026-10-07: angka yang tidak disebut ditulis 0.
      const { transport, calls } = transportReturning(
        '{"building":{"type":"residential","floors":2,"floorHeightM":0,"mainRunMeters":0},' +
          '"fixtures":{"bathrooms":3,"basins":0,"kitchens":0,"outletCount":0},' +
          '"water":{"source":"rooftop_tank","installationType":"clean_water","boosterPump":false}}',
      );
      const { recorder, records } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      const result = await svc.extract('rumah 2 lantai, 3 kamar mandi, toren atap');
      expect(result.building).toEqual({ type: 'residential', floors: 2, mainRunMeters: 0 });
      expect(result.fixtures?.bathrooms).toBe(3);
      expect(calls).toHaveLength(1);
      expect(records.map((r) => r.outcome)).toEqual(['success']);
    });
  });

  it('`null` di tempat yang memang salah tetap ditolak — bukan pelonggaran skema', async () => {
    await withEnv(async () => {
      // `floors: "dua"` dipangkas (bukan "tidak disebut" yang bisa dibaca) → `{building:{}}` valid
      // tanpa panggilan ulang; `building: null` di percobaan kedua tidak pernah diminta.
      const { transport, calls } = transportReturning(
        '{"building":{"floors":"dua"}}',
        '{"building":null}',
      );
      const { recorder } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      const result = await svc.extract('rumah dua lantai');
      expect(result).toEqual({ building: {} });
      expect(calls).toHaveLength(1);
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

describe('jalur cepat tanpa model (latensi CPU)', () => {
  it('sapaan, merek pesaing, dan konsep produk tidak memanggil transport', async () => {
    await withEnv(async () => {
      const { transport, calls } = transportReturning(
        '{"intent":"REQUIREMENT_STATEMENT","confidence":0.9}',
      );
      const { recorder } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      expect(
        (await svc.classifyIntent({ message: 'hai', hasExistingRequirements: false })).intent,
      ).toBe('OUT_OF_SCOPE');
      expect(
        (await svc.classifyIntent({ message: 'Pralon vs Rucika?', hasExistingRequirements: false }))
          .intent,
      ).toBe('COMPETITOR_QUESTION');
      expect((await svc.parseProductQuestion('apa bedanya pvc sama hdpe?')).productQuery).toBe(
        'pvc dan hdpe',
      );
      expect(calls).toHaveLength(0);
    });
  });

  it('panggilan terstruktur yang melewati LLM_CALL_TIMEOUT_MS dibatalkan → model tidak terjangkau, bukan menggantung', async () => {
    await withEnv(async () => {
      process.env['LLM_CALL_TIMEOUT_MS'] = '5000';
      vi.useFakeTimers();
      try {
        const transport = {
          complete: (request: { signal?: AbortSignal }) =>
            new Promise<never>((_, reject) => {
              request.signal?.addEventListener('abort', () => reject(new LlmAbortedError()));
            }),
        };
        const { recorder } = recorderCapturing();
        const svc = new OpenRouterAiService(transport as never, recorder, () => 0);
        const pending = svc.classifyIntent({
          message: 'rumah 2 lantai',
          hasExistingRequirements: false,
        });
        const outcome = pending.then(
          () => 'resolved',
          (error: unknown) => (error instanceof LlmUnavailableError ? 'unavailable' : 'other'),
        );
        await vi.advanceTimersByTimeAsync(5_001);
        expect(await outcome).toBe('unavailable');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('writeProse dengan timeoutMs membatalkan panggilan (sinyal diteruskan ke transport)', async () => {
    await withEnv(async () => {
      let seenSignal: AbortSignal | undefined;
      const transport = {
        complete: (request: { signal?: AbortSignal }) =>
          new Promise<never>((_, reject) => {
            seenSignal = request.signal;
            request.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      };
      const { recorder } = recorderCapturing();
      const svc = new OpenRouterAiService(transport as never, recorder, () => 0);

      await expect(
        svc.writeProse({ systemPrompt: 's', userMessage: 'u', timeoutMs: 20 }),
      ).rejects.toThrow();
      expect(seenSignal?.aborted).toBe(true);
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

describe('skema ikut dikirim ke model', () => {
  it('prompt sistem panggilan terstruktur memuat skema JSON dengan label intent-nya', async () => {
    await withEnv(async () => {
      const { transport, calls } = transportReturning('{"intent":"OUT_OF_SCOPE","confidence":0.9}');
      const { recorder } = recorderCapturing();
      const svc = new OpenRouterAiService(transport, recorder, () => 0);

      await svc.classifyIntent({
        message: 'rumah saya pakai sumur',
        hasExistingRequirements: false,
      });

      const system = calls[0]!.messages.find((m) => m.role === 'system')?.content ?? '';
      // Sebelumnya prompt hanya berkata "sesuai skema" tanpa pernah menyebut skemanya.
      expect(system).toContain('Skema JSON keluaran');
      expect(system).toContain('"enum"');
      expect(system).toContain('REQUIREMENT_STATEMENT');
      expect(system).toContain('PRODUCT_LOOKUP');
    });
  });
});
