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

  // Angka harapan dihitung tangan, bukan disalin dari engine (koreksi 2026-10-12).
  it('kamar mandi dua titik (shower + kloset): 3 × 2 + 4 + 1 = 11 titik; cabang per lantai: lantai 2 = 6 titik (2), lantai 1 = 5 titik (2)', () => {
    expect(result.outletCount).toBe(11);
    expect(result.branchCount).toBe(4);
    expect(result.maxOutletsPerBranch).toBe(4);
  });

  it('debit puncak: 3 × (2,2 + 1,0) + 4 × 0,5 + 1,0 = 12,6 WSFU → 16,3 gpm (kurva Hunter) = 1,028 l/s', () => {
    expect(result.supply.wsfu).toBe(12.6);
    expect(result.supply.peakFlowLs).toBeCloseTo(16.3 * 0.0630902, 3);
  });

  it('pipa utama 1": di 3/4" (dalam 24 mm) air 2,27 m/s melewati batas 2 m/s, di 1" (29,6 mm) 1,49 m/s', () => {
    const v = (id: number) => 1.028e-3 / ((Math.PI * (id / 1000) ** 2) / 4);
    expect(v(24)).toBeGreaterThan(2);
    expect(v(29.6)).toBeCloseTo(1.49, 2);
    expect(result.mainSize).toBe('1"');
  });

  it('tinggi lantai memakai default 3,5 m saat pengguna tidak memberikannya', () => {
    expect(result.floorHeightM).toBe(3.5);
  });

  it('toren 1 m di atas atap hanya 2,5 m di atas shower lantai 2 → di bawah 0,3 bar, perlu pompa pendorong', () => {
    // Toren 2 × 3,5 + 1 = 8 m; shower (2 − 1) × 3,5 + 2 = 5,5 m.
    expect(result.supply.staticHeadM).toBe(-2.5);
    expect(result.supply.gravityResidualBar!).toBeLessThan(0.3);
    expect(result.boosterPumpNeeded).toBe(true);
  });

  it('air bersih → kelas AW', () => {
    expect(result.pressureClasses).toEqual(['AW']);
  });

  it('tanpa ukuran rumah tidak ada panjang pipa untuk material; dengan 8 × 15 m ada', () => {
    expect(result.mainRunNetM).toBeNull();
    expect(result.supply.routeBasis).toBe('assumed');
    const sized = computeSolution({ ...BOARD_EXAMPLE, planLengthM: 8, planWidthM: 15 });
    // 8 + 15 m mendatar + (8 − 5,5) m turun dari toren ke shower.
    expect(sized.mainRunNetM).toBe(25.5);
    expect(sized.supply.routeBasis).toBe('plan');
  });

  it('PDAM: tekanan yang dibutuhkan di meteran = naik 5,5 m + kehilangan + 1 bar', () => {
    const pdam = computeSolution({ ...BOARD_EXAMPLE, waterSource: 'municipal' });
    const m = pdam.supply.main;
    expect(pdam.supply.requiredSourcePressureBar).toBeCloseTo(
      (5.5 + m.frictionLossM + m.minorLossM + 10.197) / 10.197,
      1,
    );
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
    // ENG-102 berjalan sekali per beban cabang yang berbeda (ENG-707); aturan lain sekali.
    const once = ids.filter((id) => id !== 'ENG-102');
    expect(new Set(once).size).toBe(once.length);
    expect(ids.filter((id) => id === 'ENG-102').length).toBe(
      new Set(result.branchGroups.flatMap((g) => g.branches.map((b) => b.wsfu))).size,
    );
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

describe('TC-H-01 · tanpa "unit beban" lama di trace', () => {
  it('langkah titik air hanya menghitung titik; beban suplai satu-satunya WSFU Kelompok K', () => {
    // Masjid 0009: 4 KM, 8 wastafel, 0 dapur.
    const masjid = computeSolution({
      ...BOARD_EXAMPLE,
      buildingType: 'light_commercial',
      bathrooms: 4,
      basins: 8,
      kitchens: 0,
      waterSource: 'municipal',
      installationType: 'both',
    });
    for (const locale of ['id', 'en'] as const) {
      const text = computeSolution(
        {
          ...BOARD_EXAMPLE,
          bathrooms: 4,
          basins: 8,
          kitchens: 0,
          waterSource: 'municipal',
        },
        locale,
      )
        .traces.map((t) => t.explanation)
        .join(' ');
      expect(text).not.toMatch(/Unit beban memakai bobot|Load units use weights/);
    }
    const outlets = masjid.traces.find((t) => t.ruleId === 'ENG-001')!;
    expect(outlets.explanation).toBe(
      'Titik air dihitung 4 kamar mandi × 2 (shower dan kloset) + 8 wastafel + 0 dapur = 16 titik.',
    );
    expect(masjid.supply.wsfu).toBe(16.8);
    // ENG-006 (cadangan lapangan tanpa efek) sudah dihapus.
    expect(masjid.traces.some((t) => t.ruleId === 'ENG-006')).toBe(false);
  });
});

describe('pompa sumber vs pompa pendorong (review putaran 3)', () => {
  // U2: 3 lantai, 10 × 8 m, tanah 20 × 10 m, 4 KM, 2 wastafel, 1 dapur, pompa sumur.
  const U2: SolutionInput = {
    buildingType: 'residential',
    floors: 3,
    bathrooms: 4,
    basins: 2,
    kitchens: 1,
    waterSource: 'pump',
    installationType: 'clean_water',
    floorHeightM: null,
    mainRunMeters: null,
    planLengthM: 10,
    planWidthM: 8,
    landLengthM: 20,
    landWidthM: 10,
  };

  it('U2 sumur: pompanya bagian sumber, bukan pompa pendorong kedua', () => {
    const result = computeSolution(U2);
    expect(result.sourcePumped).toBe(true);
    expect(result.boosterPumpNeeded).toBe(false);
  });

  it('U2 kedalaman belum disebut → muka air 6 m (asumsi), masuk tinggi angkat', () => {
    const result = computeSolution(U2);
    expect(result.appliedAssumptionIds).toContain('WELL_WATER_DEPTH_6M');
    // Titik tertinggi (3 − 1) × 3,5 + 2 = 9 m, ditambah muka air 6 m.
    expect(result.supply.staticHeadM).toBe(15);
    expect(result.supply.well).toEqual({ depthM: 6, suctionLimitM: 7, beyondSuction: false });
  });

  it('muka air 9 m → di luar batas sedot 7 m: pompa jet / submersible', () => {
    const result = computeSolution({ ...U2, wellDepthM: 9 });
    expect(result.appliedAssumptionIds).not.toContain('WELL_WATER_DEPTH_6M');
    expect(result.supply.staticHeadM).toBe(18);
    expect(result.supply.well!.beyondSuction).toBe(true);
  });

  it('toren bawah juga dipompa sendiri, tanpa pendorong; PDAM tidak dipompa', () => {
    const ground = computeSolution({ ...U2, waterSource: 'ground_tank' });
    expect(ground).toMatchObject({ sourcePumped: true, boosterPumpNeeded: false });
    expect(ground.supply.well).toBeNull();
    const pdam = computeSolution({ ...U2, waterSource: 'municipal' });
    expect(pdam).toMatchObject({ sourcePumped: false, boosterPumpNeeded: false });
  });

  // U1: 1 lantai, 10 × 6 m, tanah 15 × 8 m, 1 KM, 1 dapur, 0 wastafel, toren atap.
  const U1: SolutionInput = {
    ...U2,
    floors: 1,
    bathrooms: 1,
    basins: 0,
    waterSource: 'rooftop_tank',
    planLengthM: 10,
    planWidthM: 6,
    landLengthM: 15,
    landWidthM: 8,
  };

  it('U1 toren 1 m di atas atap 1 lantai: beda tinggi 2,5 m < 3,06 m → pipa saja tidak cukup, dudukan dinaikkan', () => {
    const result = computeSolution(U1);
    // Toren 3,5 + 1 = 4,5 m; shower 2 m.
    expect(result.supply.staticHeadM).toBe(-2.5);
    expect(result.boosterPumpNeeded).toBe(true);
    expect(result.sourcePumped).toBe(false);
    expect(result.supply.gravityRemedy!.heightShort).toBe(true);
    // Kekurangan = 0,3 bar (3,06 m) + kehilangan − 2,5 m, ditambah ke dudukan 1 m, per 0,5 m.
    const lossM = result.supply.main.frictionLossM + result.supply.main.minorLossM;
    const stand = Math.ceil((1 + 0.3 * 10.197 + lossM - 2.5) / 0.5) * 0.5;
    expect(result.supply.gravityRemedy!.minimumStandM).toBe(stand);
  });

  it('U1 dengan dudukan sesuai saran → tekanan cukup tanpa pompa', () => {
    const first = computeSolution(U1);
    const raised = computeSolution(U1, undefined, {
      TANK_STAND_1M: first.supply.gravityRemedy!.minimumStandM,
    });
    expect(raised.boosterPumpNeeded).toBe(false);
    expect(raised.supply.gravityRemedy).toBeNull();
    expect(raised.supply.gravityResidualBar!).toBeGreaterThanOrEqual(0.3);
  });
});

describe('pertanyaan yang tidak dijawab tercatat sebagai asumsi (review putaran 3, 3b)', () => {
  it('wastafel belum disebut → 1 per kamar mandi (putaran 4, 6d), dapur belum disebut → HOUSE_KITCHEN_1', () => {
    const result = computeSolution({ ...BOARD_EXAMPLE, basins: null, kitchens: null });
    expect(result.appliedAssumptionIds).toEqual(
      expect.arrayContaining(['HOUSE_BASINS_PER_BATHROOM_1', 'HOUSE_KITCHEN_1']),
    );
    // 3 kamar mandi × 2 titik + 3 wastafel + 1 dapur.
    expect(result.outletCount).toBe(10);
  });

  it('wastafel disebut (0 pun) → bukan asumsi', () => {
    const result = computeSolution({ ...BOARD_EXAMPLE, basins: 0 });
    expect(result.appliedAssumptionIds).not.toContain('HOUSE_BASINS_0');
  });
});
