/**
 * P4-08a — intent router: mutasi memperbarui state, pertanyaan tidak (§9 #10);
 * ragu → bertanya.
 */
import { describe, expect, it } from 'vitest';
import type { AiService, IntentInput } from '../../ai/domain/ai.port.js';
import type { Extraction, IntentClassification } from '../../ai/domain/extraction-schema.js';
import { INTENT_CONFIDENCE_THRESHOLD, IntentRouter } from './intent-router.js';

function aiReturning(result: IntentClassification): AiService {
  return {
    classifyIntent: (_input: IntentInput) => Promise.resolve(result),
    extract: () => Promise.resolve({} as Extraction),
    titleFor: () => Promise.resolve(''),
    parseProductQuestion: () => Promise.resolve({ productQuery: null, aspect: null, size: null }),
    // Jalur prosa tidak dipakai di router intent; fake-nya cukup menolak.
    writeProse: () => Promise.resolve(null),
  };
}

const router = (result: IntentClassification) => new IntentRouter(aiReturning(result));

describe('IntentRouter — presedensi kebutuhan (intent sadar konteks)', () => {
  it('"lebih bagus PVC atau HDPE buat rumah 2 lantai?" yang dilabeli PRODUCT_LOOKUP → REQUIREMENT_STATEMENT', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      'lebih bagus PVC atau HDPE buat rumah 2 lantai?',
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(false);
  });

  it('model ragu tetapi pesannya membawa kebutuhan → tetap diekstrak, bukan ditanya balik', async () => {
    const d = await router({ intent: 'CLARIFICATION_NEEDED', confidence: 0.3 }).route(
      'rumah 2 lantai 3 kamar mandi',
      false,
    );
    expect(d.intent).toBe('REQUIREMENT_STATEMENT');
  });

  it('tanpa isyarat kebutuhan, label model dipakai apa adanya', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.85 }).route(
      'apa bedanya pvc sama hdpe?',
      false,
    );
    expect(d.intent).toBe('PRODUCT_LOOKUP');
  });

  it('giliran terakhir diteruskan ke klasifikasi model', async () => {
    const seen: IntentInput[] = [];
    const ai = aiReturning({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    ai.classifyIntent = (input) => {
      seen.push(input);
      return Promise.resolve({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.9 });
    };
    await new IntentRouter(ai).route('yang mana?', false, [{ role: 'user', text: 'hai' }]);
    expect(seen[0]?.recentTurns).toEqual([{ role: 'user', text: 'hai' }]);
  });
});

describe('IntentRouter', () => {
  it('REQUIREMENT_MUTATION mengekstrak dan memutasi state', async () => {
    const d = await router({ intent: 'REQUIREMENT_MUTATION', confidence: 0.9 }).route(
      'tambah 1 kamar mandi',
      true,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(true);
  });

  it('EXPLANATION_REQUEST tidak mengekstrak dan tidak memutasi', async () => {
    const d = await router({ intent: 'EXPLANATION_REQUEST', confidence: 0.95 }).route(
      'kenapa ukuran ini?',
      true,
    );
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });

  it('PRODUCT_LOOKUP tidak mengekstrak kebutuhan (dijawab query MySQL)', async () => {
    const d = await router({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 }).route(
      'ada ukuran 3/4 inch?',
      true,
    );
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });

  it('REQUIREMENT_STATEMENT mengekstrak tetapi tidak dihitung "mutasi" (pernyataan awal)', async () => {
    const d = await router({ intent: 'REQUIREMENT_STATEMENT', confidence: 0.8 }).route(
      'rumah 2 lantai',
      false,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(false);
  });

  it('CLARIFICATION_ANSWER mengekstrak dan memutasi', async () => {
    const d = await router({ intent: 'CLARIFICATION_ANSWER', confidence: 0.85 }).route(
      'toren atap',
      true,
    );
    expect(d.shouldExtract).toBe(true);
    expect(d.mutatesState).toBe(true);
  });

  it('keyakinan di bawah ambang → bertanya, bukan menebak', async () => {
    const low = INTENT_CONFIDENCE_THRESHOLD - 0.01;
    const d = await router({ intent: 'REQUIREMENT_MUTATION', confidence: low }).route(
      'mungkin tambah?',
      true,
    );
    expect(d.intent).toBe('CLARIFICATION_NEEDED');
    expect(d.shouldExtract).toBe(false);
    expect(d.mutatesState).toBe(false);
  });
});
