/**
 * P22-05: jaringan air limbah (sewer) dan jaringan air minum (SPAM) — debit dari sambungan atau
 * jiwa, ukuran minimum pipa air limbah, dan asumsi SPAM yang tercatat.
 */
import { describe, expect, it } from 'vitest';
import { computeGravity, SEWER_MINIMUM_SIZE } from './compute-gravity.js';
import { computeNetwork } from './compute-network.js';

describe('computeGravity — jaringan air limbah', () => {
  it('200 SR: debit dari ENG-406, hidraulik kecil dinaikkan ke minimum 6" (ENG-407)', () => {
    const result = computeGravity({ kind: 'sewer', connections: 200, slopePercent: 0.5 });
    expect(result.sewer).toMatchObject({
      connections: 200,
      averageFlowLs: 0.93,
      peakFlowLs: 2.41,
      minimumSize: SEWER_MINIMUM_SIZE,
    });
    expect(result.designFlowLs).toBe(2.41);
    // Aliran sebagian pada 6" dan 0,5 %: terisi sebagian, kecepatan di bawah 0,6 → kemiringan minimum disebut.
    expect(result.sewer?.partial.depthRatio).toBeGreaterThan(0.2);
    expect(result.sewer?.partial.depthRatio).toBeLessThan(0.4);
    expect(result.sewer?.partial.minimumSlopePercent).toBeGreaterThanOrEqual(0.5);
    expect(result.sewer?.profile).toBeNull();
    expect(result.recommendedSize).toBe('6"');
    expect(result.traces.map((t) => t.ruleId)).toEqual([
      'ENG-406',
      'ENG-402',
      'ENG-407',
      'ENG-401',
      'ENG-412',
    ]);
    expect(result.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'SPAM_PERSONS_PER_CONNECTION_5',
        'SPAM_DEMAND_LPCD_100',
        'SEWER_RETURN_FACTOR_0_8',
        'SEWER_PEAK_FACTOR_2_5',
        'SEWER_INFILTRATION_10PCT',
      ]),
    );
    expect(result.overallProvenance).toBe('ASSUMED');
  });

  it('jiwa tanpa sambungan → ENG-408 dulu; 1 000 jiwa = 200 SR, hasil sama', () => {
    const byConnections = computeGravity({ kind: 'sewer', connections: 200 });
    const byPopulation = computeGravity({ kind: 'sewer', population: 1000 });
    expect(byPopulation.traces[0]!.ruleId).toBe('ENG-408');
    expect(byPopulation.sewer?.connections).toBe(200);
    expect(byPopulation.recommendedSize).toBe(byConnections.recommendedSize);
  });

  it('debit besar: ukuran hidraulik di atas minimum tidak diubah', () => {
    const result = computeGravity({ kind: 'sewer', designFlowLs: 60, slopePercent: 0.5 });
    expect(result.sewer?.hydraulicSize).toBe(result.recommendedSize);
    expect(['8"', '10"', '12"']).toContain(result.recommendedSize);
  });

  it('panjang jalur diketahui → profil: manhole tiap 50 m, penurunan, galian akhir, perlu pompa angkat', () => {
    const result = computeGravity({
      kind: 'sewer',
      connections: 200,
      routeLengthM: 1500,
      slopePercent: 0.5,
    });
    expect(result.traces.map((t) => t.ruleId)).toContain('ENG-413');
    expect(result.sewer?.profile).toMatchObject({
      routeLengthM: 1500,
      manholes: 31,
      fallM: 7.5,
      endDepthM: 8.5,
      liftNeeded: true,
    });
    const short = computeGravity({
      kind: 'sewer',
      connections: 200,
      routeLengthM: 300,
      slopePercent: 0.5,
    });
    expect(short.sewer?.profile).toMatchObject({
      manholes: 7,
      fallM: 1.5,
      endDepthM: 2.5,
      liftNeeded: false,
    });
  });

  it('tanpa sambungan, jiwa, maupun debit → galat masukan, bukan tebakan', () => {
    expect(() => computeGravity({ kind: 'sewer' })).toThrow(/sambungan rumah atau jiwa/);
  });

  it('drainase biasa tidak tersentuh: tanpa blok sewer, tanpa ENG-407', () => {
    const result = computeGravity({ kind: 'drainage', designFlowLs: 20, slopePercent: 1 });
    expect(result.sewer).toBeNull();
    expect(result.traces.some((t) => t.ruleId === 'ENG-407')).toBe(false);
  });
});

describe('computeNetwork — jaringan air minum (SPAM)', () => {
  it('500 SR: asumsi SPAM (100 l, 5 jiwa, 1,75) tercatat; cluster tetap 150 l / 4 orang / 2', () => {
    const spam = computeNetwork({
      kind: 'water_supply',
      connections: 500,
      routeLengthM: 2000,
      staticHeadM: 20,
      material: 'HDPE',
    });
    expect(spam.kind).toBe('water_supply');
    // Domestik 2,89 l/s; + non-domestik 15 % ÷ (1 − 20 % NRW) = 4,16 rata-rata; jam puncak × 1,75 = 7,28.
    expect(spam.supply).toMatchObject({
      domesticAverageLs: 2.89,
      averageLs: 4.16,
      maxDayLs: 4.78,
      peakHourLs: 7.28,
      dailyVolumeM3: 359.4,
      reservoirM3: 82.6,
    });
    expect(spam.averageFlowLs).toBe(4.16);
    expect(spam.peakFlowLs).toBe(7.28);
    // Tekanan kerja maksimum = max(statis 20 m, TDH) → kelas PN dari daftar PE100.
    expect(spam.supply?.maxPressureBar).toBeGreaterThanOrEqual(1.96);
    expect(spam.supply?.pressureClass.pn).not.toBeNull();
    expect(spam.traces.map((t) => t.ruleId)).toEqual(
      expect.arrayContaining(['ENG-409', 'ENG-414', 'ENG-415', 'ENG-416', 'ENG-410', 'ENG-411']),
    );
    // Tanpa jumlah cabang: satu pipa, topologi diasumsikan; sumur/reservoir tanpa tekanan → dipompa.
    expect(spam.supply?.topology).toMatchObject({ assumed: true, branches: 0, branch: null });
    expect(spam.supply?.mode.kind).toBe('pumped');
    expect(spam.pumpDuty).not.toBeNull();
    expect(spam.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'SPAM_PERSONS_PER_CONNECTION_5',
        'SPAM_DEMAND_LPCD_100',
        'SPAM_PEAK_HOUR_FACTOR_1_75',
        'SPAM_NON_DOMESTIC_15PCT',
        'SPAM_NRW_20PCT',
        'SPAM_DAY_PEAK_1_15',
        'SPAM_RESERVOIR_20PCT',
        'PRESSURE_CLASS_MARGIN_10PCT',
      ]),
    );
    const cluster = computeNetwork({ connections: 120, routeLengthM: 400, staticHeadM: 10 });
    expect(cluster.kind).toBe('cluster');
    expect(cluster.peakFlowLs).toBe(1.67);
    expect(cluster.supply).toBeNull();
    expect(cluster.appliedAssumptionIds).toEqual(
      expect.arrayContaining(['PERSONS_PER_UNIT_4', 'DEMAND_LPCD_150', 'PEAK_HOUR_FACTOR_2']),
    );
  });

  it('2 000 jiwa tanpa SR → 400 SR lewat ENG-408', () => {
    const result = computeNetwork({
      kind: 'water_supply',
      population: 2000,
      routeLengthM: 3000,
      staticHeadM: 15,
    });
    expect(result.connections).toBe(400);
    expect(result.traces[0]!.ruleId).toBe('ENG-408');
    expect(result.traces[1]!.ruleId).toBe('ENG-409');
  });

  it('tanpa sambungan maupun jiwa → galat masukan', () => {
    expect(() => computeNetwork({ routeLengthM: 100, staticHeadM: 5 })).toThrow(/sambungan/);
  });
});

describe('computeNetwork — audit PDAM 2026-10-16: topologi, mode sistem, regresi', () => {
  const base = {
    kind: 'water_supply' as const,
    connections: 500,
    routeLengthM: 2000,
    staticHeadM: 20,
    material: 'HDPE' as const,
  };

  it('4 cabang: induk membawa seluruh puncak, tiap cabang seperempatnya; head titik kritis = statis + induk + cabang + sisa', () => {
    const r = computeNetwork({ ...base, branches: 4 });
    const t = r.supply!.topology;
    expect(t).toMatchObject({ assumed: false, branches: 4, connectionsPerBranch: 125 });
    expect(t.trunk.flowLs).toBe(r.peakFlowLs);
    expect(t.branch?.flowLs).toBe(Math.round((r.peakFlowLs / 4) * 1000) / 1000);
    expect(t.branch!.lengthM).toBe(1000);
    expect(t.branch!.innerDiameterMm).toBeLessThanOrEqual(t.trunk.innerDiameterMm);
    const cp = r.supply!.criticalPath;
    expect(cp.lossM).toBe(
      Math.round(
        (t.trunk.frictionLossM +
          t.trunk.minorLossM +
          t.branch!.frictionLossM +
          t.branch!.minorLossM) *
          100,
      ) / 100,
    );
    expect(cp.requiredHeadM).toBe(Math.round((20 + cp.lossM + cp.residualM) * 100) / 100);
    expect(r.totalDynamicHeadM).toBe(cp.requiredHeadM);
  });

  it('cabang vs tunggal: ukuran induk sama (debit sama), tetapi head titik kritis lebih besar karena cabang ikut dihitung', () => {
    const single = computeNetwork(base);
    const branched = computeNetwork({ ...base, branches: 4 });
    expect(branched.recommendedSize).toBe(single.recommendedSize);
    expect(branched.supply!.criticalPath.requiredHeadM).toBeGreaterThan(
      single.supply!.criticalPath.requiredHeadM,
    );
  });

  it('PDAM 1,5 bar → booster sebesar kekurangan; PDAM 10 bar → suplai langsung tanpa pompa; reservoir 40 m di atas → gravitasi', () => {
    const low = computeNetwork({ ...base, branches: 2, sourcePressureBar: 1.5 });
    expect(low.supply!.mode.kind).toBe('booster');
    expect(low.supply!.mode.pumpHeadM).toBe(
      Math.round((low.supply!.criticalPath.requiredHeadM - low.supply!.mode.availableHeadM) * 100) /
        100,
    );
    expect(low.pumpDuty?.headM).toBe(low.supply!.mode.pumpHeadM);
    const high = computeNetwork({ ...base, branches: 2, routeLengthM: 300, sourcePressureBar: 6 });
    expect(high.supply!.mode.kind).toBe('direct_supply');
    expect(high.pumpDuty).toBeNull();
    expect(high.supply!.mode.residualAtCriticalBar).toBeGreaterThan(1);
    const gravity = computeNetwork({ ...base, branches: 2, staticHeadM: -40, routeLengthM: 500 });
    expect(gravity.supply!.mode.kind).toBe('gravity');
    expect(gravity.pumpDuty).toBeNull();
    expect(gravity.supply!.surgeBar).toBe(0);
  });

  it('kenaikan elevasi dan kenaikan debit menaikkan head pompa; tekanan sumber naik menurunkannya', () => {
    const a = computeNetwork({ ...base, branches: 2, sourcePressureBar: 1.5 });
    const higher = computeNetwork({
      ...base,
      branches: 2,
      sourcePressureBar: 1.5,
      staticHeadM: 35,
    });
    expect(higher.supply!.mode.pumpHeadM).toBeGreaterThan(a.supply!.mode.pumpHeadM);
    const more = computeNetwork({
      ...base,
      branches: 2,
      sourcePressureBar: 1.5,
      connections: 1000,
    });
    expect(more.peakFlowLs).toBeGreaterThan(a.peakFlowLs);
    const stronger = computeNetwork({ ...base, branches: 2, sourcePressureBar: 3 });
    expect(stronger.supply!.mode.pumpHeadM).toBeLessThan(a.supply!.mode.pumpHeadM);
  });

  it('kelas tekanan: mode berpompa membawa surja (a·v/g); tanpa pompa surja 0; PN naik bila tekanan naik', () => {
    const pumped = computeNetwork({ ...base, branches: 2 });
    expect(pumped.supply!.surgeBar).toBeGreaterThan(0);
    expect(pumped.supply!.pressureClass.pn).not.toBeNull();
    const pvc = computeNetwork({ ...base, branches: 2, material: 'PVC' });
    expect(pvc.appliedAssumptionIds).toContain('WAVE_SPEED_PVC_400MS');
    expect(pumped.appliedAssumptionIds).toContain('WAVE_SPEED_PE_300MS');
    // Statis 80 m: tekanan kerja melampaui kelas PN lazim → pn null (kajian tim teknis), bukan dikarang.
    const high = computeNetwork({ ...base, branches: 2, staticHeadM: 80 });
    expect(high.supply!.maxPressureBar).toBeGreaterThan(pumped.supply!.maxPressureBar);
    expect(high.supply!.pressureClass.pn).toBeNull();
  });

  it('1,5 m vs 1.500 m: panjang 1 000× berbeda memberi kehilangan yang jauh berbeda (regresi angka pengguna)', () => {
    const short = computeNetwork({ ...base, routeLengthM: 1.5 });
    const long = computeNetwork({ ...base, routeLengthM: 1500 });
    expect(long.frictionLossM).toBeGreaterThan(short.frictionLossM * 100);
  });
});
