/**
 * Pembuangan rumah (laporan pemilik 2026-10-12): "rumah 2 lantai, 3 kamar mandi, air bersih +
 * pembuangan" dihitung, bukan diteruskan ke tim teknis. Angka harapan dihitung tangan dari tabel
 * IPC yang disebut di aturan.
 */
import { describe, expect, it } from 'vitest';
import { computeHouseDrainage } from './compute-house-waste.js';
import { RuleInputError } from './rule.js';

describe('computeHouseDrainage', () => {
  it('3 kamar mandi, 1 dapur: air kotor 3 × 4 = 12 DFU → 4" (minimum kloset); air bekas 3 × 2 + 1 × 2 = 8 DFU → 2"', () => {
    const r = computeHouseDrainage({ bathrooms: 3, basins: 0, kitchens: 1 });
    expect(r.load).toEqual({ soilDfu: 12, wasteDfu: 8 });
    expect(r.soil).toMatchObject({ capacitySize: '2"', size: '4"', ventSize: '2"' });
    expect(r.waste).toMatchObject({ capacitySize: '2"', size: '2"', ventSize: '1¼"' });
    expect(r.fixtures).toEqual([
      { fixture: 'water_closet', count: 3, size: '4"' },
      { fixture: 'shower', count: 3, size: '2"' },
      { fixture: 'kitchen_sink', count: 1, size: '1½"' },
    ]);
    expect(r.overallProvenance).toBe('ASSUMED');
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining(['DFU_WATER_CLOSET_4', 'DFU_SHOWER_2', 'SOIL_LINE_MIN_4IN']),
    );
  });

  it('beban air bekas di atas kapasitas 2½" (24) naik ke 3" (42)', () => {
    // 10 kamar mandi × 2 + 4 wastafel × 1 + 1 dapur × 2 = 26 DFU.
    const r = computeHouseDrainage({ bathrooms: 10, basins: 4, kitchens: 1 });
    expect(r.load.wasteDfu).toBe(26);
    expect(r.waste?.size).toBe('3"');
  });

  it('jalur kloset yang diganti 3" dipakai; ukuran di luar seri ditolak', () => {
    expect(
      computeHouseDrainage({ bathrooms: 2, basins: 0, kitchens: 0 }, 'id', { SOIL_LINE_MIN_4IN: 3 })
        .soil?.size,
    ).toBe('3"');
    expect(() =>
      computeHouseDrainage({ bathrooms: 2, basins: 0, kitchens: 0 }, 'id', {
        SOIL_LINE_MIN_4IN: 3.3,
      }),
    ).toThrow(RuleInputError);
  });

  it('tanpa kamar mandi tidak ada jalur air kotor', () => {
    const r = computeHouseDrainage({ bathrooms: 0, basins: 1, kitchens: 1 });
    expect(r.soil).toBeNull();
    expect(r.waste?.size).toBe('2"');
  });
});

describe('panjang jalur pembuangan dari ukuran rumah (ENG-603, P16-60)', () => {
  it('air kotor = panjang + turun antar lantai, air bekas = panjang, ventilasi = tinggi bangunan + 1 m', () => {
    const result = computeHouseDrainage({
      bathrooms: 3,
      basins: 0,
      kitchens: 1,
      layout: { planLengthM: 12, floors: 2, floorHeightM: 3.5 },
    });
    expect(result.lengths).toEqual({
      soilNetM: 15.5,
      wasteNetM: 12,
      soilVentNetM: 8,
      wasteVentNetM: 8,
    });
    expect(result.appliedAssumptionIds).toContain('HOUSE_VENT_ABOVE_ROOF_1M');
  });

  it('tanpa ukuran rumah tidak ada panjang', () => {
    expect(computeHouseDrainage({ bathrooms: 1, basins: 0, kitchens: 1 }).lengths).toBeNull();
  });
});
