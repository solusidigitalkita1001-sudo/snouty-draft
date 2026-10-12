import { describe, expect, it } from 'vitest';
import { extractionToUpdates } from './extraction-to-updates.js';

describe('ukuran rumah dari teks (laporan pemilik 2026-10-12: "kurang parameter luas")', () => {
  const dims = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'building.dimensions')?.value;

  it('panjang × lebar dan luas dibaca sebagai nilai bersatuan', () => {
    expect(dims('gw mau bikin rumah 8x15, 2 lantai')).toEqual({ lengthM: 8, widthM: 15 });
    expect(dims('ukuran tanahnya 6 x 12 m')).toEqual({ lengthM: 6, widthM: 12 });
    expect(dims('luas bangunan 120 m2, 2 lantai')).toEqual({ areaM2: 120 });
  });

  it('ukuran ruangan bukan ukuran rumah; angka lantai bukan ukuran', () => {
    expect(dims('kamar mandi 2x3 meter, 3 kamar mandi')).toBeUndefined();
    expect(dims('rumah 2 lantai, 3 kamar mandi')).toBeUndefined();
  });
});

describe('ukuran tanah dan bangunan dari teks (2026-10-12)', () => {
  const dims = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'building.dimensions')?.value;

  it('tanah dan bangunan dipisah menurut kata bendanya', () => {
    expect(dims('rumah 8 x 12 m di tanah 10x20 meter')).toEqual({
      lengthM: 8,
      widthM: 12,
      landLengthM: 10,
      landWidthM: 20,
    });
    expect(dims('tanah saya 10 x 20')).toEqual({ landLengthM: 10, landWidthM: 20 });
  });

  it('luas tanah tidak pernah menjadi luas bangunan', () => {
    expect(dims('luas tanah 200 m2, luas bangunan 120 m2')).toEqual({
      landAreaM2: 200,
      areaM2: 120,
    });
    expect(dims('LT 150 m2 LB 90 m2')).toEqual({ landAreaM2: 150, areaM2: 90 });
  });
});
