/** P17-04 (DD-01 #1): kebutuhan bergambar dari hasil engine, kasus contoh desain. */
import { computeHouseDrainage, computeSolution, type SolutionInput } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { needsFrom } from './solution-needs.js';

const INPUT: SolutionInput = {
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

describe('needsFrom — rumah 2 lantai, 3 KM, 4 wastafel, 1 dapur, toren atap', () => {
  const solution = computeSolution(INPUT);
  const drainage = computeHouseDrainage({ bathrooms: 3, basins: 4, kitchens: 1 });
  const needs = needsFrom(INPUT, solution, drainage);
  const of = (kind: string) => needs.find((n) => n.kind === kind);

  it('urutan: bangunan, alat, sumber air, pompa, pembuangan', () => {
    expect(needs.map((n) => n.kind)).toEqual([
      'building',
      'bathroom',
      'water_closet',
      'basin',
      'kitchen',
      'rooftop_tank',
      'booster_pump',
      'drainage',
    ]);
  });

  it('bangunan membawa lantai, tinggi lantai, dan ukuran', () => {
    expect(of('building')).toMatchObject({
      count: 2,
      building: { type: 'residential', floors: 2, floorHeightM: 3.5, lengthM: 8, widthM: 15 },
    });
  });

  it('alat per lantai dari sebaran engine (lantai teratas dulu)', () => {
    expect(of('bathroom')).toMatchObject({
      count: 3,
      perFloor: [
        { floor: 2, count: 2 },
        { floor: 1, count: 1 },
      ],
    });
    expect(of('kitchen')).toMatchObject({ count: 1, perFloor: [{ floor: 1, count: 1 }] });
  });

  it('pompa pendorong muncul karena tekanan toren tidak cukup, dengan sisa tekanannya', () => {
    expect(of('booster_pump')!.residualBar).toBeLessThan(0.3);
  });

  it('pembuangan membawa ukuran jalurnya; tanpa pembuangan tidak muncul', () => {
    expect(of('drainage')).toMatchObject({
      soilSize: drainage.soil!.size,
      wasteSize: drainage.waste!.size,
    });
    expect(needsFrom(INPUT, solution, null).some((n) => n.kind === 'drainage')).toBe(false);
  });

  it('PDAM tanpa pompa: sumber "municipal", tanpa butir pompa', () => {
    const pdam = { ...INPUT, waterSource: 'municipal' as const };
    const kinds = needsFrom(pdam, computeSolution(pdam), null).map((n) => n.kind);
    expect(kinds).toContain('municipal');
    expect(kinds).not.toContain('booster_pump');
  });
});
