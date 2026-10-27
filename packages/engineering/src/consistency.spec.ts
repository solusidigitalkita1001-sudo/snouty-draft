/**
 * Laporan SNTY-2026-10-0015: jumlah alat harus satu sumber. Tiga kasus wajib (review 0015):
 * kasus 0015 itu sendiri, 2 wastafel eksplisit, dan 1 lantai — setiap lapisan seimbang.
 */
import { describe, expect, it } from 'vitest';
import { computeHouseDrainage } from './compute-house-waste.js';
import { computeSolution, type SolutionInput } from './compute-solution.js';
import { assertBalanced, EngineConsistencyError } from './consistency.js';

const base: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 2,
  basins: 1,
  kitchens: 1,
  waterSource: 'municipal',
  installationType: 'both',
  floorHeightM: null,
  mainRunMeters: null,
  planLengthM: 12,
  planWidthM: 7,
};

function layers(input: SolutionInput) {
  const s = computeSolution(input);
  const d = computeHouseDrainage({
    bathrooms: input.bathrooms,
    basins: input.basins ?? 0,
    kitchens: input.kitchens ?? 1,
    floors: s.floorsPlan.map((f) => ({
      bathrooms: f.bathrooms,
      basins: f.basins,
      kitchens: f.kitchens,
    })),
  });
  const branches = s.branchGroups.flatMap((g) => g.branches);
  const sum = (xs: readonly number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;
  return { s, d, branches, sum };
}

describe.each([
  [
    'laporan 0015: 2 lantai, 2 KM, 1 wastafel, 1 dapur',
    base,
    { basins: [0, 1], outlets: 6, wsfu: 11.5, wasteDfu: 7 },
  ],
  [
    '2 wastafel eksplisit, 2 lantai',
    { ...base, basins: 2 },
    { basins: [1, 1], outlets: 7, wsfu: 12.5, wasteDfu: 8 },
  ],
  [
    '1 lantai, 2 KM, 1 wastafel, 1 dapur',
    { ...base, floors: 1 },
    { basins: [1], outlets: 6, wsfu: 11.5, wasteDfu: 7 },
  ],
])('%s', (_name, input, expected) => {
  const { s, d, branches, sum } = layers(input);

  it('sebaran per lantai = masukan', () => {
    expect(s.floorsPlan.map((f) => f.basins)).toEqual(expected.basins);
    expect(sum(s.floorsPlan.map((f) => f.bathrooms))).toBe(input.bathrooms);
    expect(sum(s.floorsPlan.map((f) => f.kitchens))).toBe(input.kitchens);
  });

  it('Σ titik cabang = total titik; Σ WSFU cabang = total WSFU', () => {
    expect(s.outletCount).toBe(expected.outlets);
    expect(sum(branches.map((b) => b.outlets))).toBe(expected.outlets);
    expect(s.supply.wsfu).toBe(expected.wsfu);
    expect(sum(branches.map((b) => b.wsfu))).toBe(expected.wsfu);
  });

  it('DFU air bekas total = jumlah per lantai (tidak ada wastafel tambahan di pembuangan)', () => {
    expect(d.load.wasteDfu).toBe(expected.wasteDfu);
  });
});

describe('assertBalanced', () => {
  it('ketidakseimbangan menghentikan hitungan', () => {
    expect(() => assertBalanced('wastafel per lantai', 1, [1, 1])).toThrow(EngineConsistencyError);
    expect(() => assertBalanced('beban', 7.9, [3.7, 4.2])).not.toThrow();
  });
});
