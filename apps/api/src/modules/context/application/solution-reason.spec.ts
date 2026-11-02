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
import { layoutReply, pressureReply, rodsReply, solutionReasonReply } from './solution-facts.js';

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

/**
 * P32-32 — pertanyaan tekanan atas solusi yang sudah dihitung. Produksi 2026-11-02: "berapa bar di
 * keran paling atas?" dijawab ringkasan ukuran pipa, dan angka barnya tidak disebut sama sekali.
 */
describe('pertanyaan tekanan', () => {
  const withPressure = {
    recommendation: {
      ...solution.recommendation,
      systemLines: [
        ...solution.recommendation.systemLines,
        {
          name: 'Tekanan yang dibutuhkan di meteran PDAM',
          path: 'Sumber air',
          size: '2,03 bar',
          reason:
            'Tinggi angkat total 20,67 m = beda tinggi 9 m + kehilangan di pipa 1 m + di sambungan 0,47 m + sisa tekanan di ujung 10,2 m (1 bar).',
          role: 'fitting',
          provenance: 'ASSUMED',
          traceIds: [],
        },
      ],
    } as unknown as ActiveSolution['recommendation'],
    stale: false,
  } satisfies ActiveSolution;

  it('dijawab angka barnya beserta rinciannya', () => {
    const text = pressureReply(withPressure, 'id')!;
    expect(text).toContain('2,03 bar');
    expect(text).toContain('sisa tekanan di ujung');
  });

  it('solusi tanpa baris tekanan tidak dijawab kalimat kosong', () => {
    expect(pressureReply(solution, 'id')).toBeNull();
  });

  it('"berapa bar di keran paling atas?" dijawab tekanannya, bukan ringkasan ukuran', async () => {
    const message = 'berapa bar di keran paling atas?';
    const { events } = await ask(message, {
      solution: withPressure,
      understanding: understood(message, { intent: 'explanation_request' }),
    });
    const text = spoken(events);
    expect(text).toContain('2,03 bar');
  });
});

/**
 * P32-35 — pertanyaan tekanan yang terbaca pertanyaan bentuk sistem. Produksi 2026-11-02:
 * "tekanannya cukup ga buat shower di atas?" dibacakan seluruh jalur solusinya, dan angka barnya
 * yang sudah dihitung tidak disebut sama sekali.
 *
 * P32-36 — nama baris dikecilkan seluruhnya, jadi "meteran PDAM" terbaca "meteran pdam".
 */
describe('pertanyaan tekanan atas bentuk sistem', () => {
  const pressureLine = {
    name: 'Tekanan yang dibutuhkan di meteran PDAM',
    path: 'Sumber air',
    size: '2,03 bar',
    reason: 'Tinggi angkat total 20,67 m = beda tinggi 9 m + sisa tekanan di ujung 10,2 m (1 bar).',
    role: 'fitting',
    provenance: 'ASSUMED',
    traceIds: [],
  };
  const withNeeds = {
    recommendation: {
      ...solution.recommendation,
      systemLines: [...solution.recommendation.systemLines, pressureLine],
      needs: [{ kind: 'booster_pump' }],
    } as unknown as ActiveSolution['recommendation'],
    stale: false,
  } satisfies ActiveSolution;

  it('dijawab angka barnya, bukan seluruh jalur dibacakan', async () => {
    const message = 'tekanannya cukup ga buat shower di atas?';
    const { events } = await ask(message, {
      solution: withNeeds,
      understanding: understood(message, { intent: 'system_layout_question' }),
    });
    const text = spoken(events);
    expect(text).toContain('2,03 bar');
    expect(text).not.toContain('Jalurnya:');
  });

  it('pertanyaan bentuk sistem tanpa tekanan tetap dijawab jalurnya', async () => {
    const message = 'bentuk instalasinya seperti apa?';
    const { events } = await ask(message, {
      solution: withNeeds,
      understanding: understood(message, { intent: 'system_layout_question' }),
    });
    expect(spoken(events)).toContain('Jalurnya:');
  });

  it('akronim di nama baris tidak dikecilkan', () => {
    expect(layoutReply(withNeeds, 'id')).toContain('meteran PDAM');
    expect(pressureReply(withNeeds, 'id')).toContain('meteran PDAM');
  });
});

/**
 * P32-49 — baris tekanan hanyut di daftar jalur. Produksi 2026-11-02, masjid 2 lantai dengan toren
 * atap: "jadi pipa utamanya berapa?" dijawab "… pipa deret wudhu 1½"; tekanan dari toren atap 0,11
 * bar (sumber air)" — angka itu kurang, dan solusinya sendiri sudah meminta pompa pendorong, tetapi
 * jawabannya tidak menyebutnya sama sekali.
 */
describe('tekanan yang kurang di jawaban bentuk sistem', () => {
  const tankLine = {
    name: 'Tekanan dari toren atap',
    path: 'Sumber air',
    size: '0,11 bar',
    reason: 'Dari toren atap, titik air tertinggi mendapat 0,11 bar. Itu di bawah 0,3 bar.',
    role: 'fitting',
    provenance: 'ASSUMED',
    traceIds: [],
  };
  const short = (needs: unknown[]) =>
    ({
      recommendation: {
        ...solution.recommendation,
        systemLines: [...solution.recommendation.systemLines, tankLine],
        needs,
      } as unknown as ActiveSolution['recommendation'],
      stale: false,
    }) satisfies ActiveSolution;

  it('tekanan tidak ikut dibacakan sebagai jalur, dan pompa pendorongnya disebut', () => {
    const text = layoutReply(short([{ kind: 'booster_pump', minimumStandM: 3.5 }]), 'id');
    expect(text).not.toContain('toren atap 0,11 bar (sumber air)');
    expect(text).toContain('Tekanan dari toren atap 0,11 bar di titik air tertinggi');
    expect(text).toContain('perlu pompa pendorong');
    expect(text).toContain('dinaikkan ke 3,5 m di atas atap');
  });

  it('tekanan yang cukup disebut apa adanya, tanpa pompa', () => {
    const text = layoutReply(short([{ kind: 'rooftop_tank' }]), 'id');
    expect(text).toContain('Tekanan dari toren atap 0,11 bar.');
    expect(text).not.toContain('pompa pendorong');
  });

  it('bahasa Inggris: kalimat tekanannya ikut', () => {
    const text = layoutReply(short([{ kind: 'booster_pump', minimumStandM: 3.5 }]), 'en');
    expect(text).toContain('needs a booster pump');
    expect(text).toContain('3.5 m above the roof');
  });
});

/**
 * P32-47 — dua peruntukan satu SKU ("Cabang · Sambungan ke alat") diucapkan dengan kata "dan",
 * dan huruf awal keduanya kecil di tengah kalimat (produksi 2026-11-02).
 */
describe('peruntukan ganda di daftar belanja', () => {
  const withBom = {
    recommendation: {
      ...solution.recommendation,
      bom: [
        {
          item: 'Pipa PVC AW',
          purpose: 'Cabang · Sambungan ke alat',
          size: '1/2"',
          quantity: 13,
          unit: 'batang',
        },
      ],
    } as unknown as ActiveSolution['recommendation'],
    stale: false,
  } satisfies ActiveSolution;

  it('diucapkan dengan "dan", tanpa titik tengah dan tanpa huruf besar di tengah kalimat', () => {
    const text = rodsReply(withBom, 'id')!;
    expect(text).toContain('cabang dan sambungan ke alat 1/2" 13 batang');
    expect(text).not.toContain(' · ');
  });

  it('bahasa Inggris memakai "and"', () => {
    expect(rodsReply(withBom, 'en')!).toContain('cabang and sambungan ke alat');
  });
});
