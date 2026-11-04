import { describe, expect, it } from 'vitest';
import { extractionToUpdates, perFloorKeepsTotal } from './extraction-to-updates.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { mergeRequirement } from '../domain/context-merger.js';

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

  // Produksi 2026-11-04: "gudang 1 lantai 2000 m2 cuma ada 2 toilet" dijawab dengan menanyakan
  // panjang × lebar bangunannya — ukuran yang baru saja disebut.
  it('m² tanpa kata "luas" di pesan tentang bangunan adalah luas bangunan', () => {
    expect(dims('gudang 1 lantai 2000 m2 cuma ada 2 toilet')).toEqual({ areaM2: 2000 });
    expect(dims('rumah 2 lantai 120 m2, 3 kamar mandi')).toEqual({ areaM2: 120 });
    expect(dims('tanah 2000 m2 mau dibangun rumah 2 lantai')).toEqual({ landAreaM2: 2000 });
  });

  it('m² di luar bangunan tidak menjadi luas bangunan', () => {
    expect(dims('sawah 10000 m2 mau diairi')).toBeUndefined();
    expect(dims('kamar mandinya 6 m2, rumah 2 lantai')).toBeUndefined();
    // Sisi bangunan lebih tepat daripada luasnya.
    expect(dims('rumah 2 lantai 10 x 9 m, 120 m2')).toEqual({ lengthM: 10, widthM: 9 });
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

  // Produksi 2026-10-26: "water comes from a deep well, about 30 m" tercatat sebagai jalur utama
  // ±30 m, dan "water from a borehole, 30 metres deep" tidak tercatat sama sekali.
  it('kedalaman di balik koma, di belakang angka, dan dari kata borehole', () => {
    const deep = 'water comes from a deep well, about 30 m';
    expect(value(deep, 'water.wellDepthM')).toBe(30);
    expect(value(deep, 'building.dimensions')).toBeUndefined();
    expect(value('water from a borehole, 30 metres deep', 'water.wellDepthM')).toBe(30);
    expect(value('water from a borehole, 30 metres deep', 'water.source')).toBe('pump');
    const id = 'sumber airnya sumur bor, dalamnya sekitar 30 m';
    expect(value(id, 'water.wellDepthM')).toBe(30);
    expect(value(id, 'building.dimensions')).toBeUndefined();
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

describe('perubahan tersurat dengan kata "jadi" (produksi 2026-10-26)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('"lantainya jadi 3" dan "kamar mandinya jadi 5" terbaca', () => {
    expect(value('kalau lantainya jadi 3 gimana', 'building.floors')).toBe(3);
    expect(value('lantainya jadi 3', 'building.floors')).toBe(3);
    expect(value('lantainya menjadi 4', 'building.floors')).toBe(4);
    expect(value('kamar mandinya jadi 5', 'fixtures.bathrooms')).toBe(5);
  });

  it('"lantai 3" tanpa kata perubahan bukan tiga lantai', () => {
    expect(value('torennya di lantai 3', 'building.floors')).toBeUndefined();
    expect(value('kamar mandi di lantai 2 bocor', 'building.floors')).toBeUndefined();
  });
});

describe('jumlah yang dibagi per posisi (produksi 2026-10-26)', () => {
  const value = (message: string, path: string, extraction = {}) =>
    extractionToUpdates(extraction, message).find((u) => u.path === path)?.value;

  it('"atasnya 2 kamar mandi bawahnya 1" tercatat 3', () => {
    const message =
      'renov rumah ortu, 2 lantai, atasnya ada 2 kamar mandi bawahnya 1, dapur 1, cucian 1';
    expect(value(message, 'fixtures.bathrooms')).toBe(3);
    // Angka model yang hanya mengambil bagian pertamanya pun tidak lagi dipakai apa adanya.
    expect(value(message, 'fixtures.bathrooms', { fixtures: { bathrooms: 2 } })).toBe(3);
    expect(value(message, 'fixtures.kitchens')).toBe(1);
  });

  it('satu angka, satuan per lantai, dan pembetulan tidak dijumlahkan', () => {
    expect(value('rumah 2 lantai, 3 kamar mandi', 'fixtures.bathrooms')).toBe(3);
    expect(value('gedung 3 lantai, 6 kamar mandi per lantai', 'fixtures.bathrooms')).toBe(18);
    // Kalimat pembetulan tidak dijumlahkan (angka mana yang berlaku urusan parser lain).
    expect(value('bukan 3 kamar mandi, 2 kamar mandi aja', 'fixtures.bathrooms')).not.toBe(5);
  });

  it('titik air di kalimat renovasi tetap bukan jumlah baru', () => {
    expect(
      value('sudah ada 4 titik air, mau tambah 2 titik', 'fixtures.outletCount'),
    ).toBeUndefined();
  });
});

describe('angka milik kata benda lain (produksi 2026-10-26)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  // Produksi 2026-10-27: "mau bangun masjid, tempat wudhunya 20 kran" tercatat 20 TEMPAT wudhu
  // (20 talang pembuangan) dan 20 titik air biasa — padahal yang disebut 20 keran wudhu.
  it('"tempat wudhunya 20 kran" adalah 20 keran wudhu, bukan 20 tempat', () => {
    const message = 'mau bangun masjid 2 lantai, tempat wudhunya 20 kran, ada 6 toilet';
    expect(value(message, 'fixtures.wudhuTaps')).toBe(20);
    expect(value(message, 'fixtures.wudhuAreas')).toBeUndefined();
    expect(value(message, 'fixtures.outletCount')).toBeUndefined();
    expect(value(message, 'fixtures.bathrooms')).toBe(6);
  });

  it('tempat wudhu yang memang dihitung tetap terbaca', () => {
    expect(value('musala dengan 3 tempat wudhu', 'fixtures.wudhuAreas')).toBe(3);
    expect(value('masjid, tempat wudhunya ada 2', 'fixtures.wudhuAreas')).toBe(2);
  });

  it('"8 keran wudhu di 2 tempat wudhu" tetap 8 keran dan 2 tempat', () => {
    const message =
      'Masjid 2 lantai, 4 kamar mandi, 8 keran wudhu di 2 tempat wudhu, 3 urinoir, PDAM';
    expect(value(message, 'fixtures.wudhuTaps')).toBe(8);
    expect(value(message, 'fixtures.wudhuAreas')).toBe(2);
    expect(value(message, 'fixtures.bathrooms')).toBe(4);
  });
});

describe('kamar sewa dengan kamar mandi sendiri (produksi 2026-10-26)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('"4 lantai, tiap lantai 6 kamar, tiap kamar ada kamar mandi sendiri" tercatat 24', () => {
    const message =
      'mau bangun kos 4 lantai, tiap lantai 6 kamar, tiap kamar ada kamar mandi sendiri';
    expect(value(message, 'fixtures.bathrooms')).toBe(24);
    expect(value(message, 'building.floors')).toBe(4);
    expect(value(message, 'building.type')).toBe('boarding_house');
  });

  it('tanpa penanda per lantai jumlah kamarnya tidak dikali', () => {
    expect(value('kos 10 kamar, tiap kamar kamar mandi dalam', 'fixtures.bathrooms')).toBe(10);
  });

  it('jumlah kamar mandi yang tersurat tetap menang', () => {
    expect(value('rumah 2 lantai, 3 kamar mandi dalam kamar', 'fixtures.bathrooms')).toBe(3);
  });
});

describe('tinggi tower toren bukan panjang jalur (produksi 2026-10-26)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('"toren 10 kubik di atas tower 9 meter" tidak mengisi panjang jalur', () => {
    const message =
      'sumber airnya dari sumur dalam komunal, ada toren 10 kubik di atas tower 9 meter';
    expect(value(message, 'building.dimensions')).toBeUndefined();
    expect(value(message, 'water.source')).toBe('rooftop_tank');
  });

  it('panjang jalur yang memang disebut tetap terbaca', () => {
    expect(value('jalur utamanya 18 meter', 'building.dimensions')).toEqual({
      mainRunMeters: 18,
    });
  });
});

describe('nomor lantai bukan jumlah alat (produksi 2026-11-02)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('"1 kamar mandi di lantai 2" satu kamar mandi, bukan tiga', () => {
    expect(value('1 kamar mandi di lantai 2', 'fixtures.bathrooms')).toBe(1);
    expect(value('mau nambah 1 kamar mandi di lantai 2', 'fixtures.bathrooms')).toBe(1);
  });

  it('jumlah yang dibagi per lantai tetap dijumlahkan', () => {
    expect(
      value('lantai 1 ada 1 kamar mandi, lantai 2 ada 2 kamar mandi', 'fixtures.bathrooms'),
    ).toBe(3);
    expect(value('atasnya ada 2 kamar mandi bawahnya 1', 'fixtures.bathrooms')).toBe(3);
  });
});

describe('angka satu lantai tidak menurunkan totalnya (produksi 2026-11-03)', () => {
  const state = () =>
    mergeRequirement(
      emptyRequirementState('2026-11-03T00:00:00.000Z'),
      [
        { path: 'building.floors', value: 2, source: 'user_stated' },
        { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
      ],
      '2026-11-03T00:00:00.000Z',
    ).state;

  const run = (message: string) =>
    perFloorKeepsTotal(state(), extractionToUpdates({}, message), message);

  it('"yang lantai 2 ada 2 kamar mandi" menahan 3 yang sudah tercatat', () => {
    const { updates, kept } = run('yang lantai 2 ada 2 kamar mandi');
    expect(updates.some((u) => u.path === 'fixtures.bathrooms')).toBe(false);
    expect(kept).toEqual([{ path: 'fixtures.bathrooms', total: 3, perFloor: 2 }]);
  });

  it('bagian yang lebih besar dari totalnya tetap menaikkan angkanya', () => {
    const { updates, kept } = run('yang lantai 2 ada 4 kamar mandi');
    expect(updates.find((u) => u.path === 'fixtures.bathrooms')?.value).toBe(4);
    expect(kept).toEqual([]);
  });

  it('rincian semua lantai adalah total baru, bukan bagian', () => {
    const message = 'lantai 1 ada 1 kamar mandi, lantai 2 ada 2 kamar mandi';
    const { updates, kept } = perFloorKeepsTotal(
      state(),
      extractionToUpdates({}, message),
      message,
    );
    expect(updates.find((u) => u.path === 'fixtures.bathrooms')?.value).toBe(3);
    expect(kept).toEqual([]);
  });

  it('kalimat tanpa lantai yang disebut tidak tersentuh', () => {
    const { updates, kept } = run('jadi 2 kamar mandi aja');
    expect(updates.find((u) => u.path === 'fixtures.bathrooms')?.value).toBe(2);
    expect(kept).toEqual([]);
  });
});

describe('kamar kos di bangunan campuran (produksi 2026-11-03)', () => {
  const value = (message: string, path: string) =>
    extractionToUpdates({}, message).find((u) => u.path === path)?.value;

  it('"lantai 2 sama 3 kosan 6 kamar" mencatat enam kamarnya', () => {
    expect(value('lantai 1 buat jualan, lantai 2 sama 3 kosan 6 kamar', 'building.rooms')).toBe(6);
  });

  it('kontrakan dan asrama juga kamar sewa', () => {
    expect(value('kontrakan 8 kamar', 'building.rooms')).toBe(8);
    expect(value('asrama 20 kamar', 'building.rooms')).toBe(20);
  });

  it('kamar tidur rumah bukan kamar sewa, dan "kosong" bukan kos', () => {
    expect(value('rumah 3 kamar tidur', 'building.rooms')).toBeUndefined();
    expect(value('lantai 2 masih kosong, 4 kamar', 'building.rooms')).toBeUndefined();
  });
});
