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
      peakFlowLs: 2.31,
      minimumSize: SEWER_MINIMUM_SIZE,
    });
    expect(result.designFlowLs).toBe(2.31);
    expect(result.recommendedSize).toBe('6"');
    expect(result.traces.map((t) => t.ruleId)).toEqual([
      'ENG-406',
      'ENG-402',
      'ENG-407',
      'ENG-401',
    ]);
    expect(result.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'SPAM_PERSONS_PER_CONNECTION_5',
        'SPAM_DEMAND_LPCD_100',
        'SEWER_RETURN_FACTOR_0_8',
        'SEWER_PEAK_FACTOR_2_5',
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
    // 500 × 5 × 100 ÷ 86 400 = 2,89 l/s; × 1,75 = 5,06 l/s.
    expect(spam.averageFlowLs).toBe(2.89);
    expect(spam.peakFlowLs).toBe(5.06);
    expect(spam.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'SPAM_PERSONS_PER_CONNECTION_5',
        'SPAM_DEMAND_LPCD_100',
        'SPAM_PEAK_HOUR_FACTOR_1_75',
      ]),
    );
    const cluster = computeNetwork({ connections: 120, routeLengthM: 400, staticHeadM: 10 });
    expect(cluster.kind).toBe('cluster');
    expect(cluster.peakFlowLs).toBe(1.67);
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
    expect(result.traces[1]!.ruleId).toBe('ENG-405');
  });

  it('tanpa sambungan maupun jiwa → galat masukan', () => {
    expect(() => computeNetwork({ routeLengthM: 100, staticHeadM: 5 })).toThrow(/sambungan/);
  });
});
