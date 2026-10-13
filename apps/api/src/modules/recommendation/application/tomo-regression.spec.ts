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
  it('air bersih: pipa utama 1"; cabang per isi (ENG-707): lantai 2 (2 KM) 1", lantai 1 (1 KM + dapur) ¾"; sambungan ½"', async () => {
    const { rec } = await analyse();
    // 3 kamar mandi × 2 titik + 1 dapur (asumsi) = 7 titik; WSFU 3 × 3,2 + 1 = 10,6 → ±0,95 l/s;
    // ¾" (dalam 24 mm) 2,1 m/s > 2 m/s, 1" (29,6 mm) 1,38 m/s.
    expect(rec.stats.outletCount).toBe(7);
    expect(rec.stats.mainSize).toBe('1"');
    expect(rec.stats.branchCount).toBe(2);
    const line = (name: string) => rec.systemLines.find((l) => l.name === name)!;
    expect(line('Pipa distribusi utama').size).toBe('1"');
    // Temuan laporan 0009 (B): debit cabang dari isinya, bukan rata-rata 10,6 ÷ 2.
    // 2 KM = 2 × (2,2 + 1) = 6,4 unit ≈ 0,7 l/s → dalam ≥ 24,2 mm pada 1,5 m/s → 1".
    // 1 KM + dapur = 3,2 + 1 = 4,2 unit → ¾".
    expect(line('Cabang 2 kamar mandi')).toMatchObject({
      size: '1"',
      path: 'Pipa utama → 2 kamar mandi (1 cabang)',
    });
    expect(line('Cabang 1 kamar mandi + 1 bak cuci dapur')).toMatchObject({ size: '3/4"' });
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

  it('material tanpa ukuran rumah: tidak ada panjang pipa, tee, atau reducer; fitting dari asumsi registry saja; tidak ada SKU ganda', async () => {
    const { rec } = await analyse();
    // Panjang pipa dan sambungan cabang butuh ukuran rumah — tetap tidak ada angka (laporan 0002).
    // Baris yang belum dihitung (sok, dop, stop kran, lem — review 0015) tidak punya angka.
    const counted = rec.bom.filter((b) => !b.pending);
    expect(counted.some((b) => b.unit !== 'pcs')).toBe(false);
    expect(rec.bom.some((b) => /tee|reducer/i.test(b.item))).toBe(false);
    // Fitting P18-01 (keputusan pemilik 2026-10-13): dari jumlah jalur dan titik, asumsi registry,
    // dengan dasar perhitungannya — bukan rumus prototipe ENG-009 yang dibuang.
    for (const row of counted) {
      expect(row.provenance).toBe('ASSUMED');
      expect(row.calc).toBeDefined();
      expect(row.traceIds.length).toBeGreaterThan(0);
    }
    const ids = rec.bom.map((b) => b.productId).filter((id) => id !== undefined);
    expect(new Set(ids).size).toBe(ids.length);
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
    // Pipa dan sambungan cabang; fitting P18-01 diuji terpisah.
    const rows = rec.bom
      .filter((b) => !b.pending && (b.unit !== 'pcs' || /^Tee/.test(b.item)))
      .map((b) => `${b.item} ${b.size} ${b.quantity} ${b.unit}`);
    // Sisa potong 10% sebelum pembulatan (review laporan 0015).
    // Air bersih: utama 1" 25,5 m → 28,05 m → 8 batang; cabang 1" dan ¾" 12 m → 13,2 m → 4;
    // sambungan ½" 10,5 m → 11,55 m → 3; tee 1" 1 (cabang ujung pipa utama memakai elbow).
    // Pembuangan: air kotor 4" 15,5 m → 17,05 m → 5; air bekas 2" 15,5 m → 5; ventilasi 8 m → 8,8 m:
    // 2" ventilasi air kotor 3 batang — baris sendiri, tidak digabung dengan air bekas 2" (beda
    // sistem); 1¼" tanpa produk → 9 meter.
    expect(rows).toEqual([
      // 1": utama (8) + cabang lantai 2 (4) — satu produk, satu sistem, digabung.
      'Pipa PVC AW 1" 12 batang',
      'Pipa PVC AW 3/4" 4 batang',
      'Pipa PVC AW 1/2" 3 batang',
      'Tee cabang 1" 1 pcs',
      'Pipa PVC D 4" 5 batang',
      'Pipa PVC D 2" 5 batang',
      'Pipa PVC D 2" 3 batang',
      'Pipa PVC D 1¼" 9 meter',
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
