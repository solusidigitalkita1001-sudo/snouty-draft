/**
 * Kasus gorong-gorong (skenario E), drainase, air hujan, cluster: pemetaan parameter universal →
 * masukan engine, dan tampilan yang setiap angkanya dari hasil hitungan.
 */
import { describe, expect, it } from 'vitest';
import { computeGravity, computeNetwork } from '@snouty/engineering';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import {
  gravityAssumptionsFrom,
  gravityBomItemsFrom,
  gravityHighlights,
  gravityPlanFrom,
  gravityProse,
  gravitySystemLinesFrom,
  networkHighlightsPrefix,
  networkInputFrom,
} from './gravity-view.js';

const T0 = '2026-01-01T00:00:00.000Z';
const known = (label: string, value: number | string | boolean) => ({
  label,
  value,
  origin: 'known' as const,
});
const technical = (caseId: string, parameters: Record<string, ReturnType<typeof known>>) => ({
  ...emptyRequirementState(T0),
  useCase: { kind: 'technical' as const, caseId, parameters },
});

describe('gravityPlanFrom / networkInputFrom', () => {
  it('gorong-gorong: debit + lebar jalan + beban → masukan culvert; pipa = lebar jalan + 2 m', () => {
    const plan = gravityPlanFrom(
      technical('culvert', {
        design_flow: known('Debit rencana', 20),
        road_width: known('Lebar jalan', 6),
        traffic_load: known('Beban lalu lintas', 'Truk / berat'),
        burial_depth: known('Kedalaman tanam', 0.5),
      }),
    )!;
    expect(plan.input).toEqual({
      kind: 'culvert',
      designFlowLs: 20,
      coverDepthM: 0.5,
      trafficLoad: 'heavy',
    });
    expect(plan.pipeLengthM).toBe(8);
  });

  // Pilihan pemilik 2026-10-27 (OQ-86): atap dibagi ke turunan talangnya, permukaan tanah tidak.
  it('air hujan dari atap: permukaan dan jumlah turunan ikut ke engine', () => {
    expect(
      gravityPlanFrom(
        technical('stormwater', {
          catchment_area: known('Luas tangkapan', 0.24),
          catchment_surface: known('Air hujan dari', 'Atap bangunan'),
        }),
      )!.input,
    ).toEqual({ kind: 'stormwater', catchmentHa: 0.24, catchmentIsRoof: true });
    expect(
      gravityPlanFrom(
        technical('stormwater', {
          catchment_area: known('Luas tangkapan', 0.24),
          catchment_surface: known('Air hujan dari', 'Atap bangunan'),
          downspouts: known('Turunan talang', 6),
        }),
      )!.input,
    ).toEqual({
      kind: 'stormwater',
      catchmentHa: 0.24,
      catchmentIsRoof: true,
      downspouts: 6,
    });
    // Halaman dan jalan: satu saluran, tidak ada yang dibagi.
    expect(
      gravityPlanFrom(
        technical('stormwater', {
          catchment_area: known('Luas tangkapan', 0.24),
          catchment_surface: known('Air hujan dari', 'Permukaan tanah'),
        }),
      )!.input,
    ).toEqual({ kind: 'stormwater', catchmentHa: 0.24 });
  });

  it('air hujan butuh tangkapan (intensitas dari registry bila tidak disebut); drainase butuh debit; cluster butuh sambungan + jalur + statis', () => {
    // Intensitas belum diketahui: engine memakai RAINFALL_INTENSITY_150MMH (keputusan pemilik 2026-10-19).
    expect(
      gravityPlanFrom(technical('stormwater', { catchment_area: known('Luas tangkapan', 0.5) }))!
        .input,
    ).toEqual({ kind: 'stormwater', catchmentHa: 0.5 });
    expect(gravityPlanFrom(technical('stormwater', {}))).toBeNull();
    const storm = gravityPlanFrom(
      technical('stormwater', {
        total_area: known('Luas lahan', 0.5),
        rainfall_intensity: known('Intensitas hujan', 100),
        slope: known('Kemiringan', 1),
      }),
    )!;
    expect(storm.input).toEqual({
      kind: 'stormwater',
      catchmentHa: 0.5,
      rainfallMmPerHour: 100,
      slopePercent: 1,
    });
    expect(
      gravityPlanFrom(technical('gravity_drainage', { design_flow: known('Debit', 20) }))!.input,
    ).toEqual({ kind: 'drainage', designFlowLs: 20 });
    expect(
      networkInputFrom(
        technical('residential_cluster', { number_of_connections: known('Sambungan', 120) }),
      ),
    ).toBeNull();
    expect(
      networkInputFrom(
        technical('residential_cluster', {
          number_of_connections: known('Sambungan', 120),
          route_length: known('Jalur', 600),
          static_head: known('Statis', 8),
        }),
      ),
    ).toEqual({ connections: 120, routeLengthM: 600, staticHeadM: 8, kind: 'cluster' });
  });
});

describe('tampilan gravitasi', () => {
  const result = computeGravity({
    kind: 'culvert',
    designFlowLs: 20,
    coverDepthM: 0.5,
    trafficLoad: 'heavy',
  });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));

  it('highlights, baris sistem (pipa + timbunan), BOM gorong-gorong, asumsi + catatan struktur, prosa', () => {
    const h = gravityHighlights(result, 1);
    expect(h.map((x) => x.label)).toEqual([
      'Debit rencana',
      'Pipa',
      'Kemiringan',
      'Kapasitas penuh',
      'Timbunan',
      'Produk Pralon',
    ]);
    expect(h[4]!.value).toBe('Perlu validasi struktural');
    const lines = gravitySystemLinesFrom(result, traces);
    expect(lines.map((l) => l.role)).toEqual(['main', 'fitting']);
    const bom = gravityBomItemsFrom(result, 8, traces);
    // Tanpa panjang batang dari produk katalog → meter, bukan batang 4 m karangan.
    expect(bom[0]).toMatchObject({ item: 'Pipa PVC D', quantity: 8, unit: 'meter' });
    const stocked = gravityBomItemsFrom(result, 8, traces, 'id', {
      meters: 4,
      productName: 'Pipa (Plain End) Abu D 8" x 4 Meter',
    });
    expect(stocked[0]).toMatchObject({ quantity: 2, unit: 'batang' });
    expect(stocked[0]!.basis).toContain('Panjang bersih 8 m (jalur 8 m) ÷ 4 m per batang');
    expect(bom.some((b) => b.item.includes('selubung beton'))).toBe(true);
    const assumptions = gravityAssumptionsFrom(result, traces);
    expect(assumptions.map((a) => a.assumptionId)).toEqual(
      expect.arrayContaining(['MANNING_N_PLASTIC', 'GRAVITY_SLOPE_MIN_0_5']),
    );
    expect(assumptions.at(-1)!.text).toContain('struktur');
    const prose = gravityProse(result);
    expect(prose.headline).toContain('Gorong-gorong');
    expect(prose.body).toContain('validasi struktural');
  });

  it('air hujan atap: limpasan total, jumlah turunan, debit per turunan, pipa dan fitting per turunan', () => {
    const roof = computeGravity({ kind: 'stormwater', catchmentHa: 0.24, catchmentIsRoof: true });
    const roofTraces = roof.traces.map((t, i) => ({ ...t, id: `R${i}` }));
    const h = gravityHighlights(roof, 3);
    expect(h.slice(0, 3)).toEqual([
      { label: 'Limpasan total', value: '60,05 l/s' },
      { label: 'Turunan talang', value: '8 titik (tangkapan 0,03 ha per turunan)' },
      { label: 'Debit per turunan', value: '7,51 l/s' },
    ]);
    const prose = gravityProse(roof);
    expect(prose.headline).toBe(
      'Drainase air hujan: pipa PVC D 6" di tiap 8 turunan talang untuk 7,51 l/s per turunan',
    );
    expect(prose.body).toContain('Limpasan seluruh atap 60,05 l/s dibagi rata ke 8 turunan talang');
    // Panjang yang disebut berlaku untuk satu turunan; jumlah pipa dan fittingnya mengikuti.
    const bom = gravityBomItemsFrom(roof, 10, roofTraces);
    expect(bom[0]).toMatchObject({ item: 'Pipa PVC D', quantity: 80, unit: 'meter' });
    expect(bom[0]!.basis).toContain('10 m per turunan × 8 turunan');
    expect(bom.find((b) => b.item === 'Elbow 45°')).toMatchObject({ quantity: 16 });
    const assumptions = gravityAssumptionsFrom(roof, roofTraces);
    expect(assumptions.find((a) => a.assumptionId === 'DOWNSPOUT_SPACING_15M')?.fieldPath).toBe(
      'downspouts',
    );
    // Inggris: angka yang sama, kalimat Inggris.
    const en = gravityHighlights(roof, 3, 'en');
    expect(en.slice(0, 3).map((x) => x.label)).toEqual([
      'Total runoff',
      'Downspouts',
      'Flow per downspout',
    ]);
    expect(gravityProse(roof, 'en').body).toContain('Runoff from the whole roof is 60.05 l/s');
  });

  it('cluster: highlight sambungan + puncak di depan highlight bertekanan', () => {
    const network = computeNetwork({ connections: 120, routeLengthM: 600, staticHeadM: 8 });
    expect(networkHighlightsPrefix(network)).toEqual([
      { label: 'Sambungan', value: '120 unit' },
      { label: 'Kebutuhan puncak', value: '1,67 l/s (rata-rata 0,83 l/s)' },
    ]);
  });
});

describe('tampilan gravitasi: dua bahasa', () => {
  const result = computeGravity({
    kind: 'culvert',
    designFlowLs: 20,
    coverDepthM: 0.5,
    trafficLoad: 'heavy',
  });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));

  it('highlights: id tak berubah, en Inggris dengan angka sama', () => {
    const idRows = gravityHighlights(result, 1, 'id');
    expect(idRows).toEqual(gravityHighlights(result, 1));
    const en = gravityHighlights(result, 1, 'en');
    expect(en).toHaveLength(idRows.length);
    expect(en.map((x) => x.label)).toEqual([
      'Design flow',
      'Pipe',
      'Slope',
      'Full-flow capacity',
      'Cover',
      'Pralon products',
    ]);
    expect(en[4]!.value).toBe('Needs structural validation');
    expect(en[0]!.value).toBe(`${String(result.designFlowLs)} l/s`);
    expect(en[3]!.value).toContain('% used');
  });

  it('baris sistem, BOM, asumsi: jumlah sama, teks Inggris', () => {
    const idL = gravitySystemLinesFrom(result, traces);
    const enL = gravitySystemLinesFrom(result, traces, 'en');
    expect(enL).toHaveLength(idL.length);
    expect(enL[0]!.name).toBe('Culvert PVC D');
    expect(enL[0]!.path).toBe('Upstream → downstream across the road');
    expect(enL[1]!.name).toBe('Cover and road load');
    expect(enL.map((l) => l.traceIds)).toEqual(idL.map((l) => l.traceIds));

    const idB = gravityBomItemsFrom(result, 8, traces, 'id');
    const enB = gravityBomItemsFrom(result, 8, traces, 'en');
    expect(enB).toHaveLength(idB.length);
    expect(enB.map((b) => b.quantity)).toEqual(idB.map((b) => b.quantity));
    expect(enB[0]!.item).toBe('PVC D pipe');
    expect(idB[0]!.item).toBe('Pipa PVC D');
    expect(enB.at(-1)!.item).toBe('PVC solvent cement');

    const idA = gravityAssumptionsFrom(result, traces);
    const enA = gravityAssumptionsFrom(result, traces, 'en');
    expect(enA).toHaveLength(idA.length);
    expect(enA.at(-1)!.text).toContain('structural');
    expect(enA[0]!.text).toMatch(/^How it is worked out: /);
    expect(enA[0]!.text).not.toMatch(/ENG-\d/);
  });

  it('prosa dan cluster', () => {
    expect(gravityProse(result, 'id')).toEqual(gravityProse(result));
    const en = gravityProse(result, 'en');
    expect(en.headline).toContain('Culvert:');
    expect(en.body).toContain('structural validation is required');
    expect(en.body).toContain(`${String(result.slopePercent)} %`);

    const network = computeNetwork({ connections: 120, routeLengthM: 600, staticHeadM: 8 });
    expect(networkHighlightsPrefix(network, 'en')).toEqual([
      { label: 'Connections', value: '120 units' },
      { label: 'Peak demand', value: '1.67 l/s (average 0.83 l/s)' },
    ]);
  });
});

describe('tampilan gravitasi: penjelasan trace dan catatan struktur dua bahasa (P15-04b)', () => {
  it("dihitung dengan 'en' → alasan pipa dan catatan timbunan berbahasa Inggris", () => {
    const input = {
      kind: 'culvert',
      designFlowLs: 20,
      coverDepthM: 0.5,
      trafficLoad: 'heavy',
    } as const;
    const idResult = computeGravity(input);
    const enResult = computeGravity(input, 'en');
    const idTraces = idResult.traces.map((t, i) => ({ ...t, id: `T${i}` }));
    const enTraces = enResult.traces.map((t, i) => ({ ...t, id: `T${i}` }));
    const id = gravitySystemLinesFrom(idResult, idTraces, 'id');
    const en = gravitySystemLinesFrom(enResult, enTraces, 'en');
    expect(en.map((l) => l.size)).toEqual(id.map((l) => l.size));
    en.forEach((line, i) => expect(line.reason).not.toBe(id[i]!.reason));
    expect(en[0]!.reason).toContain('Gravity pipe');
    expect(en[1]!.reason).toContain('structural validation is mandatory');
    expect(id[1]!.reason).toContain('wajib validasi struktural');
  });
});
