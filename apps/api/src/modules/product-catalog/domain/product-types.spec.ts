/** Nama-nama di sini disalin dari katalog produksi (erp-2026-10-06). */
import { describe, expect, it } from 'vitest';
import { productTypeOf, productTypesOf } from './product-types.js';

describe('productTypeOf', () => {
  it.each([
    ['Pipa HDPE PE 100 PN-8 160 mm x 9 Meter', 'Pipa HDPE PE 100', 'PN-8'],
    [
      'Pipa HDPE PE 100 PN-12.5 110 mm x 6 Meter Kuning (Strip Hijau)',
      'Pipa HDPE PE 100',
      'PN-12.5',
    ],
    ['Pipa HDPE Telkom 40/33 x 182 Meter Orange Garis Biru', 'Pipa HDPE Telkom', null],
    ['Pipa HDPE Gas SDR-11 180 mm x 12 Meter Kuning', 'Pipa HDPE Gas SDR-11', null],
    ['Pipa (TS End) Putih AW 1 1/2" x 4 Meter', 'Pipa (TS End) AW', null],
    ['Pipa (Plain End) Abu AW 1/2" x 1 Meter', 'Pipa (Plain End) AW', null],
    ['Bend 22 1/2° - D 110 mm Coklat', 'Bend 22 1/2° - D', null],
    ['Red Socket - W 90 x 32 mm', 'Red Socket - W', null],
    ['Pipa HDPE Gas SDR-13,6 25 mm x 100 Meter Kuning', 'Pipa HDPE Gas SDR-13.6', null],
    ['Tee (Segmented) PE PN-12,5 315 x 160 mm', 'Tee (Segmented) PE', 'PN-12.5'],
  ])('%s → %s', (name, type, pn) => {
    expect(productTypeOf(name)).toEqual({ type, pressureClass: pn });
  });
});

describe('productTypesOf', () => {
  it('mengelompokkan per jenis, terbanyak dulu, PN urut naik', () => {
    const types = productTypesOf([
      'Pipa HDPE PE 100 PN-10 225 mm x 6 Meter',
      'Pipa HDPE PE 100 PN-8 25 mm x 200 Meter',
      'Pipa HDPE PE 100 PN-16 180 mm x 12 Meter (Strip Biru)',
      'Pipa HDPE Telkom 32/26 x 100 Meter HItam Garis Kuning',
    ]);
    expect(types.map((t) => [t.type, t.count])).toEqual([
      ['Pipa HDPE PE 100', 3],
      ['Pipa HDPE Telkom', 1],
    ]);
    expect(types[0]!.pressureClasses).toEqual(['PN-8', 'PN-10', 'PN-16']);
  });
});
