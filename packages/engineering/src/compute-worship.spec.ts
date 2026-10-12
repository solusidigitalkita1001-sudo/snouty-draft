/**
 * Tempat ibadah (Kelompok L, laporan pemilik 2026-10-12): "sistem masih nganggep kran itu wastafel,
 * pdhl masjid … ada bbrp kran yang berjejer dan cuma ada 1 pembuangan". Angka harapan dihitung
 * tangan dari tabel IPC dan keputusan pemilik (0,1 l/s per keran wudhu, semua serentak).
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
  it('toilet umum (kloset 5 + keran 1,5) lewat Hunter, keran wudhu ditambah penuh', () => {
    const r = computeSolution(MASJID);
    // 4 × 5 + 4 × 1,5 = 26 WSFU → 21,86 gpm = 1,379 l/s; wudhu 8 × 0,1 = 0,8 l/s.
    expect(r.supply.wsfu).toBe(26);
    expect(r.supply.peakFlowLs).toBeCloseTo(2.179, 3);
    expect(r.traces.some((t) => t.ruleId === 'ENG-701')).toBe(false);
    expect(r.traces.some((t) => t.ruleId === 'ENG-012')).toBe(false);
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining([
        'WSFU_PUBLIC_WATER_CLOSET_5',
        'WSFU_PUBLIC_TAP_1_5',
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
    // 26 + 9 = 35 WSFU → 24,9 gpm = 1,571 l/s; + wudhu 0,8 l/s.
    expect(r.supply.wsfu).toBe(35);
    expect(r.supply.peakFlowLs).toBeCloseTo(2.371, 3);
    expect(r.outletCount).toBe(11);
    const ground = r.branchGroups.flatMap((g) => g.branches).filter((b) => b.floor === 1);
    expect(ground.reduce((n, b) => n + b.urinals, 0)).toBe(3);
    expect(r.appliedAssumptionIds).toContain('WSFU_PUBLIC_URINAL_3');
  });

  it('rumah mengabaikan urinoir', () => {
    const r = computeSolution({ ...MASJID, buildingType: 'residential', urinals: 3 });
    expect(r.appliedAssumptionIds).not.toContain('WSFU_PUBLIC_URINAL_3');
  });

  it('pembuangan: urinoir masuk air kotor (4 DFU), sambungannya 2"', () => {
    const r = computeHouseDrainage({ bathrooms: 4, basins: 0, kitchens: 0, urinals: 3 });
    expect(r.load.soilDfu).toBe(28);
    expect(r.fixtures).toContainEqual({ fixture: 'urinal', count: 3, size: '2"' });
    expect(r.appliedAssumptionIds).toContain('DFU_URINAL_4');
  });
});

describe('sekolah / klinik (pemilik 2026-10-12: "pakai hitungan toilet umum")', () => {
  it('toilet umum yang sama, tanpa wudhu walau keran wudhu terisi', () => {
    const r = computeSolution({ ...MASJID, buildingType: 'public_building', urinals: 3 });
    expect(r.supply.wsfu).toBe(35);
    // Hanya Hunter: 24,9 gpm = 1,571 l/s, tanpa tambahan keran wudhu.
    expect(r.supply.peakFlowLs).toBeCloseTo(1.571, 3);
    expect(r.wudhu).toBeNull();
    expect(r.appliedAssumptionIds).toEqual(
      expect.arrayContaining(['WSFU_PUBLIC_WATER_CLOSET_5', 'WORSHIP_KITCHEN_0']),
    );
    expect(r.appliedAssumptionIds).not.toContain('WUDHU_TAP_FLOW_0_1LS');
    expect(r.traces.some((t) => t.ruleId === 'ENG-012')).toBe(false);
  });
});

describe('computeHouseDrainage · talang wudhu', () => {
  it('satu talang per deret: 0,4 l/s = 6,3 gpm × 2 = 13 DFU → 3"; masuk air bekas', () => {
    const r = computeHouseDrainage({
      bathrooms: 4,
      basins: 0,
      kitchens: 0,
      wudhuRowFlowsLs: [0.4, 0.4],
    });
    expect(r.wudhuTroughs).toEqual([
      { gpm: 6.3, dfu: 13, size: '3"' },
      { gpm: 6.3, dfu: 13, size: '3"' },
    ]);
    // 4 floor drain × 2 + 26 = 34 DFU → 3" (42) pada 2 %.
    expect(r.load.wasteDfu).toBe(34);
    expect(r.waste?.size).toBe('3"');
    expect(r.appliedAssumptionIds).toContain('DFU_CONTINUOUS_2_PER_GPM');
  });
});
