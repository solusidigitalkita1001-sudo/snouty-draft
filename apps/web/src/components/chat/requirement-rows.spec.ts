import { describe, expect, it } from 'vitest';
import type { RequirementState } from '@snouty/shared-types';
import { MISSING, planFromOption, requirementRows } from './requirement-rows';

const field = (value: unknown) => ({ value, provenance: 'VERIFIED' as const });
const state = (dimensions: unknown) =>
  ({
    building: {
      type: field('residential'),
      floors: field(2),
      floorHeightM: field(null),
      dimensions: field(dimensions),
    },
    fixtures: {
      bathrooms: field(3),
      basins: field(null),
      kitchens: field(1),
      outletCount: field(null),
    },
    water: {
      source: field('municipal'),
      installationType: field('both'),
      boosterPump: field(null),
    },
  }) as unknown as RequirementState;

describe('baris ukuran rumah (2026-10-12)', () => {
  it('panjang × lebar tampil dan bisa dipilih ulang; luas saja tampil sebagai luas', () => {
    const plan = requirementRows(state({ lengthM: 8, widthM: 15 })).find(
      (r) => r.path === 'building.dimensions',
    )!;
    expect(plan.label).toBe('Ukuran rumah');
    expect(plan.display).toBe('8 × 15 m');
    expect(plan.raw).toBe('8x15');
    expect(
      requirementRows(state({ areaM2: 120 })).find((r) => r.path === 'building.dimensions')!
        .display,
    ).toBe('luas 120 m²');
    expect(
      requirementRows(state(null)).find((r) => r.path === 'building.dimensions')!.display,
    ).toBe(MISSING);
  });

  it('pilihan "8x15" dikirim sebagai panjang × lebar', () => {
    expect(planFromOption('8x15')).toEqual({ lengthM: 8, widthM: 15 });
    expect(planFromOption('')).toBeNull();
  });
});
