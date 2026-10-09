/**
 * Kasus transfer pompa (skenario D brief) dan sumur → tandon. Yang dipaku: pemetaan parameter
 * universal → masukan engine (sumur: statis = kedalaman + tinggi tandon), keluarga dari bahan
 * atau dari panjang jalur (asumsi ber-ID), highlights dan prosa tanpa angka asing.
 */
import { describe, expect, it } from 'vitest';
import { computePressurized } from '@snouty/engineering';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import {
  pressurizedAssumptionsFrom,
  pressurizedBomItemsFrom,
  pressurizedHighlights,
  pressurizedPlanFrom,
  pressurizedProse,
  pressurizedSystemLinesFrom,
} from './pressurized-view.js';

const T0 = '2026-01-01T00:00:00.000Z';
const technical = (
  caseId: string,
  parameters: Record<
    string,
    { label: string; value: number | string | boolean; origin: 'known' | 'assumed' }
  >,
) => ({
  ...emptyRequirementState(T0),
  useCase: { kind: 'technical' as const, caseId, parameters },
});
const known = (label: string, value: number | string | boolean) => ({
  label,
  value,
  origin: 'known' as const,
});

describe('pressurizedPlanFrom', () => {
  it('transfer 5 l/s, 800 m, 12 m: HDPE karena jalur ≥ 200 m (asumsi ber-ID); bahan yang disebut menang', () => {
    const plan = pressurizedPlanFrom(
      technical('pump_transfer', {
        design_flow: known('Debit rencana', 5),
        route_length: known('Panjang jalur', 800),
        static_head: known('Tinggi statis', 12),
      }),
    )!;
    // Bahan ikut ke engine (tabel ukuran mm) walau dipilih dari panjang jalur, bukan disebut pengguna.
    expect(plan.input).toEqual({
      designFlowLs: 5,
      routeLengthM: 800,
      staticHeadM: 12,
      material: 'HDPE',
    });
    expect(plan.family).toBe('HDPE');
    expect(plan.extraAssumptionIds).toEqual(['HDPE_MAIN_FROM_200M']);

    const pvc = pressurizedPlanFrom(
      technical('pump_transfer', {
        design_flow: known('Debit rencana', 5),
        route_length: known('Panjang jalur', 800),
        static_head: known('Tinggi statis', 12),
        material: known('Bahan pipa', 'PVC (uPVC)'),
        required_pressure: known('Tekanan yang dibutuhkan', 1),
      }),
    )!;
    expect(pvc.family).toBe('PVC AW');
    expect(pvc.input.material).toBe('PVC');
    expect(pvc.input.residualPressureBar).toBe(1);
    expect(pvc.extraAssumptionIds).toEqual([]);
  });

  it('sumur: tinggi statis dari kedalaman sumur + tinggi tandon; data inti kurang → null', () => {
    const plan = pressurizedPlanFrom(
      technical('well_distribution', {
        design_flow: known('Debit rencana', 1),
        route_length: known('Panjang jalur', 30),
        well_depth: known('Kedalaman sumur', 40),
        tank_elevation: known('Tinggi toren', 6),
      }),
    )!;
    expect(plan.input.staticHeadM).toBe(46);
    expect(
      pressurizedPlanFrom(technical('pump_transfer', { design_flow: known('Debit', 5) })),
    ).toBeNull();
    expect(pressurizedPlanFrom(technical('fish_pond', {}))).toBeNull();
  });
});

describe('tampilan hasil bertekanan', () => {
  const result = computePressurized({ designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));

  it('highlights, baris sistem (utama + pompa + alternatif), BOM HDPE per meter, asumsi ber-ID', () => {
    const h = pressurizedHighlights(result, 'HDPE', 3);
    expect(h.map((x) => x.label)).toEqual([
      'Pipa utama',
      'Kecepatan',
      'Kerugian gesek',
      'Head total',
      'Titik kerja pompa',
      'Produk Pralon',
    ]);
    expect(h[0]!.value).toBe('HDPE 2½"');
    expect(h[4]!.value).toBe('18 m³/jam @ 46,12 m');

    const lines = pressurizedSystemLinesFrom(result, 'HDPE', traces);
    expect(lines.map((l) => l.role)).toEqual(['main', 'fitting', 'branch']);
    expect(lines[2]!.size).toBe('3"');
    for (const l of lines) expect(l.traceIds.length).toBeGreaterThan(0);

    const bom = pressurizedBomItemsFrom(result, 'HDPE', 800, traces);
    expect(bom[0]).toMatchObject({ item: 'Pipa HDPE', quantity: 800, unit: 'meter' });
    expect(bom.some((b) => b.item.includes('check valve'))).toBe(true);
    expect(bom.some((b) => b.item === 'Lem PVC')).toBe(false);

    const assumptions = pressurizedAssumptionsFrom(result, ['HDPE_MAIN_FROM_200M'], traces);
    expect(assumptions.map((a) => a.assumptionId)).toEqual(
      expect.arrayContaining([
        'HAZEN_WILLIAMS_C_PLASTIC',
        'PUMP_EFFICIENCY_INDICATIVE',
        'HDPE_MAIN_FROM_200M',
      ]),
    );
  });

  it('prosa: setiap angka berasal dari hasil hitungan', () => {
    const prose = pressurizedProse(result, 'HDPE', {
      designFlowLs: 5,
      routeLengthM: 800,
      staticHeadM: 12,
    });
    expect(prose.headline).toContain('HDPE 2½"');
    expect(prose.headline).toContain('18 m³/jam');
    expect(prose.body).toContain('46,12 m');
    expect(prose.body).toContain('Alternatifnya 3"');
    // Label ukuran (2½", 3") dibuang dulu: digitnya bukan angka hitungan.
    const numbers = prose.body.replace(/\d+[¼½¾]?"/g, '').match(/\d+(?:,\d+)?/g) ?? [];
    const allowed = new Set(
      [
        5,
        800,
        12,
        result.velocityMs,
        result.frictionLossM,
        result.minorLossM,
        result.totalDynamicHeadM,
        result.pumpDuty!.flowM3h,
        result.pumpDuty!.headM,
        result.pumpDuty!.hydraulicPowerKw,
        result.pumpDuty!.indicativeShaftPowerKw,
        3,
        90,
      ].map((n) => String(n).replace('.', ',')),
    );
    for (const n of numbers) expect(allowed.has(n)).toBe(true);
  });
});

describe('tampilan hasil bertekanan: dua bahasa', () => {
  const result = computePressurized({ designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));
  const input = { designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 };

  it('highlights: id tak berubah, en berbahasa Inggris dengan angka sama', () => {
    const idRows = pressurizedHighlights(result, 'HDPE', 3, 'id');
    expect(idRows).toEqual(pressurizedHighlights(result, 'HDPE', 3));
    const en = pressurizedHighlights(result, 'HDPE', 3, 'en');
    expect(en).toHaveLength(idRows.length);
    expect(en.map((x) => x.label)).toEqual([
      'Main pipe',
      'Velocity',
      'Friction loss',
      'Total head',
      'Pump duty point',
      'Pralon products',
    ]);
    expect(en[4]!.value).toBe('18 m³/h @ 46.12 m');
  });

  it('baris sistem dan BOM: jumlah sama, teks Inggris, trace sama', () => {
    const idLines = pressurizedSystemLinesFrom(result, 'HDPE', traces);
    const en = pressurizedSystemLinesFrom(result, 'HDPE', traces, 'en');
    expect(en).toHaveLength(idLines.length);
    expect(en.map((l) => l.traceIds)).toEqual(idLines.map((l) => l.traceIds));
    expect(en[0]!.name).toBe('HDPE main pipe');
    expect(en[1]!.size).toBe('18 m³/h @ 46.12 m');
    expect(en[2]!.reason).toContain('One size up');

    const idBom = pressurizedBomItemsFrom(result, 'HDPE', 800, traces, 'id');
    const enBom = pressurizedBomItemsFrom(result, 'HDPE', 800, traces, 'en');
    expect(enBom).toHaveLength(idBom.length);
    expect(enBom.map((b) => b.quantity)).toEqual(idBom.map((b) => b.quantity));
    expect(enBom[0]!.item).toBe('HDPE pipe');
    expect(enBom.some((b) => b.item === 'Check valve')).toBe(true);
    expect(idBom[0]!.item).toBe('Pipa HDPE');
  });

  it('asumsi dan prosa: id tak berubah, en berbahasa Inggris', () => {
    const idA = pressurizedAssumptionsFrom(result, [], traces);
    const enA = pressurizedAssumptionsFrom(result, [], traces, 'en');
    expect(enA).toHaveLength(idA.length);
    expect(enA[0]!.text).toMatch(/^How it is worked out: /);
    expect(idA[0]!.text).toMatch(/^Cara hitungnya: debit dan panjang jalur/);
    expect(idA[0]!.text).not.toMatch(/ENG-\d/);

    const idP = pressurizedProse(result, 'HDPE', input, 'id');
    expect(idP).toEqual(pressurizedProse(result, 'HDPE', input));
    const enP = pressurizedProse(result, 'HDPE', input, 'en');
    expect(enP.headline).toContain('pipe and a 18 m³/h pump at 46.12 m head');
    expect(enP.body).toContain('46.12 m');
    expect(enP.body).toContain('Initial estimate');
    expect(enP.body).not.toContain(',12');
  });
});

describe('tampilan hasil bertekanan: penjelasan trace dua bahasa (P15-04b)', () => {
  it("trace dihitung dengan 'en' → alasan dan dasar BOM berbahasa Inggris, ukuran sama", () => {
    const input = { designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 };
    const idResult = computePressurized(input);
    const enResult = computePressurized(input, 'en');
    const idTraces = idResult.traces.map((t, i) => ({ ...t, id: `T${i}` }));
    const enTraces = enResult.traces.map((t, i) => ({ ...t, id: `T${i}` }));
    const id = pressurizedSystemLinesFrom(idResult, 'HDPE', idTraces, 'id');
    const en = pressurizedSystemLinesFrom(enResult, 'HDPE', enTraces, 'en');
    expect(en[0]!.size).toBe(id[0]!.size);
    expect(en[0]!.reason).not.toBe(id[0]!.reason);
    expect(en[0]!.reason).toContain('is the smallest with a water speed');
    const enBom = pressurizedBomItemsFrom(enResult, 'HDPE', 800, enTraces, 'en');
    expect(enBom[0]!.basis).toMatch(/^\d+ sizes were tried/);
  });
});
