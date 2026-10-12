/**
 * Regresi laporan SNTY-2026-10-0002 (pelanggan Tomo, 12 Okt 2026): rumah 2 lantai, PDAM, air bersih
 * + pembuangan, 3 kamar mandi; dapur, wastafel, dan ukuran rumah tidak disebut.
 *
 * Jalurnya sama dengan pembuatan laporan: `AnalysisService.run` → rekomendasi tersimpan →
 * `assembleReportPayload` → HTML laporan. Harapan dihitung dari aturan yang berlaku (Kelompok K + J),
 * bukan disalin dari keluaran engine.
 */
import {
  DEFAULT_LOCALE,
  type Product,
  type Recommendation,
  type RequirementState,
  type SpecValue,
} from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { assembleReportPayload } from '../../report/application/report-assembler.js';
import { renderReportHtml } from '../../report/application/report-html.js';
import type { TraceToSave } from '../domain/recommendation.repository.js';
import { AnalysisService } from './analysis.service.js';

const T0 = '2026-10-12T02:28:00.000Z';
const verified = (value: string) => ({ provenance: 'VERIFIED', value }) as unknown as SpecValue;
const unavailable = { provenance: 'UNAVAILABLE', value: null } as unknown as SpecValue;

let seq = 0;
function product(family: string, category: string, name: string, sizes: string[]): Product {
  seq += 1;
  return {
    id: `P${String(seq).padStart(25, '0')}`,
    sku: `SKU-${seq}`,
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
  } as unknown as Product;
}

const CATALOG: readonly Product[] = [
  product('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Putih AW 1" x 4 Meter', ['1"']),
  product('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Putih AW 3/4" x 4 Meter', ['3/4"']),
  product('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Putih AW 1/2" x 4 Meter', ['1/2"']),
  // Reducer yang kedua ujungnya sama — tidak boleh pernah dipilih.
  product('FITTING PVC', 'FITTING', 'Bell Reducer - W 1" x 1"', ['1"']),
  product('FITTING PVC', 'FITTING', 'Tee TS - W 1"', ['1"']),
  // Temuan laporan 0007: tutup pipa dan Y bercabang 10" tidak boleh mengisi peran tee / Y 4".
  product('FITTING PVC', 'FITTING', 'Cap - W 1"', ['1"']),
  product('FITTING PVC', 'FITTING', 'Long TY - D 10" x 4"', ['10"', '4"']),
  product('FITTING PVC', 'FITTING', 'Bell Long TY - D 4" x 4"', ['4"']),
  product('PVC D', 'PIPA AIR BUANGAN', 'Pipa (Plain End) Abu D 4" x 4 Meter', ['4"']),
  product('PVC D', 'PIPA AIR BUANGAN', 'Pipa (Plain End) Abu D 2" x 4 Meter', ['2"']),
];

const STATE: RequirementState = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
      { path: 'water.source', value: 'municipal', source: 'user_stated' },
      { path: 'water.installationType', value: 'both', source: 'user_stated' },
    ],
    T0,
  ).state,
);

async function analyse(
  state: RequirementState = STATE,
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
        CATALOG.filter(
          (p) =>
            p.family === family &&
            (categoryIncludes === undefined || p.category.includes(categoryIncludes)),
        ),
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), state, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

describe('regresi laporan SNTY-2026-10-0002 (Tomo)', () => {
  it('air bersih: pipa utama 1", 2 cabang ¾" (satu per lantai), sambungan ½"', async () => {
    const { rec } = await analyse();
    // 3 kamar mandi × 2 titik + 1 dapur (asumsi) = 7 titik; WSFU 3 × 3,2 + 1 = 10,6 → ±0,95 l/s;
    // ¾" (dalam 24 mm) 2,1 m/s > 2 m/s, 1" (29,6 mm) 1,38 m/s.
    expect(rec.stats.outletCount).toBe(7);
    expect(rec.stats.mainSize).toBe('1"');
    expect(rec.stats.branchCount).toBe(2);
    const line = (name: string) => rec.systemLines.find((l) => l.name === name)!;
    expect(line('Pipa distribusi utama').size).toBe('1"');
    expect(line('Cabang')).toMatchObject({
      size: '3/4"',
      path: 'Pipa utama → titik air (2 cabang)',
    });
    expect(line('Sambungan fixture').size).toBe('1/2"');
  });

  it('pembuangan: air kotor 4" (vent 2"), air bekas 2" (vent 1¼")', async () => {
    const { rec } = await analyse();
    const size = (name: string) => rec.systemLines.find((l) => l.name === name)?.size;
    expect(size('Pipa air kotor PVC D')).toBe('4"');
    expect(size('Pipa ventilasi air kotor')).toBe('2"');
    expect(size('Pipa air bekas PVC D')).toBe('2"');
    expect(size('Pipa ventilasi air bekas')).toBe('1¼"');
  });

  it('material: tanpa ukuran rumah tidak ada angka; tidak ada tee/elbow/reducer; tidak ada SKU ganda', async () => {
    const { rec } = await analyse();
    expect(rec.bom.some((b) => /tee|elbow|reducer/i.test(b.item))).toBe(false);
    const ids = rec.bom.map((b) => b.productId).filter((id) => id !== undefined);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rec.bom).toEqual([]);
    // Reducer berukuran sama tidak pernah menjadi produk terpilih.
    const reducer = CATALOG.find((p) => p.name.startsWith('Bell Reducer'))!;
    expect(rec.products.some((p) => p.productId === reducer.id)).toBe(false);
  });

  it('asumsi sejalan dengan aturan yang dijalankan: tidak ada "pembuangan belum dihitung"', async () => {
    const { rec } = await analyse();
    const text = rec.assumptions.map((a) => a.text).join(' ');
    expect(text).not.toMatch(/belum dihitung di sini|tim teknis Pralon menghitungnya/);
    expect(text).toContain('Cara hitung pembuangannya');
    expect(rec.assumptions.some((a) => a.assumptionId === 'HOUSE_KITCHEN_1')).toBe(true);
  });

  it('laporan mencetak data rekomendasi yang sama dengan engine, bukan teks templat sendiri', async () => {
    const { rec, traces } = await analyse();
    const payload = assembleReportPayload({
      reportNumber: 'SNTY-2026-10-9999',
      identity: {
        customerName: 'Tomo',
        projectLocation: 'Uji',
        consultationDate: '2026-10-12',
        installationType: 'Air bersih + pembuangan',
      },
      state: STATE,
      recommendation: rec,
      traces,
      catalogVersionLabel: 'erp-uji',
      pricing: { enabled: false, taxRatePercent: 11 },
    } as never);
    expect(payload.systemLines).toEqual(rec.systemLines);
    expect(payload.bom).toEqual(rec.bom);
    expect(payload.assumptions).toEqual(rec.assumptions);
    const html = renderReportHtml(payload);
    for (const line of rec.systemLines) expect(html).toContain(line.name);
    expect(html).not.toMatch(/Reducer 3\/4&quot;→3\/4|Reducer 3\/4"→3\/4/);
    expect(html).not.toContain('ambang 8 unit');
  });
});

describe('ukuran rumah disebut (temuan laporan SNTY-2026-10-0007)', () => {
  const SIZED: RequirementState = withCompleteness(
    mergeRequirement(
      STATE,
      [{ path: 'building.dimensions', value: { lengthM: 8, widthM: 12 }, source: 'user_stated' }],
      T0,
    ).state,
  );

  it('semua jalur air bersih dan pembuangan punya jumlah; rumus baku bertanda asumsi', async () => {
    const { rec } = await analyse(SIZED);
    const rows = rec.bom.map((b) => `${b.item} ${b.size} ${b.quantity} ${b.unit}`);
    // Air bersih: utama 1" (12 + 8 + 5,5 = 25,5 m → 7 batang); cabang ¾" 2 × 12 = 24 m → 6;
    // sambungan ½" 7 × 1,5 = 10,5 m → 3; tee 1" 2 buah.
    // Pembuangan: air kotor 4" 12 + 3,5 = 15,5 m → 4; air bekas 2" 12 m → 3; ventilasi
    // 2 × 3,5 + 1 = 8 m per jalur → 2" 2 batang + 1¼" 2 batang (tanpa produk 1¼" → meter).
    expect(rows).toEqual([
      'Pipa PVC AW 1" 7 batang',
      'Pipa PVC AW 3/4" 6 batang',
      'Pipa PVC AW 1/2" 3 batang',
      'Tee cabang 1" 2 pcs',
      'Pipa PVC D 4" 4 batang',
      'Pipa PVC D 2" 5 batang',
      'Pipa PVC D 1¼" 8 meter',
    ]);
    expect(
      rec.bom
        .filter((b) => b.item !== 'Pipa PVC AW' || b.size !== '1"')
        .every((b) => b.provenance === 'ASSUMED'),
    ).toBe(true);
  });

  it('tee dan Y dipilih menurut fungsi dan ukuran utamanya', async () => {
    const { rec } = await analyse(SIZED);
    const name = (id: string) => CATALOG.find((p) => p.id === id)!.name;
    const fittings = rec.products.filter((p) => p.role === 'fitting').map((p) => name(p.productId));
    expect(fittings).toEqual(['Tee TS - W 1"', 'Bell Long TY - D 4" x 4"']);
  });
});

describe('aturan A (laporan 0009) pada kasus rumah 0002', () => {
  it('cabang per lantai dan pipa tegak dicek; air bekas 4 + 4 DFU tetap 2", air kotor 4", utama 1"', async () => {
    const { rec, traces } = await analyse();
    expect(traces.filter((t) => t.ruleId === 'ENG-604')).toHaveLength(2);
    const size = (name: string) => rec.systemLines.find((l) => l.name === name)?.size;
    expect(size('Pipa air bekas PVC D')).toBe('2"');
    expect(size('Pipa air kotor PVC D')).toBe('4"');
    expect(size('Pipa distribusi utama')).toBe('1"');
  });
});
