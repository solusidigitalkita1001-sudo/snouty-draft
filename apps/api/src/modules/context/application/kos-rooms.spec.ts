/**
 * Kos yang jumlah kamarnya disebut (P32-16) dan permintaan yang murah (P32-17).
 *
 * Produksi 2026-11-02: "aku mau pipa yang murah aja buat kos 10 kamar" dijawab "Oke, sudah saya
 * catat: rumah kos" lalu formulir — angka 10 hilang tanpa bekas, dan permintaan murahnya tidak
 * disinggung. Keputusan pemilik hari itu: catat kamarnya lalu tanya sekali dengan dua pilihan, dan
 * jawab permintaan hematnya apa adanya tanpa angka.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({
    LLM_CHAT_REPLY: false,
    LLM_STRUCTURED_RETRY: false,
    LLM_SOLUTION_PROSE: false,
  }),
}));
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { bathroomsFromRooms } from '../domain/clarification.js';
import { assumableUpdates } from '../domain/requirement-defaults.js';
import { extractionToUpdates } from './extraction-to-updates.js';
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

const MESSAGE = 'aku mau pipa yang murah aja buat kos 10 kamar';

function input(message = MESSAGE, over: Partial<PipelineInput> = {}): PipelineInput {
  return {
    messageId: '01JBMESSAGE00000000000000AB',
    message,
    decision,
    state: emptyRequirementState(T0),
    now: T0,
    understanding: understood(message, {
      intent: 'requirement_building',
      savingRequest: 'cheaper',
    }),
    ...over,
  };
}

/** State kos dengan jumlah kamar yang sudah tercatat. */
function kosWithRooms(rooms = 10) {
  return withCompleteness(
    mergeRequirement(
      emptyRequirementState(T0),
      [
        { path: 'building.type', value: 'boarding_house', source: 'user_stated' },
        { path: 'building.floors', value: 2, source: 'user_stated' },
        { path: 'building.rooms', value: rooms, source: 'user_stated' },
      ],
      T0,
    ).state,
  );
}

describe('kos yang jumlah kamarnya disebut', () => {
  it('"kos 10 kamar" tercatat sebagai 10 kamar, bukan 10 kamar mandi dan bukan hilang', () => {
    const updates = extractionToUpdates({}, MESSAGE);
    expect(updates.find((u) => u.path === 'building.rooms')?.value).toBe(10);
    expect(updates.find((u) => u.path === 'fixtures.bathrooms')).toBeUndefined();
  });

  it('"10 kamar mandi" tetap kamar mandi, bukan jumlah kamar', () => {
    const updates = extractionToUpdates({}, 'kos 2 lantai, 10 kamar mandi');
    expect(updates.find((u) => u.path === 'fixtures.bathrooms')?.value).toBe(10);
    expect(updates.find((u) => u.path === 'building.rooms')).toBeUndefined();
  });

  it('"rumah 3 kamar tidur" tidak mencatat kamar sewa', () => {
    const updates = extractionToUpdates({}, 'rumah 1 lantai, 3 kamar tidur, 2 kamar mandi');
    expect(updates.find((u) => u.path === 'building.rooms')).toBeUndefined();
  });

  it('pertanyaannya ditanya sekali dan menahan hitungan sampai dijawab', () => {
    const state = kosWithRooms();
    expect(state.missingInformation).toContain('fixtures.bathroomsPerRoom');
    // Anggapan 1 kamar mandi per lantai tidak melangkahinya.
    expect(assumableUpdates(state)).toHaveLength(0);
  });

  // Produksi 2026-11-02: kalimatnya berbunyi "Oke, sudah saya catat: rumah kos dan 10."
  it('jumlah kamarnya disebut balik dengan namanya, dan pertanyaannya ikut', async () => {
    const { events } = await runUnderstanding(null, input('kos 3 lantai, 12 kamar'));
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(text).toContain('12 kamar');
    const card = events.findLast((e) => e.type === 'card') as
      { card: { kind: string; questions?: readonly { id: string }[] } } | undefined;
    expect(card?.card.questions?.map((q) => q.id)).toContain('fixtures.bathroomsPerRoom');
  });

  it('jawaban "di dalam tiap kamar" menjadikan jumlah kamar jumlah kamar mandinya', () => {
    const state = kosWithRooms();
    const derived = bathroomsFromRooms(state, [
      { path: 'fixtures.bathroomsPerRoom', value: true, source: 'user_stated' },
    ]);
    expect(derived.find((u) => u.path === 'fixtures.bathrooms')?.value).toBe(10);
  });

  it('jawaban "kamar mandi bersama" tidak menurunkan jumlah kamar mandi', () => {
    const state = kosWithRooms();
    const derived = bathroomsFromRooms(state, [
      { path: 'fixtures.bathroomsPerRoom', value: false, source: 'user_stated' },
    ]);
    expect(derived.find((u) => u.path === 'fixtures.bathrooms')).toBeUndefined();
    // Dan jumlahnya memang masih ditanya.
    const after = withCompleteness(mergeRequirement(state, [...derived], T0).state);
    expect(after.missingInformation).toContain('fixtures.bathrooms');
  });
});

describe('permintaan yang murah', () => {
  it('dijawab apa adanya: ukuran tidak diturunkan, yang bisa dihemat disebut', async () => {
    const { events } = await runUnderstanding(null, input());
    const text = events
      .filter((e) => e.type === 'token')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(text).toContain('ukuran pipanya');
    expect(text).toContain('tim Pralon');
    // Tanpa angka karangan: tidak ada ukuran yang disebut sebagai "yang murah".
    expect(text).not.toMatch(/1\/2"/);
  });
});
