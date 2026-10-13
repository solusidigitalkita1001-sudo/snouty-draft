/**
 * P7-08a — perakitan rekomendasi: invarian T-1 (setiap nilai punya trace), REC-1
 * (prosa ditolak lalu diganti templat), dan urutan "hitung dulu, baru jelaskan".
 */
import { describe, expect, it, vi } from 'vitest';
import { computeSolution, type SolutionInput } from '@snouty/engineering';
import {
  assembleRecommendation,
  templateProse,
  withPrintedMaterialCount,
  type ProseWriter,
} from './recommendation-assembler.js';
import type { IdentifiedTrace } from '../domain/solution-view.js';

const INPUT: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
};

const SOLUTION = computeSolution(INPUT);
const TRACES: readonly IdentifiedTrace[] = SOLUTION.traces.map((trace, index) => ({
  ...trace,
  id: `01JBTRACE${String(index).padStart(17, '0')}`,
}));

const BASE = {
  recommendationId: '01JBREC00000000000000000AA',
  conversationId: '01JBCONV0000000000000000BB',
  snapshotId: '01JBSNAP0000000000000000CC',
  catalogVersionId: '01JBCATV0000000000000000DD',
  solution: SOLUTION,
  traces: TRACES,
  products: [],
  requirementAssumptions: [],
  now: '2026-01-01T00:00:00.000Z',
};

function writer(headline: string, body: string): ProseWriter {
  return { write: vi.fn(() => Promise.resolve({ headline, body })) };
}

describe('assembleRecommendation', () => {
  it('tanpa penulis prosa: memakai templat deterministik', async () => {
    const { recommendation, proseSource } = await assembleRecommendation(BASE, null);
    expect(proseSource).toBe('template');
    expect(recommendation.headline).toContain('11 titik air');
  });

  it('prosa yang patuh REC-1 dipakai apa adanya', async () => {
    const prose = writer(
      'Sistem distribusi gravitasi',
      'Ada 11 titik air dengan 4 cabang, jalur utama 1".',
    );
    const { proseSource } = await assembleRecommendation(BASE, prose);
    expect(proseSource).toBe('llm');
  });

  it('prosa ber-angka asing diminta ulang sekali, lalu lolos', async () => {
    let call = 0;
    const prose: ProseWriter = {
      write: vi.fn(() => {
        call += 1;
        return Promise.resolve(
          call === 1
            ? { headline: 'Perlu 12 batang', body: 'Sekitar 12 batang pipa.' }
            : { headline: 'Sistem distribusi', body: 'Ada 11 titik air dan 4 cabang.' },
        );
      }),
    };
    const { proseSource } = await assembleRecommendation(BASE, prose);
    expect(proseSource).toBe('llm_retry');
    expect(prose.write).toHaveBeenCalledTimes(2);
  });

  it('dua kali gagal REC-1: templat deterministik, TIDAK ada percobaan ketiga', async () => {
    const prose = writer('Perlu 12 batang', 'Sekitar 99 batang pipa.');
    const { recommendation, proseSource } = await assembleRecommendation(BASE, prose);
    expect(proseSource).toBe('template');
    expect(prose.write).toHaveBeenCalledTimes(2);
    // Angka asing tidak pernah sampai ke pengguna.
    expect(recommendation.body).not.toContain('99');
    expect(recommendation.headline).not.toContain('12');
  });

  it('LLM melempar: solusi tetap tersusun dengan templat', async () => {
    const prose: ProseWriter = { write: vi.fn(() => Promise.reject(new Error('LLM mati'))) };
    const { proseSource, recommendation } = await assembleRecommendation(BASE, prose);
    expect(proseSource).toBe('template');
    expect(recommendation.stats.outletCount).toBe(11);
  });

  it('templat deterministik selalu lulus pemeriksaan REC-1 sendiri', async () => {
    // Bila templat sendiri bisa gagal, jalur terakhir tidak punya jalur terakhir.
    const { recommendation } = await assembleRecommendation(BASE, null);
    const prose = writer(recommendation.headline, recommendation.body);
    const again = await assembleRecommendation(BASE, prose);
    expect(again.proseSource).toBe('llm');
  });
});

describe('invarian T-1 — setiap nilai punya trace', () => {
  it('setiap baris sistem membawa setidaknya satu traceId', async () => {
    const { recommendation } = await assembleRecommendation(BASE, null);
    for (const line of recommendation.systemLines) {
      expect(line.traceIds.length, line.name).toBeGreaterThan(0);
    }
  });

  it('setiap baris BOM membawa traceId dan dasar perhitungan dari trace', async () => {
    const { recommendation } = await assembleRecommendation(BASE, null);
    for (const item of recommendation.bom) {
      expect(item.traceIds.length).toBeGreaterThan(0);
      expect(item.basis.length).toBeGreaterThan(10);
    }
  });

  it('dasar perhitungan material dari panjang jalur dan batang katalog, bukan dari prosa LLM', async () => {
    const solution = computeSolution({ ...INPUT, planLengthM: 8, planWidthM: 15 });
    const traces = solution.traces.map((trace, index) => ({ ...trace, id: `t${index}` }));
    const prose = writer('Judul', 'Penjelasan yang sama sekali berbeda.');
    const { recommendation } = await assembleRecommendation(
      { ...BASE, solution, traces, mainStock: { meters: 4, productName: 'Pipa AW 1" x 4 Meter' } },
      prose,
    );
    expect(recommendation.bom[0]!.basis).toContain('Panjang bersih');
    expect(recommendation.bom[0]!.basis).not.toContain('Penjelasan');
  });

  it('tanpa ukuran rumah tidak ada baris material', async () => {
    const { recommendation } = await assembleRecommendation(BASE, null);
    expect(recommendation.bom).toEqual([]);
  });
});

describe('provenance dan asumsi', () => {
  it('solusi mewarisi provenance terlemah engine (ASSUMED hari ini)', async () => {
    const { recommendation } = await assembleRecommendation(BASE, null);
    expect(recommendation.overallProvenance).toBe('ASSUMED');
    for (const line of recommendation.systemLines) expect(line.provenance).toBe('ASSUMED');
  });

  it('asumsi tinggi lantai muncul dengan fieldPath yang bisa dibuka', async () => {
    const { recommendation } = await assembleRecommendation(BASE, null);
    const floorHeight = recommendation.assumptions.find(
      (a) => a.fieldPath === 'building.floorHeightM',
    );
    expect(floorHeight?.ruleId).toBe('ENG-004');
  });

  it('asumsi kebutuhan pengguna didahulukan dari asumsi aturan', async () => {
    const { recommendation } = await assembleRecommendation(
      {
        ...BASE,
        requirementAssumptions: [
          {
            text: 'Sumber distribusi adalah toren atap.',
            fieldPath: 'water.source',
            ruleId: 'ENG-014',
          },
        ],
      },
      null,
    );
    expect(recommendation.assumptions[0]!.fieldPath).toBe('water.source');
  });

  it('tanpa ENG-004 (tinggi lantai diberikan) tidak ada asumsi tinggi lantai', async () => {
    const solution = computeSolution({ ...INPUT, floorHeightM: 3 });
    const traces = solution.traces.map((trace, index) => ({ ...trace, id: `t${index}` }));
    const { recommendation } = await assembleRecommendation({ ...BASE, solution, traces }, null);
    expect(recommendation.assumptions.some((a) => a.ruleId === 'ENG-004')).toBe(false);
  });
});

describe('templateProse', () => {
  it('menyusun kalimat dari statistik, tanpa angka tambahan', () => {
    const result = templateProse({
      outletCount: 8,
      mainSize: '1"',
      branchCount: 2,
      fixtureConnectionSize: '1/2"',
      productCount: 4,
    });
    expect(result.body).toContain('8 titik air');
    expect(result.body).toContain('4 produk');
  });

  it('en: kalimat Inggris, tunggal untuk satu cabang dan satu produk', () => {
    const result = templateProse(
      {
        outletCount: 3,
        mainSize: '3/4"',
        branchCount: 1,
        fixtureConnectionSize: '1/2"',
        productCount: 1,
      },
      'en',
    );
    expect(result.headline).toBe('Distribution system for 3 water outlets');
    expect(result.body).toContain('served by 1 branch.');
    expect(result.body).toContain('There is 1 Pralon product');
  });
});

describe('jumlah produk di ringkasan (review laporan 0015)', () => {
  it('hanya produk yang punya jumlah di BOQ; yang menyusul tidak ikut', () => {
    const product = (productId: string, role: 'main' | 'fitting') => ({
      productId,
      role,
      size: '4"',
      matchState: 'VERIFIED_SELECTED' as const,
      reason: '',
      name: productId,
    });
    const rec = withPrintedMaterialCount({
      stats: {
        outletCount: 6,
        mainSize: '1"',
        branchCount: 2,
        fixtureConnectionSize: '1/2"',
        productCount: 2,
      },
      body: 'Pipa utama 1".',
      products: [product('D4', 'main'), product('Y4', 'fitting')],
      bom: [
        {
          item: 'Pipa PVC D',
          productId: 'D4',
          size: '4"',
          quantity: 5,
          unit: 'batang',
          basis: '',
          provenance: 'ASSUMED',
          traceIds: [],
        },
      ],
    } as never);
    expect(rec.stats.productCount).toBe(1);
  });
});
