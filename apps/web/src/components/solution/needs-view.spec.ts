/** P17-04 (DD-01 #1): gambar dan keterangan kebutuhan dari `Recommendation.needs`. */
import type { BuildingType, SolutionNeed } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { buildingSummary, flowSteps, needCards } from '@snouty/ui/needs-view';
import { solutionCopy } from './solution-copy';

const copy = solutionCopy('id').needs;

const NEEDS: readonly SolutionNeed[] = [
  {
    kind: 'building',
    count: 2,
    building: { type: 'residential', floors: 2, floorHeightM: 3.5, lengthM: 8, widthM: 15 },
  },
  {
    kind: 'bathroom',
    count: 3,
    perFloor: [
      { floor: 2, count: 2 },
      { floor: 1, count: 1 },
    ],
  },
  {
    kind: 'water_closet',
    count: 3,
    perFloor: [
      { floor: 2, count: 2 },
      { floor: 1, count: 1 },
    ],
  },
  { kind: 'kitchen', count: 1, perFloor: [{ floor: 1, count: 1 }] },
  { kind: 'rooftop_tank', count: 1 },
  { kind: 'booster_pump', count: 1, residualBar: 0.02 },
  { kind: 'drainage', count: 1, soilSize: '4"', wasteSize: '2½"' },
];

describe('needCards', () => {
  const cards = needCards(NEEDS, copy, 'id');
  const card = (key: string) => cards.find((c) => c.key === key)!;

  it('rumah 2 lantai: gambar rumah 2 lantai, ukuran dan tinggi lantai berkoma', () => {
    expect(card('building')).toMatchObject({
      image: 'house2',
      count: 2,
      label: 'Lantai',
      caption: '8 × 15 m, 3,5 m per lantai',
    });
  });

  it('sebaran per lantai; satu lantai saja → "Lantai n"', () => {
    expect(card('bathroom').caption).toBe('Lantai 2: 2 · Lantai 1: 1');
    expect(card('kitchen').caption).toBe('Lantai 1');
    expect(card('water_closet').caption).toBe('Satu per kamar mandi');
  });

  it('pompa pendorong ditandai dan menyebut sisa tekanannya', () => {
    expect(card('booster_pump')).toMatchObject({
      image: 'pump',
      attention: true,
      caption: 'Perlu: tekanan di titik tertinggi hanya 0,02 bar',
    });
  });

  it('jenis bangunan memilih gambarnya; rumah 3 lantai ke atas memakai rumah 3 lantai', () => {
    const image = (type: BuildingType, floors = 1) =>
      needCards(
        [{ kind: 'building', count: floors, building: { type, floors, floorHeightM: 3.5 } }],
        copy,
        'id',
      )[0]!.image;
    expect(image('place_of_worship')).toBe('mosque');
    expect(image('boarding_house')).toBe('kos');
    expect(image('residential', 4)).toBe('house3');
  });
});

describe('flowSteps', () => {
  it('sumber → pompa → bangunan → pembuangan → ventilasi, tanpa langkah yang tidak dihitung', () => {
    expect(flowSteps(NEEDS, 11, copy, 'id').map((s) => [s.key, s.label])).toEqual([
      ['rooftop_tank', 'Toren atap'],
      ['pump', 'Pompa pendorong'],
      ['building', '11 titik air'],
      ['drainage', 'Pembuangan'],
      ['vent', 'Ventilasi'],
    ]);
    const noDrain = NEEDS.filter((n) => n.kind !== 'drainage' && n.kind !== 'booster_pump');
    expect(flowSteps(noDrain, 11, copy, 'id').map((s) => s.key)).toEqual([
      'rooftop_tank',
      'building',
    ]);
  });
});

describe('buildingSummary', () => {
  it('satu baris data bangunan untuk kepala ringkasan', () => {
    expect(buildingSummary(NEEDS, copy, 'id')).toEqual({
      image: 'house2',
      meta: 'Rumah tinggal · 2 lantai · 8 × 15 m · 3,5 m per lantai',
    });
    expect(buildingSummary([], copy, 'id')).toBeNull();
  });
});
