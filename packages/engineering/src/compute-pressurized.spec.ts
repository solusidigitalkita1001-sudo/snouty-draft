/**
 * Orkestrator hidraulik bertekanan (fase 3). Skenario D brief: transfer 5 l/s, 800 m, tandon
 * 12 m lebih tinggi. Yang dipaku: kandidat dengan status, ukuran terpilih + alternatif, rantai
 * trace per aturan, titik kerja pompa tanpa merek, asumsi yang dipakai punya ID.
 */
import { describe, expect, it } from 'vitest';
import { computePressurized } from './compute-pressurized.js';

describe('computePressurized', () => {
  const result = computePressurized({ designFlowLs: 5, routeLengthM: 800, staticHeadM: 12 });

  it('memilih 2½" AW (diameter dalam 70,8 mm: 1,27 m/s, 2,17 m/100 m) dengan alternatif 3"; TDH ±36 m; pompa 18 m³/jam', () => {
    expect(result.recommendedSize).toBe('2½"');
    expect(result.alternativeSize).toBe('3"');
    expect(result.allCriteriaMet).toBe(true);
    expect(result.innerDiameterMm).toBe(70.8);
    expect(result.velocityMs).toBe(1.27);
    expect(result.frictionLossM).toBe(17.39);
    expect(result.totalDynamicHeadM).toBe(36.23);
    expect(result.pumpDuty).toMatchObject({ flowM3h: 18, headM: 36.23 });
    expect(result.pumpDuty!.indicativeShaftPowerKw).toBeGreaterThan(2);
    expect(result.candidates.filter((c) => c.status === 'ok').map((c) => c.size)).toEqual([
      '2½"',
      '3"',
    ]);
  });

  it('satu trace per aturan, semua ASSUMED (menunggu validasi), asumsi yang dipakai ber-ID', () => {
    expect(result.traces.map((t) => t.ruleId)).toEqual([
      'ENG-205',
      'ENG-201',
      'ENG-202',
      'ENG-203',
      'ENG-204',
      'ENG-714',
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

  // OQ-96 (keputusan pemilik 2026-11-24): HDPE punya tekanan kerja nyata lewat padanan SDR → PN,
  // uPVC belum punya angkanya di data mana pun — dan jawabannya mengatakan itu, bukan mengarang.
  it('pipa uPVC: tekanan kerja pipanya belum tercatat, jadi tidak dibandingkan', () => {
    expect(result.pressureRating.ratingBar).toBeNull();
    expect(result.pressureRating.exceedsRating).toBeNull();
    expect(result.pressureRating.requiredBar).toBe(3.55);
    const trace = result.traces.find((t) => t.ruleId === 'ENG-714')!;
    expect(trace.explanation).toContain('belum tercatat');
  });

  it('pipa HDPE: tekanan kerjanya PN 10 dari kelas SDR 17, dan jalur di atasnya dikatakan melebihi', () => {
    const easy = computePressurized({
      designFlowLs: 5,
      routeLengthM: 800,
      staticHeadM: 12,
      material: 'HDPE',
    });
    expect(easy.pressureRating.ratingBar).toBe(10);
    expect(easy.pressureRating.exceedsRating).toBe(false);
    expect(easy.pressureRating.headroomBar).toBeGreaterThan(0);

    const tall = computePressurized({
      designFlowLs: 5,
      routeLengthM: 800,
      staticHeadM: 120,
      material: 'HDPE',
    });
    expect(tall.pressureRating.exceedsRating).toBe(true);
    expect(tall.traces.find((t) => t.ruleId === 'ENG-714')!.explanation).toContain('10 bar');
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
