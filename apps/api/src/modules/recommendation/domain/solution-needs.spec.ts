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

describe('needsFrom — pompa sumber vs pompa pendorong (review putaran 3, U1/U2)', () => {
  // U2: 3 lantai, 10 × 8 m, tanah 20 × 10 m, 4 KM, 2 wastafel, 1 dapur, pompa sumur.
  const U2: SolutionInput = {
    ...INPUT,
    floors: 3,
    bathrooms: 4,
    basins: 2,
    waterSource: 'pump',
    installationType: 'clean_water',
    planLengthM: 10,
    planWidthM: 8,
    landLengthM: 20,
    landWidthM: 10,
  };

  it('U2: satu pompa — sumur + pompa, tanpa pompa pendorong kedua', () => {
    const needs = needsFrom(U2, computeSolution(U2), null);
    const kinds = needs.map((n) => n.kind);
    expect(kinds).toContain('well_pump');
    expect(kinds).not.toContain('booster_pump');
    expect(needs.find((n) => n.kind === 'well_pump')).toMatchObject({
      wellDepthM: 6,
      wellDepthAssumed: true,
      deepWell: false,
    });
  });

  it('muka air yang disebut 9 m → bukan perkiraan, pompa jet / submersible', () => {
    const deep = { ...U2, wellDepthM: 9 };
    expect(
      needsFrom(deep, computeSolution(deep), null).find((n) => n.kind === 'well_pump'),
    ).toMatchObject({
      wellDepthM: 9,
      wellDepthAssumed: false,
      deepWell: true,
    });
  });

  it('toren bawah: pompanya bagian sumber, tanpa pompa pendorong', () => {
    const ground = { ...U2, waterSource: 'ground_tank' as const };
    const kinds = needsFrom(ground, computeSolution(ground), null).map((n) => n.kind);
    expect(kinds).toContain('ground_tank');
    expect(kinds).not.toContain('booster_pump');
  });

  it('U1 toren atap 1 lantai: pompa pendorong dengan pilihan dudukan toren', () => {
    const U1: SolutionInput = {
      ...U2,
      floors: 1,
      bathrooms: 1,
      basins: 0,
      waterSource: 'rooftop_tank',
      planLengthM: 10,
      planWidthM: 6,
      landLengthM: 15,
      landWidthM: 8,
    };
    const solution = computeSolution(U1);
    const booster = needsFrom(U1, solution, null).find((n) => n.kind === 'booster_pump')!;
    expect(booster.minimumStandM).toBe(solution.supply.gravityRemedy!.minimumStandM);
    expect(booster.minimumStandM).toBeGreaterThan(1);
  });
});
