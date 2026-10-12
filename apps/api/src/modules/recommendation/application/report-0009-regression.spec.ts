/**
 * Regresi laporan SNTY-2026-10-0009 ("masjid cibinong raya", 12 Okt 2026): komersial ringan, 2 lantai,
 * PDAM, air bersih + pembuangan, 4 kamar mandi, 8 wastafel, 0 dapur, bangunan 10 × 8 m, tanah
 * 15 × 12 m. Data diambil dari snapshot produksi. Harapan dihitung tangan dari tabel IPC yang
 * disebut di aturan, bukan disalin dari keluaran engine.
 */
import { DEFAULT_LOCALE, type Recommendation, type RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import type { TraceToSave } from '../domain/recommendation.repository.js';
import { AnalysisService } from './analysis.service.js';

const T0 = '2026-10-12T05:00:00.000Z';

export const STATE_0009: RequirementState = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'light_commercial', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 4, source: 'user_stated' },
      { path: 'fixtures.basins', value: 8, source: 'user_stated' },
      { path: 'fixtures.kitchens', value: 0, source: 'user_stated' },
      { path: 'water.source', value: 'municipal', source: 'user_stated' },
      { path: 'water.installationType', value: 'both', source: 'user_stated' },
      {
        path: 'building.dimensions',
        value: { lengthM: 10, widthM: 8, landLengthM: 15, landWidthM: 12 },
        source: 'user_stated',
      },
    ],
    T0,
  ).state,
);

export async function analyse0009(
  catalog: readonly import('@snouty/shared-types').Product[] = [],
): Promise<{ rec: Recommendation; traces: readonly TraceToSave[] }> {
  let saved: { rec: Recommendation; traces: readonly TraceToSave[] } | null = null;
  const service = new AnalysisService(
    { findVersionById: async () => null } as never,
    {
      save: async (rec: Recommendation, traces: readonly TraceToSave[]) => {
        saved = { rec, traces };
      },
    } as never,
    { markSolutionReady: async () => undefined } as never,
    null,
    {
      activeVersion: async () =>
        ({ id: 'V'.repeat(26), label: 'erp-uji', kind: 'pralon', status: 'active' }) as never,
      listProducts: async () => ({ items: [], nextCursor: null }),
      candidatesFor: async ({ family, categoryIncludes }) =>
        catalog.filter(
          (p) =>
            p.family === family &&
            (categoryIncludes === undefined || p.category.includes(categoryIncludes)),
        ),
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), STATE_0009, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

describe('regresi laporan SNTY-2026-10-0009 — A: cabang per lantai dan pipa tegak', () => {
  it('air bekas tidak lagi 2": per lantai 2 × 2 + 4 × 1 = 8 DFU (> 6 cabang 2"), stack 16 (> 10) → 2½"', async () => {
    const { rec, traces } = await analyse0009();
    const size = (name: string) => rec.systemLines.find((l) => l.name === name)?.size;
    expect(size('Pipa air bekas PVC D')).toBe('2½"');
    expect(size('Pipa ventilasi air bekas')).toBe('1¼"');
    expect(size('Pipa air kotor PVC D')).toBe('4"');
    expect(traces.filter((t) => t.ruleId === 'ENG-604')).toHaveLength(2);
    expect(rec.systemLines.find((l) => l.name === 'Pipa air bekas PVC D')!.reason).toContain(
      'IPC 710.1(2)',
    );
  });
});

describe('regresi laporan SNTY-2026-10-0009 — B: cabang air bersih dari isinya', () => {
  it('cabang 2 KM (6,4 unit ≈ 0,7 l/s, dalam ≥ 24,2 mm) → 1", bukan 3/4" dari rata-rata 16,8 ÷ 4', async () => {
    const { rec } = await analyse0009();
    const branches = rec.systemLines.filter(
      (l) => l.role === 'branch' && l.name.startsWith('Cabang'),
    );
    expect(branches.map((l) => [l.name, l.size, l.path])).toEqual([
      ['Cabang 2 kamar mandi', '1"', 'Pipa utama → 2 kamar mandi (2 cabang)'],
      ['Cabang 4 wastafel', '1/2"', 'Pipa utama → 4 wastafel (2 cabang)'],
    ]);
    expect(rec.stats.branchCount).toBe(4);
  });
});

describe('regresi laporan SNTY-2026-10-0009 — C: fitting', () => {
  let seq = 0;
  const verified = (value: string) => ({ provenance: 'VERIFIED', value }) as never;
  const unavailable = { provenance: 'UNAVAILABLE', value: null } as never;
  const item = (family: string, category: string, name: string, sizes: string[]) =>
    ({
      id: `Q${String(++seq).padStart(25, '0')}`,
      sku: `Q-${seq}`,
      name,
      family,
      category,
      description: '',
      status: 'active',
      sizes,
      material: verified('uPVC'),
      standard: unavailable,
      pressureClass: unavailable,
      rodLength: unavailable,
      jointType: unavailable,
      application: unavailable,
      sourceDocument: 'Export ERP uji',
      sourcePage: 1,
      catalogVersionId: 'V'.repeat(26),
      imageUrl: null,
    }) as unknown as import('@snouty/shared-types').Product;
  const CATALOG = [
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1 1/4" x 4 Meter', ['1 1/4"']),
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1" x 4 Meter', ['1"']),
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1/2" x 4 Meter', ['1/2"']),
    item('PVC D', 'PIPA AIR BUANGAN', 'Pipa (TS End) Abu D 4" x 4 Meter', ['4"']),
    item('FITTING PVC', 'FITTING', 'Tee Abu Ts 1 1/4"', ['1 1/4"']),
    item('FITTING PVC', 'FITTING', 'Bell Reducer - W 1 1/4" x 1"', ['1 1/4"', '1"']),
    item('FITTING PVC', 'FITTING', 'Bell Reducer - W 1 1/4" x 1/2"', ['1 1/4"', '1/2"']),
    // Laporan 0009 mencetak Y 4" × 2½" untuk jalur 4": tidak boleh lagi.
    item('FITTING PVC', 'FITTING', 'Y - D 4" x 2 1/2"', ['4"', '2 1/2"']),
    item('FITTING PVC', 'FITTING', 'Long Y - D 4"', ['4"']),
  ];
  const nameOf = (id: string | undefined) => CATALOG.find((p) => p.id === id)?.name;

  it('tidak ada fitting yang ukurannya tidak cocok; Y air kotor 4" sama sisi', async () => {
    const { rec } = await analyse0009(CATALOG);
    const fittings = rec.products
      .filter((p) => p.role === 'fitting')
      .map((p) => nameOf(p.productId));
    expect(fittings).not.toContain('Y - D 4" x 2 1/2"');
    expect(fittings).toContain('Long Y - D 4"');
  });

  it('pipa utama 1¼" ke cabang 1" dan 1/2": tee + reducer per cabang, bukan tee sama sisi saja', async () => {
    const { rec } = await analyse0009(CATALOG);
    const rows = rec.bom
      .filter((b) => b.unit === 'pcs')
      .map((b) => `${b.item} ${b.size} ${b.quantity} ${nameOf(b.productId) ?? '-'}`);
    expect(rows).toEqual([
      // Satu tee sama sisi untuk keempat cabang (produk sama, digabung).
      `Tee cabang ${rec.stats.mainSize} 4 Tee Abu Ts 1 1/4"`,
      `Reducer cabang ${rec.stats.mainSize} × 1" 2 Bell Reducer - W 1 1/4" x 1"`,
      `Reducer cabang ${rec.stats.mainSize} × 1/2" 2 Bell Reducer - W 1 1/4" x 1/2"`,
    ]);
  });
});

describe('regresi laporan SNTY-2026-10-0009 — D: konsistensi angka dan teks', () => {
  it('air bekas memasukkan jalur turun: 10 + 3,5 + halaman 5 = 18,5 m, sama dengan air kotor', async () => {
    const { rec } = await analyse0009();
    const drains = rec.bom.filter((b) => b.item === 'Pipa PVC D');
    expect(drains.find((b) => b.size === '4"')!.basis).toContain('Panjang bersih 18,5 m');
    expect(drains.find((b) => b.size === '2½"')!.basis).toContain('Panjang bersih 18,5 m');
  });

  it('"Ada N produk Pralon" sama dengan jumlah baris material', async () => {
    const { rec } = await analyse0009();
    expect(rec.stats.productCount).toBe(rec.bom.length);
    expect(rec.body).toContain(`Ada ${rec.bom.length} produk Pralon`);
  });

  it('batas kecepatan satu sumber: 0,6–2 m/s, rencana 1,5 m/s; tidak ada "1–2 m/s"', async () => {
    const { traces } = await analyse0009();
    const text = traces.map((t) => t.explanation).join(' ');
    expect(text).toContain('0.6–2 m/s');
    expect(text).not.toMatch(/\b1–2 m\/s/);
  });

  it('bukan rumah tinggal: teks asumsi dan alasan tidak menyebut "rumah"', async () => {
    const { rec } = await analyse0009();
    const text = [
      ...rec.assumptions.map((a) => a.text),
      ...rec.systemLines.map((l) => l.reason),
      rec.body,
    ].join(' ');
    expect(text).not.toMatch(/\brumah\b/i);
  });
});
