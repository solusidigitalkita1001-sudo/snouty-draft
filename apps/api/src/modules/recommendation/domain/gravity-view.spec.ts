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

  it('air hujan butuh tangkapan + intensitas; drainase butuh debit; cluster butuh sambungan + jalur + statis', () => {
    expect(
      gravityPlanFrom(technical('stormwater', { catchment_area: known('Luas tangkapan', 0.5) })),
    ).toBeNull();
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
    ).toEqual({ connections: 120, routeLengthM: 600, staticHeadM: 8 });
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
    expect(bom[0]).toMatchObject({ item: 'Pipa PVC D', quantity: 2, unit: 'batang' });
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

  it('cluster: highlight sambungan + puncak di depan highlight bertekanan', () => {
    const network = computeNetwork({ connections: 120, routeLengthM: 600, staticHeadM: 8 });
    expect(networkHighlightsPrefix(network)).toEqual([
      { label: 'Sambungan', value: '120 unit' },
      { label: 'Kebutuhan puncak', value: '1,67 l/s (rata-rata 0,83 l/s)' },
    ]);
  });
});
