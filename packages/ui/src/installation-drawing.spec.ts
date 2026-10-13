/** P17-07 (DD-01 #7): denah dari kebutuhan rekomendasi — tidak ada alat atau ruang yang dikarang. */
import type { SolutionNeed } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import {
  branchFixtures,
  drawingInputFrom,
  floorPlanSvg,
  sectionSvg,
  type DrawingCopy,
} from './installation-drawing.js';

const COPY: DrawingCopy = {
  floor: (l, e) => `LANTAI ${l} · +${e}`,
  roof: (e) => `ATAP · +${e}`,
  ground: 'TANAH',
  floorHeight: (h) => `${h} m`,
  length: (m) => `Panjang ${m} m`,
  width: (m) => `Lebar ${m} m`,
  tank: 'Toren atap',
  groundTank: 'Toren bawah',
  meter: 'Meteran',
  well: 'Sumur',
  pump: 'Pompa pendorong',
  septic: 'Septic',
  vent: 'Ventilasi',
  riser: 'Pipa tegak',
  soilStack: 'Pipa tegak buang',
  fixtures: {
    shower: 'Shower',
    wc: 'Kloset',
    basin: 'Wastafel',
    kitchen: 'Dapur',
    urinal: 'Urinoir',
  },
  decimal: (v) => String(v).replace('.', ','),
};

const NEEDS: readonly SolutionNeed[] = [
  {
    kind: 'building',
    count: 2,
    building: {
      type: 'residential',
      floors: 2,
      floorHeightM: 3.5,
      lengthM: 8,
      widthM: 15,
      mainSize: '1"',
      branches: [
        { floor: 2, size: '1"', bathrooms: 2, basins: 0, kitchens: 0, urinals: 0 },
        { floor: 2, size: '1/2"', bathrooms: 0, basins: 2, kitchens: 0, urinals: 0 },
        { floor: 1, size: '3/4"', bathrooms: 1, basins: 2, kitchens: 0, urinals: 0 },
        { floor: 1, size: '1/2"', bathrooms: 0, basins: 0, kitchens: 1, urinals: 0 },
      ],
    },
  },
  { kind: 'rooftop_tank', count: 1 },
  { kind: 'booster_pump', count: 1, residualBar: 0.02 },
  {
    kind: 'drainage',
    count: 1,
    soilSize: '4"',
    wasteSize: '2½"',
    soilVentSize: '2"',
    wasteVentSize: '1¼"',
  },
];

describe('drawingInputFrom', () => {
  it('membaca bangunan, cabang, sumber, pompa, dan pembuangan dari kebutuhan', () => {
    const input = drawingInputFrom(NEEDS)!;
    expect(input).toMatchObject({
      floors: 2,
      mainSize: '1"',
      source: 'rooftop_tank',
      boosterPump: true,
    });
    expect(input.branches).toHaveLength(4);
    expect(input.drainage).toEqual({
      soilSize: '4"',
      wasteSize: '2½"',
      soilVentSize: '2"',
      wasteVentSize: '1¼"',
    });
  });

  it('tanpa butir bangunan (kasus teknis, rekomendasi lama) tidak ada denah', () => {
    expect(drawingInputFrom([{ kind: 'rooftop_tank', count: 1 }])).toBeNull();
  });
});

describe('branchFixtures', () => {
  it('kamar mandi = shower + kloset, lalu wastafel, dapur, urinoir — jumlahnya persis', () => {
    expect(
      branchFixtures({ floor: 1, size: '3/4"', bathrooms: 1, basins: 2, kitchens: 1, urinals: 1 }),
    ).toEqual(['shower', 'wc', 'basin', 'basin', 'kitchen', 'urinal']);
  });
});

describe('sectionSvg / floorPlanSvg', () => {
  const input = drawingInputFrom(NEEDS)!;
  const section = sectionSvg(input, COPY);

  it('setiap alat dari cabang tergambar, tidak lebih', () => {
    const total = input.branches.reduce((sum, b) => sum + branchFixtures(b).length, 0);
    expect(section.match(/<use href="#il-(shower|wc|basin|kitchen|urinal)"/g)).toHaveLength(total);
  });

  it('ukuran dari kebutuhan tertulis: pipa utama, tiap cabang, pembuangan, ventilasi', () => {
    for (const size of [
      '1&quot;',
      '1/2&quot;',
      '3/4&quot;',
      '4&quot;',
      '2½&quot;',
      '2&quot;',
      '1¼&quot;',
    ]) {
      expect(section).toContain(`>${size}</text>`);
    }
    expect(section).toContain('Pompa pendorong');
    expect(section).toContain('Panjang 15 m');
  });

  it('denah lantai: kotak bangunan berukuran, titik air lantai itu saja', () => {
    const plan = floorPlanSvg(input, 1, COPY);
    expect(plan).toContain('Panjang 15 m');
    expect(plan).toContain('Lebar 8 m');
    // Lantai 1: shower, kloset, 2 wastafel (cabang 3/4") + dapur (cabang 1/2").
    expect(plan.match(/<circle [^>]*r="5"/g)).toHaveLength(5);
  });

  it('label di-escape', () => {
    const evil = sectionSvg(input, { ...COPY, tank: '<script>x</script>' });
    expect(evil).not.toContain('<script>');
    expect(evil).toContain('&lt;script&gt;');
  });
});
