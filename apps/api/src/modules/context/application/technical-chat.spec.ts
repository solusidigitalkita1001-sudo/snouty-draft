/**
 * Kasus teknis yang sedang berjalan (laporan pemilik 2026-10-09, gedung 12 lantai): pesan tanpa
 * data baru ("lu belum nanya kamar mandi", "kasih gw pilihan") dijawab di atas DATA kasus, bukan
 * template yang sama diulang; pesan yang membawa data tetap memakai panduan deterministik.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({ LLM_CHAT_REPLY: true, LLM_STRUCTURED_RETRY: false, LLM_SOLUTION_PROSE: false }),
}));
import type { RequirementState } from '@snouty/shared-types';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { applyTechnicalFacts } from '../domain/technical.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';
import type { ReplyWriter } from './reply-writer.js';
import type { RoutingDecision } from './intent-router.js';

const T0 = '2026-10-09T00:00:00.000Z';
const decision: RoutingDecision = {
  intent: 'REQUIREMENT_STATEMENT',
  confidence: 0.9,
  shouldExtract: true,
  mutatesState: false,
};
const building: RequirementState = applyTechnicalFacts(
  emptyRequirementState(T0),
  'multistorey_building_water',
  'gedung dengan luas 100 x 30 12 lantai',
).state;

function writer() {
  const write = vi.fn((_input: { facts: string; fallback: string }) =>
    Promise.resolve({ text: 'Betul, kamar mandi per lantai belum saya tanya.', source: 'model' }),
  );
  return { reply: { write } as unknown as ReplyWriter, write };
}
const input = (message: string): PipelineInput => ({
  messageId: '01JBMESSAGE00000000000000AB',
  message,
  decision,
  state: building,
  now: T0,
});

describe('kasus teknis berjalan — pesan tanpa data baru', () => {
  it('"lu belum nanya kamar mandi" dijawab penulis balasan di atas DATA kasus', async () => {
    const { reply, write } = writer();
    const { events } = await runUnderstanding(
      null,
      input('oi lu belum nanya nih butuh kamar mandi brp, wastafelnya,dll'),
      reply,
    );
    expect(write).toHaveBeenCalledOnce();
    const facts = write.mock.calls[0]![0].facts;
    expect(facts).toContain('Air bersih gedung bertingkat');
    expect(facts).toContain('Tiap lantai ada berapa kamar mandi atau toilet?');
    const token = events.find((e) => e.type === 'token') as { text: string };
    expect(token.text).toBe('Betul, kamar mandi per lantai belum saya tanya.');
    expect(events.some((e) => e.type === 'card')).toBe(true);
  });

  it('pesan yang membawa data tetap memakai panduan, tanpa model', async () => {
    const { reply, write } = writer();
    const { events, nextState } = await runUnderstanding(
      null,
      input('6 toilet per lantai, 4 wastafel per lantai'),
      reply,
    );
    expect(write).not.toHaveBeenCalled();
    const params = (nextState.useCase as { parameters: Record<string, { value: unknown }> })
      .parameters;
    expect(params['bathrooms_per_floor']?.value).toBe(6);
    expect(params['basins_per_floor']?.value).toBe(4);
    const token = events.find((e) => e.type === 'token') as { text: string };
    expect(token.text).toContain('kamar mandi/toilet per lantai 6');
  });
});

describe('pembuka balasan model', () => {
  it('seruan pendek dibuang bila ada DATA; sapaan tanpa DATA dibiarkan', async () => {
    const { withoutOpener } = await import('./reply-writer.js');
    expect(withoutOpener('Benar sekali! supaya rencananya presisi, pilih di bawah.', 'DATA')).toBe(
      'Supaya rencananya presisi, pilih di bawah.',
    );
    expect(withoutOpener('Benar juga! Kamar mandi per lantai belum saya tanya.', 'DATA')).toBe(
      'Kamar mandi per lantai belum saya tanya.',
    );
    expect(withoutOpener('Ukurannya 3/4" untuk cabang.', 'DATA')).toBe(
      'Ukurannya 3/4" untuk cabang.',
    );
    expect(withoutOpener('Halo! Ada yang bisa dibantu?', undefined)).toBe(
      'Halo! Ada yang bisa dibantu?',
    );
  });
});

describe('kartu pertanyaan di samping Susun rekomendasi', () => {
  it('kasus gedung yang sudah bisa dihitung tetap menampilkan pilihan kamar mandi, wastafel, tinggi', async () => {
    const { events } = await runUnderstanding(null, {
      messageId: '01JBMESSAGE00000000000000AB',
      message: 'oi gw mau bikin gedung dengan luas 100 x 30 12 lantai, apa aja yang dibutuhin',
      decision,
      state: emptyRequirementState(T0),
      now: T0,
    });
    const cards = events
      .filter((e) => e.type === 'card')
      .map(
        (e) =>
          (
            e as unknown as {
              card: { kind: string; questions?: { id: string; options: string[] }[] };
            }
          ).card,
      );
    expect(cards.map((c) => c.kind)).toEqual(['clarification', 'cta']);
    const byId = Object.fromEntries(cards[0]!.questions!.map((q) => [q.id, q.options]));
    expect(Object.keys(byId)).toEqual(
      expect.arrayContaining(['bathrooms_per_floor', 'basins_per_floor', 'building_height']),
    );
    expect(byId['building_height']).toEqual(['42 m', '48 m', '54 m']);
    const token = events.find((e) => e.type === 'token') as { text: string };
    expect(token.text).toContain('pilih jawabannya di bawah');
    expect(token.text).not.toMatch(/beberapa hal ini:\n\n/);
  });
});
