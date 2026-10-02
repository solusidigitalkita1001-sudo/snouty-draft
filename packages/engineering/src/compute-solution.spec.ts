/**
 * P6-08a — orkestrator engine: contoh kerja desain, trace per aturan, kemurnian,
 * dan jaminan provenance selagi seluruh aturan belum divalidasi.
 */
import { describe, expect, it } from 'vitest';
import { computeSolution, type SolutionInput } from './compute-solution.js';
import { gateEngineProvenance } from './provenance.js';

/** Contoh kerja yang muncul di seluruh desain: rumah 2 lantai, 3 KM, 4 wastafel, 1 dapur. */
const BOARD_EXAMPLE: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
};

describe('computeSolution — contoh kerja desain', () => {
  const result = computeSolution(BOARD_EXAMPLE);

  it('menghasilkan 8 titik air dan 11 unit beban', () => {
    expect(result.outletCount).toBe(8);
    expect(result.loadUnits).toBe(11);
  });

  it('jalur utama 1" (11 unit melewati ambang 8)', () => {
    expect(result.mainSize).toBe('1"');
  });

  it('8 titik air menjadi 2 cabang, maksimum 4 per cabang', () => {
    expect(result.branchCount).toBe(2);
    expect(result.maxOutletsPerBranch).toBe(4);
  });

  it('tinggi lantai memakai default 3,5 m saat pengguna tidak memberikannya', () => {
    expect(result.floorHeightM).toBe(3.5);
  });

  it('toren atap pada hunian: tanpa pompa pendorong', () => {
    expect(result.boosterPumpNeeded).toBe(false);
  });

  it('air bersih → kelas AW', () => {
    expect(result.pressureClasses).toEqual(['AW']);
  });

  it('BOM mengikuti formula prototipe', () => {
    expect(result.bom).toEqual([
      { item: 'Pipa PVC AW', size: '1"', quantity: 4, unit: 'batang' },
      { item: 'Pipa PVC AW', size: '3/4"', quantity: 6, unit: 'batang' },
      { item: 'Tee', size: '3/4"', quantity: 5, unit: 'pcs' },
      { item: 'Elbow 90°', size: '3/4"', quantity: 9, unit: 'pcs' },
      { item: 'Reducer', size: '1"→3/4"', quantity: 2, unit: 'pcs' },
    ]);
  });

  it('BOM tidak memuat baris yang formulanya belum ada (lem PVC)', () => {
    // Laporan dua halaman menyebut "Lem PVC, 100 gr, 2 kaleng", tetapi tidak ada
    // formulanya. Mengarang satu untuk mengisi tabel adalah halusinasi berbaju rapi.
    expect(result.bom.some((line) => /lem/i.test(line.item))).toBe(false);
  });

  it('menyebar titik air ke dua lantai dengan elevasi dari tinggi lantai', () => {
    expect(result.floorsPlan).toEqual([
      { floor: 2, bathrooms: 2, basins: 2, kitchens: 0, elevationM: 3.5 },
      { floor: 1, bathrooms: 1, basins: 2, kitchens: 1, elevationM: 0 },
    ]);
  });
});

describe('trace dan auditabilitas (SPEC §8)', () => {
  it('menulis satu trace untuk setiap aturan yang dieksekusi', () => {
    const result = computeSolution(BOARD_EXAMPLE);
    const ids = result.traces.map((t) => t.ruleId);
    // ENG-004 ikut karena tinggi lantai tidak diberikan.
    expect(ids).toContain('ENG-004');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(11);
  });

  it('setiap trace membawa versi aturan, masukan, keluaran, dan penjelasan', () => {
    for (const trace of computeSolution(BOARD_EXAMPLE).traces) {
      expect(trace.ruleVersion).toBeGreaterThan(0);
      expect(trace.inputs).toBeDefined();
      expect(trace.output).toBeDefined();
      expect(trace.explanation.length).toBeGreaterThan(10);
    }
  });

  it('tidak menjalankan ENG-004 saat pengguna memberi tinggi lantai', () => {
    const result = computeSolution({ ...BOARD_EXAMPLE, floorHeightM: 3 });
    expect(result.traces.map((t) => t.ruleId)).not.toContain('ENG-004');
    expect(result.floorHeightM).toBe(3);
  });
});

describe('provenance keluar engine', () => {
  it('seluruh trace ASSUMED selagi aturannya belum divalidasi (OQ-06)', () => {
    for (const trace of computeSolution(BOARD_EXAMPLE).traces) {
      expect(trace.provenance).toBe('ASSUMED');
    }
  });

  it('tidak ada satu pun angka teknik yang VERIFIED hari ini', () => {
    const result = computeSolution(BOARD_EXAMPLE);
    expect(result.overallProvenance).toBe('ASSUMED');
    expect(result.traces.some((t) => t.provenance === 'VERIFIED')).toBe(false);
  });

  it('dimensi nyata pun tidak menaikkan aturan yang belum divalidasi', () => {
    const result = computeSolution({ ...BOARD_EXAMPLE, mainRunMeters: 42 });
    expect(result.overallProvenance).toBe('ASSUMED');
  });

  it('gerbang: aturan tervalidasi + dimensi nyata → VERIFIED; tanpa dimensi → ESTIMATED', () => {
    expect(gateEngineProvenance({ ruleStatus: 'VALIDATED', hasRealDimensions: true })).toBe(
      'VERIFIED',
    );
    expect(gateEngineProvenance({ ruleStatus: 'VALIDATED', hasRealDimensions: false })).toBe(
      'ESTIMATED',
    );
    expect(gateEngineProvenance({ ruleStatus: 'REJECTED', hasRealDimensions: true })).toBe(
      'UNAVAILABLE',
    );
  });
});

describe('kemurnian dan determinisme', () => {
  it('masukan sama menghasilkan keluaran identik — laporan bisa dibuat ulang', () => {
    expect(JSON.stringify(computeSolution(BOARD_EXAMPLE))).toBe(
      JSON.stringify(computeSolution(BOARD_EXAMPLE)),
    );
  });

  it('menolak masukan di luar batas masuk akal', () => {
    expect(() => computeSolution({ ...BOARD_EXAMPLE, floors: 900 })).toThrow();
    expect(() => computeSolution({ ...BOARD_EXAMPLE, bathrooms: -1 })).toThrow();
  });

  it('selesai jauh di bawah 300 ms (SPEC §8)', () => {
    // `Date.now` dan bukan `performance`: paket ini sengaja tanpa tipe DOM/Node.
    // Granularitas 1 ms lebih dari cukup untuk ambang 300 ms.
    const started = Date.now();
    for (let i = 0; i < 100; i += 1) computeSolution(BOARD_EXAMPLE);
    expect((Date.now() - started) / 100).toBeLessThan(300);
  });
});
