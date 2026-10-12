import { describe, expect, it } from 'vitest';
import type { RequirementState } from '@snouty/shared-types';
import { MISSING, requirementRows, sizeFromText, sizePatch } from './requirement-rows';

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
  it('ukuran bangunan dan tanah tampil sebagai dua baris yang diketik sendiri', () => {
    const rows = requirementRows(
      state({ lengthM: 8, widthM: 15, landLengthM: 10, landWidthM: 20 }),
    ).filter((r) => r.path === 'building.dimensions');
    expect(rows.map((r) => [r.label, r.display, r.raw, r.editor.kind])).toEqual([
      ['Ukuran bangunan', '8 × 15 m', '8 x 15', 'size'],
      ['Ukuran tanah', '10 × 20 m', '10 x 20', 'size'],
    ]);
    const [building, land] = requirementRows(state({ areaM2: 120 })).filter(
      (r) => r.path === 'building.dimensions',
    );
    expect(building!.display).toBe('luas 120 m²');
    expect(land!.display).toBe(MISSING);
  });

  it('teks "P x L" dikirim ke bagian ukuran yang benar', () => {
    expect(sizePatch('building', '8 x 12,5')).toEqual({ lengthM: 8, widthM: 12.5 });
    expect(sizePatch('land', '10×20 m')).toEqual({ landLengthM: 10, landWidthM: 20 });
    expect(sizePatch('building', '8')).toBeNull();
    expect(sizeFromText('')).toBeNull();
  });
});
