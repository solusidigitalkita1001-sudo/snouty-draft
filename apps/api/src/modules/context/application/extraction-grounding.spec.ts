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

  it('nilai model menang bila ada; kamar mandi juga; tanpa angka tersurat tidak ada tebakan', () => {
    const withModel = extractionToUpdates(
      { building: { floors: 3 } },
      'rumah 2 lantai, 3 kamar mandi',
    );
    expect(withModel).toContainEqual({ path: 'building.floors', value: 3, source: 'user_stated' });
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

  it('jenis instalasi tersurat ("drainase sawah") terbaca walau model mengembalikan {}', () => {
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
