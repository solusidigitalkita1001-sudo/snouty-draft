/** P23-01 — lapisan renovasi di atas hitungan kasus: kapasitas pipa lama, sambungan, sebagian. */
import { describe, expect, it } from 'vitest';
import {
  computeRenovation,
  existingMaterialOf,
  outerDiameterMmOf,
  renovationModeOf,
} from './compute-renovation.js';
import { renovationCue, extractTechnicalContext } from './cases/extractor.js';
import { caseProfile } from './cases/profiles.js';
import { resolveMissingParameters } from './cases/missing.js';

const facts = (message: string) =>
  Object.fromEntries(extractTechnicalContext(message, null).map((f) => [f.key, f.value]));

describe('computeRenovation', () => {
  it('diameter luar dari label: inci lewat tabel PRALON AW, mm apa adanya, label asing null', () => {
    expect(outerDiameterMmOf('1/2"')).toBe(22);
    expect(outerDiameterMmOf('1 1/4"')).toBe(outerDiameterMmOf('1¼"'));
    expect(outerDiameterMmOf('110 mm')).toBe(110);
    expect(outerDiameterMmOf('abc')).toBeNull();
  });

  it('nilai protokol jenis pekerjaan → mode; bahan lama → nilai aturan', () => {
    expect(renovationModeOf('Perluasan')).toBe('extend');
    expect(renovationModeOf('Ganti sebagian')).toBe('replace_partial');
    expect(renovationModeOf('Ganti semua pipa')).toBe('replace_all');
    expect(renovationModeOf(undefined)).toBe('new');
    expect(existingMaterialOf('Galvanis / besi')).toBe('Galvanis / besi');
    expect(existingMaterialOf('apa saja')).toBe('unknown');
  });

  it('perluasan rumah: 3/4" lama kurang untuk total yang butuh 1"; sambungan ke galvanis lewat sok drat', () => {
    const r = computeRenovation({
      mode: 'extend',
      newMainSize: '3/4"',
      branchSize: '3/4"',
      existingSize: '3/4"',
      existingMaterial: 'Galvanis / besi',
      requiredSizeForTotal: '1"',
      existingLoad: 4,
      newLoad: 2,
      loadUnit: 'titik',
    });
    expect(r.totalLoad).toBe(6);
    expect(r.capacity).toMatchObject({
      existingSize: '3/4"',
      requiredSize: '1"',
      sufficient: false,
    });
    expect(r.capacityUnchecked).toBeNull();
    expect(r.tieIn?.method).toBe('threaded_adaptor');
    expect(r.tieIn?.fittings.map((f) => `${f.kind}×${f.quantity}`)).toEqual([
      'faucet_socket×2',
      'tee×1',
    ]);
    expect(r.traces.map((t) => t.ruleId)).toEqual(['ENG-904', 'ENG-901', 'ENG-902']);
    expect(r.traces.every((t) => t.provenance === 'ASSUMED')).toBe(true);
  });

  it('perluasan tanpa ukuran pipa lama: kapasitas tidak dicek dan alasannya disebut; tanpa sambungan', () => {
    const r = computeRenovation({
      mode: 'extend',
      newMainSize: '90 mm',
      requiredSizeForTotal: '110 mm',
    });
    expect(r.capacity).toBeNull();
    expect(r.capacityUnchecked).toBe('no_existing_size');
    expect(r.tieIn).toBeNull();
  });

  it('perluasan tanpa ukuran total: pipa lama disebut tapi bebannya tidak → no_total_size, sambungan tetap ada', () => {
    const r = computeRenovation({
      mode: 'extend',
      newMainSize: '63 mm',
      existingSize: '110 mm',
      existingMaterial: 'HDPE',
    });
    expect(r.capacityUnchecked).toBe('no_total_size');
    expect(r.tieIn?.method).toBe('hdpe_tee');
    expect(r.tieIn?.fittings[0]).toMatchObject({
      kind: 'tee',
      size: '110 mm',
      branchSize: '63 mm',
    });
  });

  it('ganti sebagian: 12 m dari jalur 30 m → rasio 0,4 dan 2 sok; tanpa panjang → seluruh jalur dengan asumsi', () => {
    const r = computeRenovation({
      mode: 'replace_partial',
      newMainSize: '3/4"',
      replacementLengthM: 12,
      routeLengthM: 30,
    });
    expect(r.partial).toEqual({ ratio: 0.4, couplings: 2, lengthM: 12 });
    expect(r.appliedAssumptionIds).toEqual(['RENOV_COUPLINGS_PER_SEGMENT_2']);
    const whole = computeRenovation({
      mode: 'replace_partial',
      newMainSize: '3/4"',
      routeLengthM: 30,
    });
    expect(whole.partial).toEqual({ ratio: 1, couplings: 2, lengthM: 30 });
    expect(whole.appliedAssumptionIds).toContain('RENOV_REPLACE_WHOLE_ROUTE');
  });

  it('ganti semua: tidak ada hitungan tambahan, hanya mode', () => {
    const r = computeRenovation({ mode: 'replace_all', newMainSize: '1"' });
    expect(r.traces).toEqual([]);
    expect(r.capacity).toBeNull();
    expect(r.partial).toBeNull();
  });
});

describe('ekstraksi renovasi (P23-01)', () => {
  it('jenis pekerjaan dari kosakata: perluasan, sebagian, semua; "renovasi" saja hanya isyarat', () => {
    expect(facts('renovasi rumah, tambah 1 kamar mandi di belakang')['work_type']).toBe(
      'Perluasan',
    );
    expect(facts('pipa induk pdam bocor, ganti 300 meter')['work_type']).toBe('Ganti sebagian');
    expect(facts('rumah subsidi, ganti semua pipanya ke pralon')['work_type']).toBe(
      'Ganti semua pipa',
    );
    expect(facts('mau renovasi instalasi air rumah')['work_type']).toBeUndefined();
    expect(renovationCue('mau renovasi instalasi air rumah')).toBe(true);
    expect(renovationCue('rumah 2 lantai 3 kamar mandi')).toBe(false);
    expect(facts('extend the network, add 200 connections')['work_type']).toBe('Perluasan');
  });

  it('pipa lama: ukuran, bahan, beban yang sudah ada; panjang yang diganti bukan panjang jalur', () => {
    const house = facts('tambah 2 titik air, pipa lama 3/4 inch galvanis, sudah ada 4 titik air');
    expect(house).toMatchObject({
      work_type: 'Perluasan',
      existing_pipe_size: '3/4"',
      existing_pipe_material: 'Galvanis / besi',
      existing_outlets: 4,
    });
    expect(house).not.toHaveProperty('material');
    const spam = facts(
      'perluasan spam, pipa induk lama 110 mm hdpe sudah melayani 300 sr, tambah 200 sambungan, jalur baru 800 m',
    );
    expect(spam).toMatchObject({
      work_type: 'Perluasan',
      existing_pipe_size: '110 mm',
      existing_pipe_material: 'HDPE',
      existing_connections: 300,
      number_of_connections: 200,
      route_length: 800,
    });
    const partial = facts('pipa bocor, yang diganti 12 m dari jalur 30 m');
    expect(partial).toMatchObject({
      work_type: 'Ganti sebagian',
      replacement_length: 12,
      route_length: 30,
    });
    expect(facts('existing 1" steel pipe, add a bathroom')).toMatchObject({
      existing_pipe_size: '1"',
      existing_pipe_material: 'Galvanis / besi',
      work_type: 'Perluasan',
    });
  });

  it('bahan baru tetap terbaca bila bukan pipa lama', () => {
    expect(facts('spam 500 sr pipa hdpe')['material']).toBe('HDPE');
    expect(facts('spam 500 sr pipa hdpe')).not.toHaveProperty('existing_pipe_material');
  });
});

describe('pertanyaan renovasi bersyarat (resolver)', () => {
  const profile = caseProfile('water_supply_network');
  const known = new Set(['number_of_connections', 'route_length', 'static_head', 'source_type']);

  it('bangun baru / tanpa isyarat: tidak ada pertanyaan pipa lama', () => {
    const keys = resolveMissingParameters({ profile, known, assumed: new Set() }).map((m) => m.key);
    expect(keys).not.toContain('existing_pipe_size');
    expect(keys).not.toContain('work_type');
  });

  it('isyarat renovasi tanpa jenis → jenis pekerjaan ditanya paling dulu sebagai kritis', () => {
    const missing = resolveMissingParameters({
      profile,
      known,
      assumed: new Set(),
      renovationHinted: true,
    });
    expect(missing[0]).toMatchObject({ key: 'work_type', importance: 'critical' });
  });

  it('perluasan: ukuran pipa lama, sambungan lama, bahan lama — setelah yang kritis, sebelum yang penting', () => {
    const missing = resolveMissingParameters({
      profile,
      known: new Set(['number_of_connections']),
      assumed: new Set(),
      workType: 'Perluasan',
    });
    const keys = missing.map((m) => m.key);
    expect(keys.slice(0, 2)).toEqual(['route_length', 'static_head']);
    expect(keys).toContain('existing_pipe_size');
    expect(keys).toContain('existing_connections');
    expect(missing.length).toBeLessThanOrEqual(4);
  });

  it('ganti sebagian: panjang yang diganti dan bahan lama; ganti semua: hanya bahan lama', () => {
    const partial = resolveMissingParameters({
      profile,
      known,
      assumed: new Set(),
      workType: 'Ganti sebagian',
    }).map((m) => m.key);
    expect(partial).toContain('replacement_length');
    expect(partial).toContain('existing_pipe_material');
    expect(partial).not.toContain('existing_pipe_size');
    const all = resolveMissingParameters({
      profile,
      known,
      assumed: new Set(),
      workType: 'Ganti semua pipa',
    }).map((m) => m.key);
    expect(all).toContain('existing_pipe_material');
    expect(all).not.toContain('replacement_length');
  });
});
