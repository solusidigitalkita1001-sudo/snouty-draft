import { describe, expect, it } from 'vitest';
import { extractionToUpdates } from './extraction-to-updates.js';

describe('ukuran rumah dari teks (laporan pemilik 2026-10-12: "kurang parameter luas")', () => {
  const dims = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'building.dimensions')?.value;

  it('panjang × lebar dan luas dibaca sebagai nilai bersatuan', () => {
    expect(dims('gw mau bikin rumah 8x15, 2 lantai')).toEqual({ lengthM: 8, widthM: 15 });
    expect(dims('luas bangunan 120 m2, 2 lantai')).toEqual({ areaM2: 120 });
  });

  it('ukuran ruangan bukan ukuran rumah; angka lantai bukan ukuran', () => {
    expect(dims('kamar mandi 2x3 meter, 3 kamar mandi')).toBeUndefined();
    expect(dims('rumah 2 lantai, 3 kamar mandi')).toBeUndefined();
  });
});

describe('pasangan N x M (review putaran 3, 3a)', () => {
  const dims = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'building.dimensions')?.value;

  it('tanpa label: pasangan pertama adalah bangunan', () => {
    expect(dims('10x8')).toEqual({ lengthM: 10, widthM: 8 });
    expect(dims('10 x 8 m')).toEqual({ lengthM: 10, widthM: 8 });
    expect(dims('ukuran 10×8')).toEqual({ lengthM: 10, widthM: 8 });
  });

  it('bangunan dan tanah dalam satu kalimat', () => {
    expect(dims('bangunan 10 x 8, tanah 20 x 10')).toEqual({
      lengthM: 10,
      widthM: 8,
      landLengthM: 20,
      landWidthM: 10,
    });
  });

  it('didahului tanah/lahan → ukuran tanah', () => {
    expect(dims('ukuran tanahnya 6 x 12 m')).toEqual({ landLengthM: 6, landWidthM: 12 });
    expect(dims('lahan 15x8')).toEqual({ landLengthM: 15, landWidthM: 8 });
  });

  it('luas tanpa label adalah luas bangunan', () => {
    expect(dims('luas 80 m2')).toEqual({ areaM2: 80 });
  });

  it('jumlah kamar mandi sebelum ukuran bukan ukuran ruangan', () => {
    expect(dims('3 lantai, 4 km 10x8 m')).toEqual({ lengthM: 10, widthM: 8 });
    expect(dims('kamar mandi 2x3 meter')).toBeUndefined();
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
