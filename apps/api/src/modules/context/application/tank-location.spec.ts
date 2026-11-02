/**
 * P32-31 — toren yang disebut tanpa letaknya. Produksi 2026-11-02, kasus masjid: "airnya dari
 * sumur bor pakai toren" tidak mengubah apa pun (letak toren memang tidak ditebak), dan yang
 * terucap "Kebutuhan Anda tetap tercatat seperti di panel" — jawaban pengguna seolah tidak
 * terbaca. Yang pantas terucap adalah pertanyaan letak torennya.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({
    LLM_CHAT_REPLY: false,
    LLM_STRUCTURED_RETRY: false,
    LLM_SOLUTION_PROSE: false,
  }),
}));
import { understood } from '../../understanding/testing/understood.js';
import { withCompleteness } from '../domain/completeness.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { extractionToUpdates, mentionsTankWithoutLocation } from './extraction-to-updates.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';

const T0 = '2026-11-02T00:00:00.000Z';
const MESSAGE = 'airnya dari sumur bor pakai toren';

const state = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'place_of_worship', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 6, source: 'user_stated' },
    ],
    T0,
  ).state,
);

function input(over: Partial<PipelineInput> = {}): PipelineInput {
  return {
    messageId: '01JBMESSAGE00000000000000AB',
    message: MESSAGE,
    decision: {
      intent: 'REQUIREMENT_STATEMENT',
      confidence: 0.9,
      shouldExtract: true,
      mutatesState: false,
    },
    state,
    now: T0,
    understanding: understood(MESSAGE, { intent: 'requirement_building' }),
    ...over,
  };
}

function spoken(events: Awaited<ReturnType<typeof runUnderstanding>>['events']): string {
  return events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join(' ');
}

describe('toren tanpa letaknya', () => {
  it('letaknya tidak ditebak dari "sumur bor pakai toren"', () => {
    expect(mentionsTankWithoutLocation(MESSAGE)).toBe(true);
    expect(extractionToUpdates({}, MESSAGE).find((u) => u.path === 'water.source')).toBeUndefined();
  });

  it('"torennya di atap" bukan lagi pertanyaan: letaknya tersurat', () => {
    expect(mentionsTankWithoutLocation('torennya di atap')).toBe(false);
  });

  it('ringkasan yang sama dua kali berganti menjadi pertanyaan letak torennya', async () => {
    const first = await runUnderstanding(null, input());
    const said = spoken(first.events);
    const { events } = await runUnderstanding(
      null,
      input({ recentTurns: [{ role: 'assistant', text: said }] }),
    );
    const text = spoken(events);
    expect(text).toContain('di atap atau di bawah');
    expect(text).not.toContain('tetap tercatat');
    // Masjid ikut aturan "hitung dulu + anggapan" (pemilik 2026-11-02), tetapi letak toren yang
    // baru disebut tetap tidak ikut dianggap — pertanyaannya ini.
    const updated = first.events.find((e) => e.type === 'requirement.updated') as {
      state: typeof state;
    };
    expect(updated.state.water.source.value).toBeNull();
    expect(updated.state.water.installationType).toMatchObject({
      value: 'clean_water',
      provenance: 'ASSUMED',
    });
  });

  it('pesan lain yang tidak mengubah apa pun tetap dijawab seperti biasa', async () => {
    const message = 'oke';
    const first = await runUnderstanding(null, input({ message }));
    const said = spoken(first.events);
    const { events } = await runUnderstanding(
      null,
      input({ message, recentTurns: [{ role: 'assistant', text: said }] }),
    );
    expect(spoken(events)).not.toContain('di atap atau di bawah');
  });
});
