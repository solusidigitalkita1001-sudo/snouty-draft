/**
 * Kolam renang (P32-11): dikatakan apa adanya bahwa hitungannya belum ada di sini, ukurannya
 * tercatat sebagai ukuran KOLAM, lalu ditawarkan diteruskan ke tim teknis Pralon.
 *
 * Produksi 2026-11-02: "mau bikin kolam renang 8x4 meter, pipanya apa aja" dijawab "Oke, sudah
 * saya catat: bangunan 8 × 4 m" lalu ditanya jumlah lantainya, setelah 17,3 detik. Keputusan
 * pemilik hari itu: katakan apa adanya, tawarkan tim teknis dengan ukuran yang sudah disebut.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({
    LLM_CHAT_REPLY: false,
    LLM_STRUCTURED_RETRY: false,
    LLM_SOLUTION_PROSE: false,
  }),
}));
import { caseProfile, extractTechnicalContext } from '@snouty/engineering';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { understood } from '../../understanding/testing/understood.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';
import type { RoutingDecision } from './intent-router.js';

const T0 = '2026-11-02T00:00:00.000Z';
const decision: RoutingDecision = {
  intent: 'REQUIREMENT_STATEMENT',
  confidence: 0.9,
  shouldExtract: true,
  mutatesState: false,
};

const MESSAGE = 'mau bikin kolam renang 8x4 meter, pipanya apa aja';

function input(): PipelineInput {
  return {
    messageId: '01JBMESSAGE00000000000000AB',
    message: MESSAGE,
    decision,
    state: emptyRequirementState(T0),
    now: T0,
    understanding: understood(MESSAGE, {
      intent: 'requirement_technical',
      useCase: 'swimming_pool',
    }),
  };
}

describe('kasus kolam renang', () => {
  it('kalkulatornya belum ada, jadi hitungannya milik tim teknis', () => {
    expect(caseProfile('swimming_pool').calculatorStatus).toBe('pending');
  });

  it('"8x4 meter" tercatat sebagai sisi kolam, bukan ukuran bangunan', () => {
    const captured = extractTechnicalContext(MESSAGE, 'swimming_pool');
    const by = (key: string) => captured.find((p) => p.key === key)?.value;
    expect(by('pond_length')).toBe(8);
    expect(by('pond_width')).toBe(4);
    expect(by('field_length')).toBeUndefined();
  });

  // Produksi 2026-11-02: teksnya menutup dengan "pilih jawabannya di bawah" padahal kartunya
  // penyerahan — tidak ada pilihan apa pun di bawahnya.
  // Produksi 2026-11-02: "kolam renang hotel 25 meter" tercatat sebagai panjang JALUR.
  it('satu sisi yang menempel pada kata kolam adalah panjang kolam', () => {
    const captured = extractTechnicalContext(
      'kolam renang hotel 25 meter, dalamnya 1,5 meter',
      'swimming_pool',
    );
    const by = (key: string) => captured.find((p) => p.key === key)?.value;
    expect(by('pond_length')).toBe(25);
    expect(by('pond_depth')).toBe(1.5);
    expect(by('route_length')).toBeUndefined();
  });

  it('tidak menunjuk pilihan yang tidak ada', async () => {
    const { events } = await runUnderstanding(null, input());
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(text).not.toContain('pilih jawabannya di bawah');
    expect(text).toContain('tulis saja');
  });

  it('dijawab apa adanya plus kartu penyerahan, tanpa menanyakan jumlah lantai', async () => {
    const { events } = await runUnderstanding(null, input());
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(text).toContain('kolam renang');
    expect(text).toContain('tim teknis Pralon');
    expect(text).not.toContain('lantai');
    const card = events.findLast((e) => e.type === 'card') as
      { card: { kind: string; reasons?: readonly string[] } } | undefined;
    expect(card?.card.kind).toBe('unsupported');
    expect(card?.card.reasons?.[0]).toContain('kolam renang');
  });
});
