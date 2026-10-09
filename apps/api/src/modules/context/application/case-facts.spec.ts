/**
 * P16-28 — balasan percakapan di atas DATA kasus. Laporan pemilik 2026-10-09: "enaknya makan apa?"
 * dibalas ajakan bertanya, "mana perhitungan teknisnya?" atas kasus yang diserahkan ke tim teknis
 * dibalas "dasar setiap angka ada di solusi", dan "itung ulang, luasnya belum gw kasih" tidak
 * dijawab sama sekali.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AiService } from '../../ai/domain/ai.port.js';
import { understood } from '../../understanding/testing/understood.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { caseFacts } from './case-facts.js';
import type { RoutingDecision } from './intent-router.js';
import { followUpCard, runUnderstanding } from './message-pipeline.js';

const T0 = '2026-01-01T00:00:00.000Z';

const handedOff = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 3, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 4, source: 'user_stated' },
      { path: 'water.source', value: 'ground_tank', source: 'user_stated' },
      { path: 'water.installationType', value: 'both', source: 'user_stated' },
    ],
    T0,
  ).state,
);

const noModel = {
  extract: vi.fn(() => Promise.resolve({})),
  classifyIntent: vi.fn(),
  titleFor: vi.fn(),
  writeProse: vi.fn(() => Promise.resolve(null)),
} as unknown as AiService;

const decision = (intent: RoutingDecision['intent'], shouldExtract = false): RoutingDecision => ({
  intent,
  confidence: 0.9,
  shouldExtract,
  mutatesState: shouldExtract,
});

const base = { messageId: '01JBMESSAGE00000000000000AB', now: T0 };
const firstTurn = [
  { role: 'user', text: 'halo' },
  { role: 'assistant', text: 'Halo! Saya SNOUTY.' },
] as const;
const token = (events: readonly { type: string }[]) =>
  (events.find((e) => e.type === 'token') as { text: string } | undefined)?.text ?? '';

describe('caseFacts', () => {
  it('memuat yang dicatat, status diserahkan ke tim teknis, dan cara SNOUTY menghitung', () => {
    const facts = caseFacts(handedOff, 'id', followUpCard(handedOff, 'id'));
    expect(facts).toContain('- Jumlah lantai: 3 lantai');
    expect(facts).toContain('- Diserahkan ke tim teknis Pralon (tidak dihitung otomatis):');
    expect(facts).toContain('Luas bangunan tidak menentukan ukuran pipa');
  });

  it('tanpa kasus: belum ada yang dicatat', () => {
    expect(caseFacts(null, 'id', null)).toContain('- (belum ada)');
  });
});

describe('balasan percakapan yang nyambung (P16-28)', () => {
  it('di luar topik di tengah percakapan → "di luar yang bisa saya bantu", bukan ajakan bertanya', async () => {
    const { events } = await runUnderstanding(noModel, {
      ...base,
      message: 'jam siang2 gini enaknya makan apa ?',
      decision: decision('OUT_OF_SCOPE'),
      state: emptyRequirementState(T0),
      recentTurns: [...firstTurn],
      understanding: understood('jam siang2 gini enaknya makan apa ?', { intent: null }),
    });
    expect(token(events)).toMatch(/^Itu di luar yang bisa saya bantu/);
  });

  it('"mana perhitungan teknisnya?" atas kasus yang diserahkan → alasannya + cara menghitung air bersihnya', async () => {
    const { events } = await runUnderstanding(noModel, {
      ...base,
      message: 'lah mana perhitungan teknis nya ?',
      decision: decision('EXPLANATION_REQUEST'),
      state: handedOff,
      recentTurns: [...firstTurn],
    });
    const text = token(events);
    expect(text).toMatch(/^Untuk kasus ini belum ada hitungan otomatis:/);
    expect(text).toContain('ubah jenis instalasinya menjadi air bersih');
    expect(text).not.toContain('Dasar setiap angka ada di solusi');
  });

  it('giliran yang tidak menghasilkan kalimat apa pun tetap dijawab (dulu "Saya belum bisa membaca pesan itu")', async () => {
    const { events } = await runUnderstanding(noModel, {
      ...base,
      message: 'itung ulang, gw belom ngasih tau luas nya loh',
      decision: decision('CLARIFICATION_ANSWER', true),
      state: handedOff,
      recentTurns: [...firstTurn],
    });
    expect(token(events)).not.toBe('');
    // Kasus tidak berubah: kartu serah-terima yang sama tidak diulang (2026-10-09).
    expect(events.some((e) => e.type === 'card')).toBe(false);
  });
});
