/**
 * P4-07a — routing deterministik, perhitungan teknik tanpa tingkat.
 */
import { describe, expect, it } from 'vitest';
import { TIER_ENV_KEY, tierForTask, type LlmTask } from './model-routing.js';

describe('model routing', () => {
  it('memetakan tugas ke tingkat sesuai tabel AI_BEHAVIOR', () => {
    expect(tierForTask('conversation_title')).toBe('fast');
    expect(tierForTask('extraction')).toBe('balanced');
    expect(tierForTask('intent_classification')).toBe('balanced');
    expect(tierForTask('ambiguous_input')).toBe('strong');
    expect(tierForTask('extraction_retry')).toBe('strong');
  });

  it('deterministik: tugas yang sama selalu tingkat yang sama', () => {
    const tasks: LlmTask[] = ['product_faq', 'extraction', 'ambiguous_input'];
    for (const t of tasks) expect(tierForTask(t)).toBe(tierForTask(t));
  });

  it('setiap tingkat punya variabel env ID model — ID tidak di kode', () => {
    expect(TIER_ENV_KEY).toEqual({
      fast: 'LLM_MODEL_FAST',
      balanced: 'LLM_MODEL_BALANCED',
      strong: 'LLM_MODEL_STRONG',
    });
  });
});
