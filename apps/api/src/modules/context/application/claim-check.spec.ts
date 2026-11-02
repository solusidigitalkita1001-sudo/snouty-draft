/**
 * Klaim ukuran dari orang lain (P32-10): dihitung dengan anggapan, lalu klaimnya dijawab.
 *
 * Produksi 2026-11-02: "tukang saya bilang pipa 1/2 inci cukup buat 3 lantai, bener ga?" dijawab
 * "Oke, sudah saya catat: 3 lantai" plus formulir setelah 14,2 detik — klaimnya sendiri tidak
 * pernah disinggung. Keputusan pemilik hari itu: hitung dengan anggapan wajar, lalu jawab.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({
    LLM_CHAT_REPLY: false,
    LLM_STRUCTURED_RETRY: false,
    LLM_SOLUTION_PROSE: false,
  }),
}));
import type { AiService } from '../../ai/domain/ai.port.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { understood } from '../../understanding/testing/understood.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';
import { IntentRouter, type RoutingDecision } from './intent-router.js';
import { claimVerdict } from './claim-verdict.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';

const T0 = '2026-11-02T00:00:00.000Z';
const decision: RoutingDecision = {
  intent: 'REQUIREMENT_STATEMENT',
  confidence: 0.9,
  shouldExtract: true,
  mutatesState: false,
};

function ai(): AiService {
  return {
    extract: vi.fn(() => Promise.resolve({ building: { floors: 3 } })),
    classifyIntent: vi.fn(),
    titleFor: vi.fn(),
    writeProse: vi.fn(() => Promise.resolve(null)),
  } as unknown as AiService;
}

const CLAIM = 'tukang saya bilang pipa 1/2 inci cukup buat 3 lantai, bener ga?';

function input(message = CLAIM): PipelineInput {
  return {
    messageId: '01JBMESSAGE00000000000000AB',
    message,
    decision,
    state: emptyRequirementState(T0),
    now: T0,
    understanding: understood(message, { intent: 'requirement_building', claimCheck: 'check' }),
  };
}

describe('klaim ukuran yang diminta dinilai', () => {
  it('dihitung dengan anggapan, lalu klaimnya dijawab dengan ukuran hitungan', async () => {
    const { events } = await runUnderstanding(ai(), input());
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(text).toContain('1 kamar mandi per lantai');
    expect(text).toContain('tidak cukup');
    expect(text).toContain('pipa utamanya 1¼"');
    // Yang ditawarkan hitungannya, bukan formulir data.
    const card = events.findLast((e) => e.type === 'card') as
      { card: { kind: string; action?: string } } | undefined;
    expect(card?.card.kind).toBe('cta');
    expect(card?.card.action).toBe('ANALYZE');
  });

  it('klaim tanpa ukuran dijawab ukuran pipa utama dan cabangnya', () => {
    const state = withCompleteness(
      mergeRequirement(
        emptyRequirementState(T0),
        [
          { path: 'building.floors', value: 3, source: 'user_stated', provenance: 'VERIFIED' },
          { path: 'fixtures.bathrooms', value: 3, source: 'user_stated', provenance: 'VERIFIED' },
          {
            path: 'water.source',
            value: 'rooftop_tank',
            source: 'user_stated',
            provenance: 'VERIFIED',
          },
          {
            path: 'water.installationType',
            value: 'clean_water',
            source: 'user_stated',
            provenance: 'VERIFIED',
          },
        ],
        T0,
      ).state,
    );
    const verdict = claimVerdict(state, null);
    expect(verdict).toContain('pipa utamanya');
    expect(verdict).toContain('cabang');
  });

  it('ukuran yang kebesaran dikatakan kebesaran, yang pas dikatakan pas', () => {
    const state = withCompleteness(
      mergeRequirement(
        emptyRequirementState(T0),
        [
          { path: 'building.floors', value: 1, source: 'user_stated', provenance: 'VERIFIED' },
          { path: 'fixtures.bathrooms', value: 1, source: 'user_stated', provenance: 'VERIFIED' },
          {
            path: 'water.source',
            value: 'rooftop_tank',
            source: 'user_stated',
            provenance: 'VERIFIED',
          },
          {
            path: 'water.installationType',
            value: 'clean_water',
            source: 'user_stated',
            provenance: 'VERIFIED',
          },
        ],
        T0,
      ).state,
    );
    const own = claimVerdict(state, null);
    const size = /pipa utamanya ([^,]+),/.exec(own ?? '')?.[1];
    expect(size).toBeDefined();
    expect(claimVerdict(state, size!.replace(/"/g, ''))).toContain('memang pas');
    expect(claimVerdict(state, '6')).toContain('lebih besar dari yang dibutuhkan');
  });

  // Intent pesan ini memang ragu: contoh teratasnya pertanyaan harga dan permintaan saran.
  it('dirutekan sebagai kebutuhan tanpa memanggil model', async () => {
    const classifyIntent = vi.fn();
    const router = new IntentRouter({ classifyIntent } as unknown as AiService);
    const routed = await router.route(understood(CLAIM, { claimCheck: 'check' }), false);
    expect(routed.intent).toBe('REQUIREMENT_STATEMENT');
    expect(routed.shouldExtract).toBe(true);
    expect(classifyIntent).not.toHaveBeenCalled();
  });

  it('tanpa jumlah lantai tidak ada penilaian: yang kurang ditanyakan', async () => {
    const message = 'kata tukang pipa 1/2 inci cukup, bener ga?';
    const { events } = await runUnderstanding(
      { ...ai(), extract: vi.fn(() => Promise.resolve({})) } as unknown as AiService,
      { ...input(message), message },
    );
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(text).not.toContain('tidak cukup');
  });
});
