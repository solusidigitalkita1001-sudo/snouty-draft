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

describe('pompa pendorong dari teks (uji sales 2026-10-20, SC-04)', () => {
  const booster = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'water.boosterPump')?.value;
  const source = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'water.source')?.value;

  it('booster yang disebut tercatat tanpa model, dan bukan sumber air', () => {
    expect(booster('Air rumah gue pakai booster pump. Jalur utama kira-kira 20 meter.')).toBe(true);
    expect(booster('rumah 2 lantai pakai pompa pendorong')).toBe(true);
    expect(source('Air rumah gue pakai booster pump.')).toBeUndefined();
  });

  it('peniadaan berarti tanpa pompa; tidak disebut berarti tidak dicatat', () => {
    expect(booster('rumah 2 lantai tanpa pompa booster')).toBe(false);
    expect(booster('rumah 2 lantai, toren di atap')).toBeUndefined();
  });
});

describe('pesan rumah tanpa model (pemilik 2026-10-21)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('jumlah dengan kata bilangan terbaca', () => {
    expect(value('rumah dua lantai, kamar mandinya tiga', 'building.floors')).toBe(2);
    expect(value('rumah dua lantai, kamar mandinya tiga', 'fixtures.bathrooms')).toBe(3);
    expect(value('rumah satu lantai dengan dua belas keran', 'fixtures.outletCount')).toBe(12);
    expect(value('rumah 2 lantai, 3 kamar mandi', 'fixtures.bathrooms')).toBe(3);
  });

  it('titik air tersurat terbaca, kecuali keran wudhu dan titik tambahan', () => {
    expect(value('rumah 2 lantai, total 10 titik air', 'fixtures.outletCount')).toBe(10);
    expect(value('masjid 2 lantai, 12 keran wudhu', 'fixtures.outletCount')).toBeUndefined();
    expect(value('rumah 2 lantai mau tambah 2 titik air', 'fixtures.outletCount')).toBeUndefined();
  });

  it('kedalaman sumur terbaca dan bukan panjang jalur', () => {
    expect(value('rumah pakai sumur bor 25 meter', 'water.wellDepthM')).toBe(25);
    expect(value('rumah pakai sumur bor 25 meter', 'building.dimensions')).toBeUndefined();
    expect(value('rumah 2 lantai, jalur 15 meter', 'water.wellDepthM')).toBeUndefined();
  });

  it('rumah sakit dan rumah makan bukan rumah tinggal', () => {
    expect(value('rumah sakit 3 lantai', 'building.type')).not.toBe('residential');
    expect(value('rumah makan 2 lantai', 'building.type')).not.toBe('residential');
    expect(value('Gue mau pasang air bersih di rumah', 'building.type')).toBe('residential');
  });
});

describe('jumlah per lantai (produksi 2026-10-26)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('satuan per lantai dikali jumlah lantai', () => {
    expect(value('gedung 3 lantai, 6 kamar mandi per lantai', 'fixtures.bathrooms')).toBe(18);
    expect(value('kantor 3 lantai, tiap lantai ada 2 kamar mandi', 'fixtures.bathrooms')).toBe(6);
    expect(value('3 storey office, 6 bathrooms per floor', 'fixtures.bathrooms')).toBe(18);
    expect(value('kantor 4 lantai, 2 wastafel setiap lantai', 'fixtures.basins')).toBe(8);
  });

  it('tanpa penanda per lantai angkanya tetap total', () => {
    expect(value('gedung 3 lantai, 6 kamar mandi', 'fixtures.bathrooms')).toBe(6);
    expect(value('rumah 2 lantai, 3 kamar mandi', 'fixtures.bathrooms')).toBe(3);
    expect(value('rumah 1 lantai, 2 kamar mandi per lantai', 'fixtures.bathrooms')).toBe(2);
  });
});
