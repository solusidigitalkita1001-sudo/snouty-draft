/** Review putaran 3, kelompok 2: angka rumah yang janggal ditanya balik. */
import { describe, expect, it } from 'vitest';
import { houseInputIssues } from './house-input-issues.js';

describe('houseInputIssues', () => {
  it('U3: 2 × 2 m, 2 lantai, 6 kamar mandi → 8 m² untuk 6 kamar mandi, kurang dari 2 m² per kamar mandi', () => {
    const [issue] = houseInputIssues({ floors: 2, bathrooms: 6, lengthM: 2, widthM: 2 });
    expect(issue!.code).toBe('area_per_bathroom');
    expect(issue!.question).toBe(
      'Bangunan 2 × 2 m 2 lantai luasnya 8 m², untuk 6 kamar mandi itu kurang dari 2 m² per kamar mandi. Ukuran bangunan dan jumlah kamar mandinya sudah benar?',
    );
  });

  it('tepat 2 m² per kamar mandi masih wajar; luas tapak dipakai bila sisinya tidak ada', () => {
    expect(houseInputIssues({ floors: 1, bathrooms: 2, lengthM: 2, widthM: 2 })).toEqual([]);
    expect(houseInputIssues({ floors: 1, bathrooms: 10, areaM2: 15 })[0]!.code).toBe(
      'area_per_bathroom',
    );
  });

  it('tanah lebih kecil daripada bangunan', () => {
    const [issue] = houseInputIssues({
      floors: 2,
      bathrooms: 2,
      lengthM: 10,
      widthM: 8,
      landLengthM: 8,
      landWidthM: 6,
    });
    expect(issue).toMatchObject({
      code: 'land_smaller_than_building',
      note: 'Tanah 8 × 6 m lebih kecil daripada bangunan 10 × 8 m.',
    });
  });

  it('U1 dan U2 wajar', () => {
    expect(
      houseInputIssues({
        floors: 1,
        bathrooms: 1,
        lengthM: 10,
        widthM: 6,
        landLengthM: 15,
        landWidthM: 8,
      }),
    ).toEqual([]);
    expect(
      houseInputIssues({
        floors: 3,
        bathrooms: 4,
        lengthM: 10,
        widthM: 8,
        landLengthM: 20,
        landWidthM: 10,
      }),
    ).toEqual([]);
  });

  it('data belum lengkap → tidak ada yang dinilai', () => {
    expect(houseInputIssues({ floors: null, bathrooms: 6, lengthM: 2, widthM: 2 })).toEqual([]);
    expect(houseInputIssues({ floors: 2, bathrooms: 6 })).toEqual([]);
  });
});
