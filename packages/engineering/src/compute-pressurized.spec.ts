/**
 * Orkestrator hidraulik bertekanan (fase 3). Skenario D brief: transfer 5 l/s, 800 m, tandon
 * 12 m lebih tinggi. Yang dipaku: kandidat dengan status, ukuran terpilih + alternatif, rantai
 * trace per aturan, titik kerja pompa tanpa merek, asumsi yang dipakai punya ID.
 */
import { describe, expect, it } from 'vitest';
import { computePressurized } from './compute-pressurized.js';

describe('computePressurized', () => {
  const result = computePressurized({ designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 });

  it('memilih 2½" (1,51 m/s, 3,3 m/100 m) dengan alternatif 3"; TDH ±46 m; pompa 18 m³/jam', () => {
    expect(result.recommendedSize).toBe('2½"');
    expect(result.alternativeSize).toBe('3"');
    expect(result.allCriteriaMet).toBe(true);
    expect(result.velocityMs).toBe(1.51);
    expect(result.frictionLossM).toBe(26.38);
    expect(result.totalDynamicHeadM).toBe(46.12);
    expect(result.pumpDuty).toMatchObject({ flowM3h: 18, headM: 46.12 });
    expect(result.pumpDuty!.indicativeShaftPowerKw).toBeGreaterThan(3);
    expect(result.candidates.filter((c) => c.status === 'ok').map((c) => c.size)).toEqual([
      '2½"',
      '3"',
      '4"',
    ]);
  });

  it('satu trace per aturan, semua ASSUMED (menunggu validasi), asumsi yang dipakai ber-ID', () => {
    expect(result.traces.map((t) => t.ruleId)).toEqual([
      'ENG-205',
      'ENG-201',
      'ENG-202',
      'ENG-203',
      'ENG-204',
      'ENG-206',
    ]);
    expect(result.overallProvenance).toBe('ASSUMED');
    expect(result.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'HAZEN_WILLIAMS_C_PLASTIC',
        'TRANSFER_DISCHARGE_MARGIN',
        'VELOCITY_MAX_PLASTIC',
        'HEADLOSS_GRADIENT_MAX',
        'MINOR_LOSS_FRACTION',
        'PUMP_EFFICIENCY_INDICATIVE',
      ]),
    );
    for (const t of result.traces) expect(t.explanation.length).toBeGreaterThan(20);
  });

  it('tekanan sisa yang diberikan tidak diganti asumsi; galvanis memakai C = 100; gravitasi tanpa pompa', () => {
    const given = computePressurized({
      designFlowLs: 5,
      routeLengthM: 800,
      staticHeadM: 12,
      residualPressureBar: 1,
      material: 'Galvanis',
    });
    expect(given.appliedAssumptionIds).not.toContain('TRANSFER_DISCHARGE_MARGIN');
    expect(given.hazenWilliamsC).toBe(100);
    expect(given.totalDynamicHeadM).toBeGreaterThan(result.totalDynamicHeadM);

    const gravity = computePressurized({
      designFlowLs: 5,
      routeLengthM: 800,
      staticHeadM: -20,
      pumpRequired: false,
    });
    expect(gravity.pumpDuty).toBeNull();
    expect(gravity.traces.map((t) => t.ruleId)).not.toContain('ENG-206');
  });
});
