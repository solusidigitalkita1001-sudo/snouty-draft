/**
 * Pagar grounding: field yang hanya bermakna bila pengguna menyebutnya dibuang bila
 * pesannya tidak memuat penandanya. Kasus nyatanya dari qwen2.5:7b, 2026-10-05:
 * "Rumah 2 lantai, 3 kamar mandi, …" → model menulis floorHeightM 3 dan mainRunMeters 0.
 */
import { describe, expect, it } from 'vitest';
import { extractionToUpdates } from './extraction-to-updates.js';

const MESSAGE = 'Rumah 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur, toren di atap, air bersih';

describe('extractionToUpdates — fakta tersurat yang dilewatkan model', () => {
  it('model mengembalikan {} untuk "… buat rumah 2 lantai?" → lantai dan tipe tetap terbaca dari teks', () => {
    const updates = extractionToUpdates({}, 'lebih bagus PVC atau HDPE buat rumah 2 lantai?');
    expect(updates).toEqual([
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
    ]);
  });

  it('angka model yang bertentangan dengan teks kalah dari teks; kamar mandi juga; tanpa angka tersurat tidak ada tebakan', () => {
    // Sebelum 2026-10-06 angka model menang; kini "2 lantai" tersurat mengalahkan `floors: 3`.
    const withModel = extractionToUpdates(
      { building: { floors: 3 } },
      'rumah 2 lantai, 3 kamar mandi',
    );
    expect(withModel).toContainEqual({ path: 'building.floors', value: 2, source: 'user_stated' });
    expect(
      extractionToUpdates({ building: { floors: 3 } }, 'rumah tiga lantai, 3 kamar mandi'),
    ).toContainEqual({ path: 'building.floors', value: 3, source: 'user_stated' });
    expect(withModel).toContainEqual({
      path: 'fixtures.bathrooms',
      value: 3,
      source: 'user_stated',
    });
    expect(extractionToUpdates({}, 'rumah saya ada beberapa lantai')).toEqual([
      { path: 'building.type', value: 'residential', source: 'user_stated' },
    ]);
    expect(extractionToUpdates({}, 'apa bedanya pvc sama hdpe?')).toEqual([]);
  });

  it('jenis instalasi tersurat ("drainase") terbaca walau model mengembalikan {}', () => {
    expect(extractionToUpdates({}, 'rekomendasi product buat project drainase sawah')).toEqual([
      { path: 'water.installationType', value: 'drainage', source: 'user_stated' },
    ]);
    expect(extractionToUpdates({}, 'air bersih dan pembuangan ruko')).toContainEqual({
      path: 'water.installationType',
      value: 'both',
      source: 'user_stated',
    });
  });
});

describe('extractionToUpdates — angka dan jenis bangunan yang dikarang (produksi 2026-10-06)', () => {
  // Keluaran asli qwen2.5 7B untuk "mau tanya soal pipa": menyalin contoh di prompt.
  const fabricated = {
    building: { type: 'residential' as const, floors: 2 },
    fixtures: { bathrooms: 3, basins: 2, kitchens: 1 },
  };

  it('"mau tanya soal pipa" → tidak satu pun field dipercaya', () => {
    expect(extractionToUpdates(fabricated, 'mau tanya soal pipa')).toEqual([]);
  });

  it('angka dipercaya hanya bila ada di pesan — digit maupun kata bilangan', () => {
    const paths = (m: string) => extractionToUpdates(fabricated, m).map((u) => u.path);
    // basins 2 dikarang: ada "2" di pesan, tetapi tidak di dekat "wastafel" — tetap dibuang.
    expect(paths('rumah 2 lantai, 3 kamar mandi')).toEqual([
      'building.type',
      'building.floors',
      'fixtures.bathrooms',
    ]);
    expect(paths('rumah 2 lantai, 3 kamar mandi, 2 wastafel')).toContain('fixtures.basins');
    expect(paths('rumah lantai dua, sekamar mandi')).toEqual(['building.type', 'building.floors']);
    expect(
      extractionToUpdates({ fixtures: { bathrooms: 1 } }, 'rumah sekamar mandi'),
    ).toContainEqual({ path: 'fixtures.bathrooms', value: 1, source: 'user_stated' });
    expect(paths('rumah dua lantai, tiga kamar mandi, satu dapur')).toEqual([
      'building.type',
      'building.floors',
      'fixtures.bathrooms',
      'fixtures.kitchens',
    ]);
    // "12" bukan "2"; "23" bukan "3"
    // "12" bukan "2" dan "23" bukan "3": angka model dibuang, angka dari teks yang dipakai.
    const fromText = extractionToUpdates(fabricated, 'rumah 12 lantai, 23 kamar mandi');
    expect(fromText).toEqual([
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 12, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 23, source: 'user_stated' },
    ]);
  });

  it('nol hanya bila pesannya meniadakan; jenis bangunan hanya bila kata bendanya ada', () => {
    expect(
      extractionToUpdates({ fixtures: { kitchens: 0 } }, 'rumah 1 lantai tanpa dapur'),
    ).toContainEqual({
      path: 'fixtures.kitchens',
      value: 0,
      source: 'user_stated',
    });
    expect(extractionToUpdates({ fixtures: { kitchens: 0 } }, 'rumah 1 lantai')).toEqual([
      { path: 'building.type', value: 'residential', source: 'user_stated' },
      { path: 'building.floors', value: 1, source: 'user_stated' },
    ]);
    expect(
      extractionToUpdates({ building: { type: 'boarding_house' } }, 'kos 3 lantai'),
    ).toContainEqual({
      path: 'building.type',
      value: 'boarding_house',
      source: 'user_stated',
    });
    expect(
      extractionToUpdates({ building: { type: 'boarding_house' } }, 'bangunan 3 lantai'),
    ).toEqual([{ path: 'building.floors', value: 3, source: 'user_stated' }]);
  });
});

describe('extractionToUpdates — peniadaan tersurat yang dilewatkan model', () => {
  it('"tidak ada dapur" dengan model yang diam → kitchens 0; tanpa peniadaan tetap kosong', () => {
    const paths = extractionToUpdates(
      { building: { floors: 2 } },
      'rumah 2 lantai, tidak ada dapur',
    );
    expect(paths).toContainEqual({ path: 'fixtures.kitchens', value: 0, source: 'user_stated' });
    expect(
      extractionToUpdates({}, 'rumah 2 lantai').some((u) => u.path === 'fixtures.kitchens'),
    ).toBe(false);
  });
});

describe('extractionToUpdates — letak toren tersurat mengalahkan model (produksi 2026-10-07)', () => {
  it('"toren di atap" + model ground_tank → rooftop_tank; toren TANPA letak → ditanya, tebakan model dibuang', () => {
    const src = (m: string, model: 'ground_tank' | 'rooftop_tank' | undefined) =>
      extractionToUpdates({ water: { source: model } }, m).find((u) => u.path === 'water.source')
        ?.value;
    expect(src('rumah 2 lantai, toren di atap', 'ground_tank')).toBe('rooftop_tank');
    expect(src('tandon bawah tanah 2 m³', 'rooftop_tank')).toBe('ground_tank');
    // Produksi 2026-10-07: "mau pasang 2 toren" → model menulis ground_tank → "toren bawah" tercatat.
    expect(src('air dari toren', 'ground_tank')).toBeUndefined();
    expect(src('rencana aku mau pasang 2 toren supaya cukup', 'ground_tank')).toBeUndefined();
    // Tanpa kata toren, nilai model tetap dipakai (tidak ada yang bisa dibaca kode).
    expect(src('air dari pompa sumur', 'ground_tank')).toBe('ground_tank');
    expect(src('air PDAM langsung', undefined)).toBe('municipal');
  });
});

describe('extractionToUpdates — grounding', () => {
  it('membuang tinggi lantai dan panjang jalur yang tidak pernah diucapkan', () => {
    const updates = extractionToUpdates(
      {
        building: { type: 'residential', floors: 2, floorHeightM: 3, mainRunMeters: 0 },
        fixtures: { bathrooms: 3, basins: 4, kitchens: 1 },
        water: { source: 'rooftop_tank', installationType: 'clean_water' },
      },
      MESSAGE,
    );
    const paths = updates.map((u) => u.path);
    expect(paths).toContain('building.floors');
    expect(paths).toContain('fixtures.bathrooms');
    expect(paths).not.toContain('building.floorHeightM');
    expect(paths).not.toContain('building.dimensions');
  });

  it('mempertahankannya bila pengguna memang menyebutnya', () => {
    const updates = extractionToUpdates(
      { building: { floorHeightM: 3.5, mainRunMeters: 18 } },
      'tinggi tiap lantai 3,5 meter, jalur utama sekitar 18 meter',
    );
    expect(updates.map((u) => u.path)).toEqual(['building.floorHeightM', 'building.dimensions']);
  });

  it('booster pump dan jumlah titik juga butuh penanda', () => {
    expect(
      extractionToUpdates({ water: { boosterPump: true } }, 'rumah 2 lantai').map((u) => u.path),
    ).not.toContain('water.boosterPump');
    expect(
      extractionToUpdates({ water: { boosterPump: true } }, 'pakai pompa pendorong').map(
        (u) => u.path,
      ),
    ).toEqual(['water.boosterPump']);
    expect(
      extractionToUpdates({ fixtures: { outletCount: 8 } }, 'rumah 2 lantai').map((u) => u.path),
    ).not.toContain('fixtures.outletCount');
  });

  it('tanpa model (diet 2026-10-07): pompa/sumur sebagai sumber dibaca kode, pompa pendorong dan wastafel/dapur juga', () => {
    const paths = (m: string) => extractionToUpdates({}, m);
    const value = (m: string, path: string) => paths(m).find((u) => u.path === path)?.value;
    expect(value('pabrik 2 lantai, 3 kamar mandi, pompa, air bersih', 'water.source')).toBe('pump');
    expect(value('air dari sumur bor', 'water.source')).toBe('pump');
    expect(value('rumah 2 lantai pakai pompa pendorong', 'water.source')).toBeUndefined();
    expect(value('air dari toren, pakai pompa', 'water.source')).toBeUndefined();
    expect(value('4 wastafel, 1 dapur', 'fixtures.basins')).toBe(4);
    expect(value('4 wastafel, 1 dapur', 'fixtures.kitchens')).toBe(1);
    expect(value('2 sinks and a kitchen', 'fixtures.basins')).toBe(2);
  });

  it('sumber air dan jenis instalasi butuh penanda — "rumah baru 1 lantai" tidak menyebut PDAM', () => {
    const invented = extractionToUpdates(
      { water: { source: 'municipal', installationType: 'clean_water' } },
      'Instalasi air bersih untuk rumah baru 1 lantai',
    ).map((u) => u.path);
    expect(invented).not.toContain('water.source');
    expect(invented).toContain('water.installationType');
    expect(
      extractionToUpdates({ water: { source: 'municipal' } }, 'airnya dari PDAM').map(
        (u) => u.path,
      ),
    ).toContain('water.source');
  });

  it('tanpa pesan (pemanggil lama) tidak ada yang dibuang', () => {
    expect(extractionToUpdates({ building: { floorHeightM: 3 } })).toHaveLength(1);
  });
});
