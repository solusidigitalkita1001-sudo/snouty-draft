import { describe, expect, it } from 'vitest';
import { canonicalProductName, designationsOf, distinctProductNames } from './product-identity.js';

describe('identitas produk', () => {
  it('salinan ERP "(copy)" dan koma desimal adalah produk yang sama', () => {
    expect(canonicalProductName('Pipa HDPE Gas SDR-13,6 50 mm x 100 Meter Kuning (copy)')).toBe(
      canonicalProductName('Pipa HDPE Gas SDR-13.6  50 mm x 100 Meter Kuning'),
    );
    expect(
      distinctProductNames([
        'Pipa HDPE Gas SDR-13.6 50 mm x 100 Meter Kuning',
        'Pipa HDPE Gas SDR-13,6 50 mm x 100 Meter Kuning (copy)',
        'Pipa HDPE Gas SDR-13.6 63 mm x 100 Meter Kuning',
      ]),
    ).toEqual([
      'Pipa HDPE Gas SDR-13.6 50 mm x 100 Meter Kuning',
      'Pipa HDPE Gas SDR-13.6 63 mm x 100 Meter Kuning',
    ]);
  });

  it('kelas hanya dari yang tertulis: satu penulisan, PN naik lalu SDR naik', () => {
    expect(
      designationsOf([
        'Pipa HDPE PE 100 PN-12,5 160 mm',
        'Pipa HDPE PE 100 PN-8 160 mm',
        'Pipa HDPE Gas SDR-13,6 50 mm',
        'Pipa HDPE Gas SDR-13.6 63 mm',
        'Pipa HDPE PN-16 90 mm',
        'Pipa HDPE Gas SDR-11 110 mm',
      ]),
    ).toEqual(['PN-8', 'PN-12.5', 'PN-16', 'SDR-11', 'SDR-13.6']);
  });

  it('nama tanpa penanda kelas tidak diberi kelas', () => {
    expect(designationsOf(['Pipa HDPE Telkom 40/33 x 182 Meter Orange'])).toEqual([]);
  });
});
