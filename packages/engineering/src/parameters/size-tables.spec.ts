/** Tebal dinding PE100 resmi Pralon (PROD/STD/014) menggantikan rumus OD ÷ SDR untuk HDPE. */
import { describe, expect, it } from 'vitest';
import { innerDiameterMm, pe100InnerDiameterMm, sizeTable } from './size-tables.js';

describe('diameter dalam HDPE dari PROD/STD/014', () => {
  it('OD 110 SDR 17: tebal 6,6 + 0,8 mm → rata-rata 7,0 mm → dalam 96,0 mm', () => {
    expect(pe100InnerDiameterMm(110, 17)).toBe(96);
    // Rumus lama OD ÷ SDR memberi 97,1 mm — dinding resmi lebih tebal.
    expect(innerDiameterMm(110, 17)).toBe(97.1);
  });

  it('kelas lain dibaca dari kolom SDR-nya (SDR 11, OD 63: 5,8 + 0,7 mm)', () => {
    expect(pe100InnerDiameterMm(63, 11)).toBe(50.7);
  });

  it('OD yang tidak diproduksi di SDR itu → null; tabel ukuran kembali ke rumus SDR', () => {
    expect(pe100InnerDiameterMm(20, 17)).toBeNull();
    const table = sizeTable('hdpe_mm', 17);
    expect(table.find((s) => s.size === '20 mm')!.innerMm).toBe(innerDiameterMm(20, 17));
    expect(table.find((s) => s.size === '110 mm')!.innerMm).toBe(96);
  });
});

describe('diameter dalam PVC dari PROD/STD-04 (kelas AW)', () => {
  it('½" AW: OD 22 + 0,2 → rata-rata 22,1; tebal 1,5 + 0,2 → rata-rata 1,6; dalam 18,9 mm (bukan 20,3)', () => {
    const half = sizeTable('pvc_inch').find((s) => s.size === '1/2"')!;
    expect(half.innerMm).toBe(18.9);
    expect(half.innerMm).not.toBe(innerDiameterMm(22, 26.5));
  });

  it('SDR yang diberikan tidak mengubah PVC: tebalnya resmi, bukan asumsi', () => {
    expect(sizeTable('pvc_inch', 11)).toEqual(sizeTable('pvc_inch'));
  });
});
