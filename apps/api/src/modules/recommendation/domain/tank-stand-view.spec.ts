/** P22-04: pilihan dudukan toren dari hasil engine, kasus rumah 1 lantai (U1). */
import { computeSolution, type SolutionInput } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { tankStandViewFrom } from './tank-stand-view.js';

const U1: SolutionInput = {
  buildingType: 'residential',
  floors: 1,
  bathrooms: 1,
  basins: 0,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
  planLengthM: 10,
  planWidthM: 6,
};

describe('tankStandViewFrom', () => {
  it('rumah 1 lantai toren atap: dak kurang, tiang yang lebih tinggi dari dak ditawarkan, ukuran pipa ikut', () => {
    const solution = computeSolution(U1);
    const view = tankStandViewFrom(solution)!;
    expect(view.options[0]).toMatchObject({
      kind: 'roof_slab',
      supportHeightM: 3.5,
      waterLevelM: 4.5,
    });
    expect(view.options[0]!.meetsMinimum).toBe(false);
    expect(view.options.slice(1).every((o) => o.kind === 'tower' && o.waterLevelM > 4.5)).toBe(
      true,
    );
    expect(view.recommendedIndex).not.toBeNull();
    expect(view.options[view.recommendedIndex!]!.meetsMinimum).toBe(true);
    expect(view.minimumBar).toBe(0.3);
    expect(view.comfortBar).toBe(0.7);
    expect(view.mainSize).toBe(solution.mainSize);
    expect(view.branchSizes.length).toBeGreaterThan(0);
  });

  it('bukan toren atap → tidak ada pilihan dudukan', () => {
    expect(tankStandViewFrom(computeSolution({ ...U1, waterSource: 'municipal' }))).toBeNull();
  });
});
