/**
 * P4-09a — baris `llm_calls` membawa model/token/biaya/latensi/outcome, tetapi
 * TIDAK PERNAH isi prompt (docs/PRIVACY.md). Terhadap MySQL nyata.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDatabase } from '../../../../test/mysql.js';
import { llmCalls } from '../../../infrastructure/mysql/schema/ops.js';
import { MysqlLlmCallRecorder } from './mysql-llm-call.recorder.js';

const mysql = await createTestDatabase('llm-calls');
const recorder = new MysqlLlmCallRecorder({ db: mysql.db });

beforeEach(() => mysql.clear());
afterAll(() => mysql.close());

describe('MysqlLlmCallRecorder', () => {
  it('menyimpan metadata biaya dan dapat dibaca kembali', async () => {
    await recorder.record({
      task: 'extraction',
      tier: 'balanced',
      model: 'balanced-model',
      promptTokens: 1840,
      completionTokens: 420,
      costUsd: 0.0031,
      latencyMs: 512,
      outcome: 'success',
      correlationId: '01JBCORRELATION00000000000',
    });

    const rows = await mysql.db.select().from(llmCalls);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe('balanced-model');
    expect(rows[0]!.promptTokens).toBe(1840);
    expect(Number(rows[0]!.costUsd)).toBeCloseTo(0.0031, 6);
    expect(rows[0]!.outcome).toBe('success');
  });

  it('tabel llm_calls tidak punya kolom untuk isi prompt', async () => {
    const columns = await mysql.db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'llm_calls'`,
    );
    const names = (
      columns[0] as unknown as Array<{ column_name?: string; COLUMN_NAME?: string }>
    ).map((r) => (r.column_name ?? r.COLUMN_NAME ?? '').toLowerCase());
    // Tidak ada kolom yang bisa menampung teks prompt/pesan/konten.
    for (const forbidden of ['prompt', 'message', 'content', 'input', 'text', 'body']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('CHECK menolak outcome di luar daftar', async () => {
    await expect(
      mysql.db.insert(llmCalls).values({
        id: '01JBBADOUTCOME0000000000000',
        task: 'extraction',
        tier: 'balanced',
        model: 'm',
        outcome: 'exploded',
      }),
    ).rejects.toThrow();
  });
});
