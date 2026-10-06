/**
 * Kasus pemilik: "tambak lele 4 x 4 meter, produknya apa aja". Yang dipaku: volume dari
 * dimensi, debit dari lama pengisian, pipa masuk & kuras dari kontinuitas, BOM, asumsi ber-ID.
 */
import { describe, expect, it } from 'vitest';
import { computePond } from './compute-pond.js';

describe('computePond', () => {
  const r = computePond({ lengthM: 4, widthM: 4 });

  it('4 × 4 m dengan asumsi (air 1 m, isi 3 jam, kuras 1 jam): 16 m³, 1,48 l/s, masuk 1½", kuras 3"', () => {
    expect(r.volumeM3).toBe(16);
    expect(r.designFlowLs).toBe(1.48);
    expect(r.inletSize).toBe('1½"');
    expect(r.drainSize).toBe('3"');
    expect(r.bom.find((l) => l.item === 'Pipa PVC D')).toMatchObject({ size: '3"', quantity: 2 });
    expect(r.traces.map((t) => t.ruleId)).toEqual([
      'ENG-301',
      'ENG-302',
      'ENG-102',
      'ENG-303',
      'ENG-304',
    ]);
    expect(r.overallProvenance).toBe('ASSUMED');
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'POND_DEPTH_1M',
        'POND_FILL_TIME_3H',
        'POND_DRAIN_TIME_1H',
        'POND_INLET_ROUTE_10M',
      ]),
    );
  });

  it('nilai yang diberikan tidak diganti asumsi; 4 kolam menambah tee dan volume', () => {
    const given = computePond({
      lengthM: 4,
      widthM: 4,
      depthM: 1.2,
      ponds: 4,
      fillTimeHours: 2,
      routeLengthM: 25,
    });
    expect(given.appliedAssumptionIds).not.toContain('POND_DEPTH_1M');
    expect(given.appliedAssumptionIds).not.toContain('POND_FILL_TIME_3H');
    expect(given.volumeM3).toBe(76.8);
    expect(given.bom.find((l) => l.item === 'Tee')?.quantity).toBe(3);
    expect(given.designFlowLs).toBeGreaterThan(r.designFlowLs);
  });
});
