/**
 * Tempat ibadah (Kelompok L, laporan pemilik 2026-10-12): "sistem masih nganggep kran itu wastafel,
 * pdhl masjid … ada bbrp kran yang berjejer dan cuma ada 1 pembuangan". Angka harapan dihitung
 * tangan dari tabel UPC A 103.1 (rumah ibadah memakai kolom pertemuan) dan keputusan pemilik
 * (0,1 l/s per keran wudhu, semua serentak); debit puncaknya dari kurva Hunter IPC.
 */
import { describe, expect, it } from 'vitest';
import { computeHouseDrainage } from './compute-house-waste.js';
import { computeSolution, type SolutionInput } from './compute-solution.js';

const MASJID: SolutionInput = {
  buildingType: 'place_of_worship',
  floors: 1,
  bathrooms: 4,
  basins: 0,
  kitchens: null,
  waterSource: 'municipal',
  installationType: 'both',
  floorHeightM: null,
  mainRunMeters: null,
  planLengthM: 20,
  planWidthM: 15,
  wudhuTaps: 8,
  wudhuAreas: 2,
};

describe('computeSolution · tempat ibadah', () => {
  it('toilet rumah ibadah (kloset 3,5 + keran 1,0) lewat Hunter, keran wudhu ditambah penuh', () => {
    const r = computeSolution(MASJID);
    // 4 × 3,5 + 4 × 1,0 = 18 WSFU → 18,8 gpm = 1,186 l/s; wudhu 8 × 0,1 = 0,8 l/s.
    expect(r.supply.wsfu).toBe(18);
    expect(r.supply.peakFlowLs).toBeCloseTo(1.986, 3);
    expect(r.traces.some((t) => t.ruleId === 'ENG-701')).toBe(false);
    expect(r.traces.some((t) => t.ruleId === 'ENG-012')).toBe(false);
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'WSFU_ASSEMBLY_WATER_CLOSET_3_5',
        'WSFU_PUBLIC_TAP_1',
        'WUDHU_TAP_FLOW_0_1LS',
        'WORSHIP_BATHROOM_WC_TAP',
        'WORSHIP_KITCHEN_0',
      ]),
    );
    expect(r.appliedAssumptionIds).not.toContain('HOUSE_KITCHEN_1');
  });

  it('keran wudhu bukan wastafel: titik air toilet saja, kamar mandi = kloset dan keran', () => {
    const r = computeSolution(MASJID);
    expect(r.outletCount).toBe(8);
    const eng001 = r.traces.find((t) => t.ruleId === 'ENG-001')!;
    expect(eng001.explanation).toContain('kloset dan keran');
    expect(eng001.explanation).not.toContain('shower');
  });

  it('dua tempat wudhu → dua deret 4 keran, pipa pembagi per deret dari debitnya', () => {
    const r = computeSolution(MASJID);
    expect(r.wudhu?.taps).toBe(8);
    expect(r.wudhu?.rows.map((row) => [row.taps, row.flowLs])).toEqual([
      [4, 0.4],
      [4, 0.4],
    ]);
    expect(r.wudhu?.rows[0]?.size).toMatch(/"$/);
  });

  it('tempat wudhu belum disebut → satu deret, asumsinya dicatat', () => {
    const r = computeSolution({ ...MASJID, wudhuAreas: null });
    expect(r.wudhu?.rows).toHaveLength(1);
    expect(r.appliedAssumptionIds).toContain('WUDHU_ONE_AREA');
  });

  it('rumah tidak berubah: tetap ENG-701, ENG-012, tanpa wudhu', () => {
    const r = computeSolution({ ...MASJID, buildingType: 'residential', wudhuTaps: 8 });
    expect(r.wudhu).toBeNull();
    expect(r.traces.some((t) => t.ruleId === 'ENG-701')).toBe(true);
    expect(r.traces.at(-1)?.ruleId).toBe('ENG-012');
  });
});

describe('urinoir (pemilik 2026-10-12: "di toilet cowo ada urinoir juga")', () => {
  it('air bersih: 3 urinoir × 3 WSFU ikut beban, titik air, dan cabang lantai dasar', () => {
    const r = computeSolution({ ...MASJID, urinals: 3 });
    // 18 + 9 = 27 WSFU → 22,22 gpm = 1,402 l/s; + wudhu 0,8 l/s.
    expect(r.supply.wsfu).toBe(27);
    expect(r.supply.peakFlowLs).toBeCloseTo(2.202, 3);
    expect(r.outletCount).toBe(11);
    const ground = r.branchGroups.flatMap((g) => g.branches).filter((b) => b.floor === 1);
    expect(ground.reduce((n, b) => n + b.urinals, 0)).toBe(3);
    expect(r.appliedAssumptionIds).toContain('WSFU_ASSEMBLY_URINAL_3');
  });

  it('rumah mengabaikan urinoir', () => {
    const r = computeSolution({ ...MASJID, buildingType: 'residential', urinals: 3 });
    expect(r.appliedAssumptionIds).not.toContain('WSFU_ASSEMBLY_URINAL_3');
  });

  it('pembuangan: urinoir masuk air kotor (4 DFU), sambungannya 2"', () => {
    // 4 kloset × 3 (UPC) + 3 urinoir × 4 (IPC, baris UPC belum terbaca) = 24 DFU.
    const r = computeHouseDrainage({ bathrooms: 4, basins: 0, kitchens: 0, urinals: 3 });
    expect(r.load.soilDfu).toBe(24);
    expect(r.fixtures).toContainEqual({ fixture: 'urinal', count: 3, size: '2"' });
    expect(r.appliedAssumptionIds).toContain('DFU_URINAL_4');
  });
});

describe('sekolah / klinik (pemilik 2026-10-12: "pakai hitungan toilet umum")', () => {
  it('toilet umum yang sama, tanpa wudhu walau keran wudhu terisi', () => {
    const r = computeSolution({ ...MASJID, buildingType: 'public_building', urinals: 3 });
    // Sekolah memakai kolom pemakaian umum, bukan pertemuan: 4 × 2,5 + 4 × 1,0 + 3 × 2,0 = 20 WSFU.
    expect(r.supply.wsfu).toBe(20);
    // Hanya Hunter: 19,6 gpm = 1,237 l/s, tanpa tambahan keran wudhu.
    expect(r.supply.peakFlowLs).toBeCloseTo(1.237, 3);
    expect(r.wudhu).toBeNull();
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining(['WSFU_PUBLIC_WATER_CLOSET_2_5', 'WORSHIP_KITCHEN_0']),
    );
    expect(r.appliedAssumptionIds).not.toContain('WUDHU_TAP_FLOW_0_1LS');
    expect(r.traces.some((t) => t.ruleId === 'ENG-012')).toBe(false);
  });
});

describe('computeHouseDrainage · talang wudhu', () => {
  it('satu talang per deret: 0,4 l/s = 6,3 gpm × 2 = 13 DFU → 2½"; masuk air bekas', () => {
    const r = computeHouseDrainage({
      bathrooms: 4,
      basins: 0,
      kitchens: 0,
      wudhuRowFlowsLs: [0.4, 0.4],
    });
    expect(r.wudhuTroughs).toEqual([
      { gpm: 6.3, dfu: 13, size: '2½"' },
      { gpm: 6.3, dfu: 13, size: '2½"' },
    ]);
    // 4 floor drain × 2 + 26 = 34 DFU → 3" (kapasitas UPC 35).
    expect(r.load.wasteDfu).toBe(34);
    expect(r.waste?.size).toBe('3"');
    expect(r.appliedAssumptionIds).toContain('DFU_CONTINUOUS_2_PER_GPM');
  });
});
