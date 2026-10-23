/** P17-08 (DD-01): "Coba ubah" — skenario dihitung ulang engine, kasus contoh desain. */
import type { SolutionInput } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { compareScenarios } from './scenarios.js';

const HOUSE: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'both',
  floorHeightM: null,
  mainRunMeters: null,
  planLengthM: 8,
  planWidthM: 15,
};

describe('compareScenarios — rumah 2 lantai, toren atap', () => {
  const result = compareScenarios(HOUSE, {});
  const of = (id: string) => result.scenarios.find((s) => s.id === id)!.metrics;

  // Pipa utama 1¼" (tebal AW resmi) menggesek lebih sedikit dari 1" dulu. Sejak kerugian
  // sambungan dihitung per fitting (ENG-207, masukan Leo 2026-10-22) sisanya 0,15 bar, tetap < 0,3.
  it('dasar: perlu pompa pendorong, sisa tekanan 0,15 bar', () => {
    expect(result.base).toMatchObject({
      outletCount: 11,
      mainSize: '1¼"',
      boosterPumpNeeded: true,
    });
    expect(result.base.residualBar).toBeCloseTo(0.15, 2);
  });

  it('skenario yang ditawarkan: toren naik, tambah kamar mandi, PDAM, toren bawah (toren atap sudah dipakai)', () => {
    expect(result.scenarios.map((s) => s.id)).toEqual([
      'tank_raised',
      'add_bathroom',
      'municipal',
      'ground_tank',
    ]);
    expect(result.raisedByM).toBe(3.5);
  });

  it('toren dinaikkan satu lantai: pompa tidak perlu lagi', () => {
    expect(of('tank_raised').boosterPumpNeeded).toBe(false);
    expect(of('tank_raised').residualBar!).toBeGreaterThanOrEqual(0.3);
  });

  it('tambah satu kamar mandi: 13 titik air, pipa utama tetap 1¼" (tebal AW resmi)', () => {
    expect(of('add_bathroom')).toMatchObject({ outletCount: 13, mainSize: '1¼"' });
  });

  it('PDAM: tanpa toren dan tanpa pipa pengisi toren', () => {
    expect(of('municipal')).toMatchObject({
      boosterPumpNeeded: false,
      tankFill: null,
      residualBar: null,
    });
  });

  it('nilai dudukan toren dari pengguna ikut dinaikkan dari nilai itu', () => {
    const custom = compareScenarios(HOUSE, { TANK_STAND_1M: 2 });
    expect(custom.base.residualBar!).toBeGreaterThan(result.base.residualBar!);
  });

  it('sumber PDAM: tidak menawarkan toren dinaikkan maupun PDAM lagi', () => {
    const pdam = compareScenarios({ ...HOUSE, waterSource: 'municipal' }, {});
    expect(pdam.scenarios.map((s) => s.id)).toEqual([
      'add_bathroom',
      'ground_tank',
      'rooftop_tank',
    ]);
  });
});
