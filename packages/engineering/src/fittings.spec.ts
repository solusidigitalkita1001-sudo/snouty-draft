/** P18-01: fitting rumah dihitung engine (ENG-708, ENG-605) dari jumlah jalur — asumsi, bisa diganti. */
import { describe, expect, it } from 'vitest';
import { computeHouseDrainage } from './compute-house-waste.js';
import { computeSolution, type SolutionInput } from './compute-solution.js';

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

describe('fitting air bersih (ENG-708)', () => {
  it('rumah contoh: 2 elbow utama + 1 di ujung, 2 pengisi toren, 1 per cabang, 11 elbow + 11 faucet elbow', () => {
    const r = computeSolution(HOUSE);
    // Toren atap mengalir dari atas: ujung pipa utama di cabang dapur lantai 1 (1/2") → elbow + reducer.
    expect(r.mainEndBranchSize).toBe('1/2"');
    expect(r.fittings).toEqual({
      mainElbows: 2,
      endElbows: 1,
      endReducer: '1/2"',
      tankFillElbows: 2,
      branchElbows: [
        { size: '1"', count: 1 },
        { size: '3/4"', count: 1 },
        { size: '1/2"', count: 2 },
      ],
      outletElbows: 11,
      faucetElbows: 11,
    });
    expect(r.traces.find((t) => t.ruleId === 'ENG-708')?.provenance).toBe('ASSUMED');
  });

  it('tanpa ukuran rumah tetap dihitung; tanpa toren atap tidak ada elbow pengisi', () => {
    const r = computeSolution({
      ...HOUSE,
      planLengthM: null,
      planWidthM: null,
      waterSource: 'municipal',
    });
    expect(r.fittings.tankFillElbows).toBe(0);
    expect(r.fittings.outletElbows).toBe(11);
  });

  it('nilai asumsi bisa diganti pengguna', () => {
    const r = computeSolution(HOUSE, 'id', { FITTING_BRANCH_ELBOW_1: 2 });
    expect(r.fittings.branchElbows.map((b) => b.count)).toEqual([2, 2, 4]);
  });
});

describe('ujung pipa utama (ENG-704 v2, review laporan 0015)', () => {
  it('PDAM naik dari bawah: ujungnya cabang lantai teratas', () => {
    const r = computeSolution({ ...HOUSE, waterSource: 'municipal', bathrooms: 2, basins: 1 });
    const top = r.branchGroups.find((g) => g.branches.some((b) => b.floor === 2))!;
    expect(r.mainEndBranchSize).toBe(top.size);
    expect(r.branchLayout!.teeCount).toBe(r.branchCount - 1);
  });
});

describe('fitting pembuangan (ENG-605)', () => {
  it('rumah 2 lantai: Y per alat, 1 Y per lantai atas, 2 elbow 45°, 1 clean out per jalur', () => {
    const r = computeHouseDrainage({
      bathrooms: 3,
      basins: 4,
      kitchens: 1,
      floors: [
        { bathrooms: 2, basins: 2, kitchens: 0 },
        { bathrooms: 1, basins: 2, kitchens: 1 },
      ],
    });
    expect(r.fittings).toEqual({
      soil: { fixtureY: 3, stackY: 1, elbows45: 2, cleanouts: 1 },
      waste: { fixtureY: 8, stackY: 1, elbows45: 2, cleanouts: 1 },
    });
  });
});
