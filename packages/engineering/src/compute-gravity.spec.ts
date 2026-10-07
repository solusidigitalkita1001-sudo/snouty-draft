/**
 * Fase 4: drainase, air hujan (intensitas wajib), gorong-gorong (penanda struktural), cluster.
 */
import { describe, expect, it } from 'vitest';
import { GravityInputError, computeGravity } from './compute-gravity.js';
import { computeNetwork } from './compute-network.js';

describe('computeGravity', () => {
  it('drainase 20 l/s pada 1 % → 8" (47 % kapasitas), trace ENG-402 + ENG-401, asumsi ber-ID', () => {
    const r = computeGravity({ kind: 'drainage', designFlowLs: 20, slopePercent: 1 });
    expect(r.recommendedSize).toBe('8"');
    expect(r.utilisationPercent).toBe(46.9);
    expect(r.allCriteriaMet).toBe(true);
    expect(r.structural).toBeNull();
    expect(r.traces.map((t) => t.ruleId)).toEqual(['ENG-402', 'ENG-401']);
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'MANNING_N_PLASTIC',
        'PIPE_FILL_RATIO_GRAVITY',
        'VELOCITY_MIN_SELF_CLEANING',
      ]),
    );
    expect(r.appliedAssumptionIds).not.toContain('GRAVITY_SLOPE_MIN_0_5');
  });

  it('air hujan: 0,5 ha × 100 mm/jam (C asumsi 0,6) → 83,4 l/s → 12"; tanpa intensitas → galat, bukan tebakan', () => {
    const r = computeGravity({
      kind: 'stormwater',
      catchmentHa: 0.5,
      rainfallMmPerHour: 100,
      slopePercent: 1,
    });
    expect(r.designFlowLs).toBe(83.4);
    expect(r.recommendedSize).toBe('12"');
    expect(r.traces[0]!.ruleId).toBe('ENG-403');
    expect(r.appliedAssumptionIds).toContain('RUNOFF_C_RESIDENTIAL');
    expect(() => computeGravity({ kind: 'stormwater', catchmentHa: 0.5 })).toThrow(
      GravityInputError,
    );
  });

  it('gorong-gorong: timbunan 0,5 m dengan truk → struktur ditandai tidak memadai; kemiringan dari asumsi', () => {
    const r = computeGravity({
      kind: 'culvert',
      designFlowLs: 20,
      coverDepthM: 0.5,
      trafficLoad: 'heavy',
    });
    expect(r.slopePercent).toBe(0.5);
    expect(r.structural?.coverAdequate).toBe(false);
    expect(r.structural?.structuralNote).toContain('validasi struktural');
    expect(r.traces.map((t) => t.ruleId)).toContain('ENG-404');
    expect(r.overallProvenance).toBe('ASSUMED');
  });
});

describe('computeNetwork', () => {
  it('120 unit → puncak 1,67 l/s → pipa distribusi dan pompa dari Kelompok F; asumsi demand ber-ID', () => {
    const r = computeNetwork({ connections: 120, routeLengthM: 600, staticHeadM: 8 });
    expect(r.peakFlowLs).toBe(1.67);
    expect(r.traces[0]!.ruleId).toBe('ENG-405');
    expect(r.recommendedSize).toBe('1½"'); // 1,67 l/s: ukuran terkecil dalam batas kecepatan/gradien
    expect(r.pumpDuty).not.toBeNull();
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'PERSONS_PER_UNIT_4',
        'DEMAND_LPCD_150',
        'PEAK_HOUR_FACTOR_2',
        'RESIDUAL_PRESSURE_FIXTURE',
      ]),
    );
  });
});

describe('locale penjelasan trace (P15-04b)', () => {
  it("gorong-gorong 'en': catatan struktur dan trace berbahasa Inggris, angka dan output aturan tetap", () => {
    const input = {
      kind: 'culvert',
      designFlowLs: 20,
      coverDepthM: 0.5,
      trafficLoad: 'heavy',
    } as const;
    const id = computeGravity(input);
    const en = computeGravity(input, 'en');
    expect(en.structural?.structuralNote).toContain('structural validation is mandatory');
    expect(en.structural?.minimumCoverM).toBe(id.structural?.minimumCoverM);
    expect(en.recommendedSize).toBe(id.recommendedSize);
    // Trace menyimpan keluaran aturan apa adanya; hanya `explanation` yang ikut bahasa.
    expect(en.traces.map((t) => t.output)).toEqual(id.traces.map((t) => t.output));
    en.traces.forEach((trace, i) => {
      expect(trace.explanation).not.toBe(id.traces[i]!.explanation);
    });
    expect(computeGravity(input, 'id')).toEqual(id);
  });

  it("jaringan 'en': trace ENG-405 dan trace bertekanan ikut bahasa Inggris", () => {
    const input = { connections: 120, routeLengthM: 600, staticHeadM: 8 };
    const id = computeNetwork(input);
    const en = computeNetwork(input, 'en');
    expect(en.traces[0]!.explanation).toContain('Peak demand');
    expect(en.traces.map((t) => t.ruleId)).toEqual(id.traces.map((t) => t.ruleId));
    en.traces.forEach((trace, i) => {
      expect(trace.explanation).not.toBe(id.traces[i]!.explanation);
    });
  });
});
