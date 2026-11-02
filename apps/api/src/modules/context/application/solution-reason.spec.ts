/**
 * P32-26 — "kenapa ukurannya segitu?" atas solusi yang sudah dihitung dijawab dari jejak hitungan
 * engine. Produksi 2026-11-02: pertanyaan itu mendapat ringkasan yang sama persis dengan
 * pertanyaan ukuran di giliran sebelumnya, lalu dinilai ulangan dan dijawab "itu yang saya
 * jelaskan di jawaban sebelumnya" — 42 detik, dan dasar yang sudah dihitung tidak pernah sampai.
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
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import type { ActiveSolution } from '../domain/active-solution.port.js';
import { runUnderstanding } from './message-pipeline.js';
import { solutionReasonReply } from './solution-facts.js';

const T0 = '2026-11-02T00:00:00.000Z';
const REASON =
  'Beban suplai 18 unit = 3 kloset × 2,5 + 3 shower × 2 + 3 wastafel × 1 + 1 bak cuci dapur × 1,5. ' +
  'Dicoba 10 ukuran; 1¼" yang terkecil dengan kecepatan air 0,6–2 m/s.';

const solution = {
  recommendation: {
    headline: 'Sistem distribusi untuk 10 titik air',
    systemLines: [
      {
        name: 'Pipa distribusi utama',
        path: 'Sumber → titik air tertinggi',
        size: '1¼"',
        reason: REASON,
        role: 'main',
        provenance: 'ASSUMED',
        traceIds: [],
      },
      {
        name: 'Cabang',
        path: 'Pipa utama → titik air',
        size: '1"',
        reason: 'Diameter dalam minimum 23,2 mm untuk 0,63 l/s pada 1,5 m/s.',
        role: 'branch',
        provenance: 'ASSUMED',
        traceIds: [],
      },
    ],
    bom: [],
  } as unknown as ActiveSolution['recommendation'],
  stale: false,
} satisfies ActiveSolution;

const state = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 3, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
      { path: 'water.source', value: 'municipal', source: 'user_stated' },
    ],
    T0,
  ).state,
);

function ask(message: string, over: Partial<Parameters<typeof runUnderstanding>[1]> = {}) {
  return runUnderstanding(null, {
    messageId: 'M'.repeat(26),
    message,
    decision: {
      intent: 'EXPLANATION_REQUEST',
      confidence: 1,
      shouldExtract: false,
      mutatesState: false,
    },
    state,
    now: T0,
    understanding: understood(message, {
      intent: 'explanation_request',
      reasonRequest: 'reason',
    }),
    solution,
    ...over,
  });
}

function spoken(events: Awaited<ReturnType<typeof runUnderstanding>>['events']): string {
  return events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join(' ');
}

describe('solutionReasonReply', () => {
  it('menyebut ukurannya lalu dasarnya dari jalur utama', () => {
    const text = solutionReasonReply(solution, 'id')!;
    expect(text).toContain('Pipa distribusi utama 1¼"');
    expect(text).toContain('Beban suplai 18 unit');
  });

  it('solusi tanpa jejak tidak dijawab dengan kalimat kosong', () => {
    expect(
      solutionReasonReply(
        {
          recommendation: { systemLines: [] } as unknown as ActiveSolution['recommendation'],
          stale: false,
        },
        'id',
      ),
    ).toBeNull();
  });
});

describe('runUnderstanding — pertanyaan dasar ukuran', () => {
  it('"kenapa segitu?" dijawab dasarnya, bukan ringkasan ukuran lagi', async () => {
    const { events } = await ask('kenapa segitu?');
    const text = spoken(events);
    expect(text).toContain('Beban suplai 18 unit');
    expect(text).not.toContain('Dasar tiap angka ada di');
  });

  it('ringkasan ukuran yang sama di giliran sebelumnya tidak membuatnya jadi "sudah saya jelaskan"', async () => {
    const { events } = await ask('kenapa segitu?', {
      recentTurns: [
        { role: 'user', text: 'pipa utamanya ukuran berapa?' },
        {
          role: 'assistant',
          text: 'Sistem distribusi untuk 10 titik air. Pipa distribusi utama 1¼" (sumber → titik air tertinggi). Dasar tiap angka ada di "Tampilkan detail teknis" pada layar solusi.',
        },
      ],
    });
    expect(spoken(events)).toContain('Beban suplai 18 unit');
  });

  it('tanpa pertanyaan dasar, jawabannya tetap ringkasan ukurannya', async () => {
    const message = 'pipa utamanya ukuran berapa?';
    const { events } = await ask(message, {
      understanding: understood(message, { intent: 'explanation_request' }),
    });
    const text = spoken(events);
    expect(text).toContain('Sistem distribusi untuk 10 titik air');
    expect(text).not.toContain('Beban suplai 18 unit');
  });

  it('solusi yang belum ada: dasarnya tidak dikarang', async () => {
    const { events } = await ask('kenapa segitu?', { solution: null });
    expect(spoken(events)).not.toContain('Beban suplai');
  });
});
