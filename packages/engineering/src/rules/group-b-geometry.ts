/**
 * Kelompok B — geometri dan elevasi. docs/ENGINEERING_RULES.md §3.
 *
 * ENG-008 adalah **murni heuristik gambar**: sistem tidak tahu denah sebenarnya,
 * jadi semua node yang dihasilkan bertanda `ASSUMED`. ENG-011 ("toren atap pada hunian cukup tanpa
 * pompa pendorong") dihapus 2026-10-12: tekanan dari toren kini dihitung (ENG-703).
 */

import { localized, requireInt, requireNumber, type RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

/** ENG-004 · Tinggi antar lantai default, bila pengguna tidak memberi nilai. */
export const ENG_004: RuleVersion<Record<string, never>, { readonly floorHeightM: number }> = {
  ruleId: 'ENG-004',
  version: 1,
  category: 'geometry',
  parseInput: () => ({}),
  compute: () => ({ floorHeightM: 3.5 }),
  sourceReference:
    'Kedua prototipe; tampil di judul skema sebagai "TINGGI LANTAI · 3,50 M · ASUMSI"',
  validationStatus: PENDING,
  testCases: [{ name: 'default 3,5 meter', input: {}, expected: { floorHeightM: 3.5 } }],
  explain: (_input, output, locale) =>
    localized(locale, {
      id: `Tinggi antar lantai diasumsikan ${output.floorHeightM} meter.`,
      en: `Floor-to-floor height is assumed to be ${output.floorHeightM} meters.`,
    }),
};

export interface FloorPlanInput {
  readonly floors: number;
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
  readonly floorHeightM: number;
}

export interface FloorNode {
  readonly floor: number;
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
  /** Meter dari lantai dasar. */
  readonly elevationM: number;
}

export interface FloorPlanResult {
  readonly floorsPlan: readonly FloorNode[];
}

/**
 * ENG-008 · Distribusi titik air antar lantai.
 *
 * Batas 3 lantai pada prototipe **tidak** dibawa: itu keterbatasan rendering, bukan
 * aturan teknik (OQ-33).
 *
 * Pembagian sisa jatuh ke lantai teratas (`ceil` di lantai teratas, `floor` di bawah)
 * mengikuti prototipe. Itu pilihan gambar, bukan temuan teknik — dan karena itulah
 * seluruh keluarannya asumsi.
 */
/**
 * Bagi `total` ke `floors` lantai sama rata; sisanya satu-satu mulai dari lantai teratas
 * (`'top'`) atau dari lantai 1 (`'bottom'`). Jumlahnya selalu sama dengan `total` — inilah yang
 * dilanggar v1 (laporan SNTY-2026-10-0015: 1 wastafel di 2 lantai menjadi 2).
 * Hasil urut dari lantai teratas, sama dengan `floorsPlan`.
 */
export function distributeAcrossFloors(
  total: number,
  floors: number,
  remainderTo: 'top' | 'bottom',
): readonly number[] {
  const base = Math.floor(total / floors);
  const remainder = total - base * floors;
  return Array.from({ length: floors }, (_, k) => {
    // k = 0 adalah lantai teratas.
    const fromTop = remainderTo === 'top' ? k : floors - 1 - k;
    return base + (fromTop < remainder ? 1 : 0);
  });
}

export const ENG_008: RuleVersion<FloorPlanInput, FloorPlanResult> = {
  ruleId: 'ENG-008',
  // v2 (2026-10-13, laporan SNTY-2026-10-0015): jumlah per lantai selalu sama dengan masukan —
  // v1 memberi setiap lantai minimal 1 wastafel dan membulatkan per lantai. Sisa kamar mandi ke
  // lantai teratas, sisa wastafel ke lantai 1, dapur di lantai 1 (keputusan pemilik 2026-10-13).
  version: 2,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      floors: requireInt('ENG-008', 'floors', o['floors'], { min: 1, max: 50 }),
      bathrooms: requireInt('ENG-008', 'bathrooms', o['bathrooms'], { max: 200 }),
      basins: requireInt('ENG-008', 'basins', o['basins'], { max: 200 }),
      kitchens: requireInt('ENG-008', 'kitchens', o['kitchens'], { max: 100 }),
      floorHeightM: requireNumber('ENG-008', 'floorHeightM', o['floorHeightM'], {
        min: 2,
        max: 10,
      }),
    };
  },
  compute: (input) => {
    const bathrooms = distributeAcrossFloors(input.bathrooms, input.floors, 'top');
    const basins = distributeAcrossFloors(input.basins, input.floors, 'bottom');
    const plan: FloorNode[] = bathrooms.map((count, k) => {
      const floor = input.floors - k;
      return {
        floor,
        bathrooms: count,
        basins: basins[k]!,
        kitchens: floor === 1 ? input.kitchens : 0,
        elevationM: (floor - 1) * input.floorHeightM,
      };
    });
    return { floorsPlan: plan };
  },
  sourceReference:
    'Sebaran perkiraan tanpa denah: dibagi rata per lantai; sisa kamar mandi ke lantai teratas, sisa wastafel ke lantai 1, dapur di lantai 1 (keputusan pemilik 2026-10-13)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'contoh board: 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur',
      input: { floors: 2, bathrooms: 3, basins: 4, kitchens: 1, floorHeightM: 3.5 },
      expected: {
        floorsPlan: [
          { floor: 2, bathrooms: 2, basins: 2, kitchens: 0, elevationM: 3.5 },
          { floor: 1, bathrooms: 1, basins: 2, kitchens: 1, elevationM: 0 },
        ],
      },
    },
    {
      name: 'laporan 0015: 2 lantai, 2 kamar mandi, 1 wastafel, 1 dapur → wastafel tetap satu, di lantai 1',
      input: { floors: 2, bathrooms: 2, basins: 1, kitchens: 1, floorHeightM: 3.5 },
      expected: {
        floorsPlan: [
          { floor: 2, bathrooms: 1, basins: 0, kitchens: 0, elevationM: 3.5 },
          { floor: 1, bathrooms: 1, basins: 1, kitchens: 1, elevationM: 0 },
        ],
      },
    },
    {
      name: '3 lantai, 5 kamar mandi, 4 wastafel → 2/2/1 kamar mandi dari atas, 1/1/2 wastafel',
      input: { floors: 3, bathrooms: 5, basins: 4, kitchens: 1, floorHeightM: 3.5 },
      expected: {
        floorsPlan: [
          { floor: 3, bathrooms: 2, basins: 1, kitchens: 0, elevationM: 7 },
          { floor: 2, bathrooms: 2, basins: 1, kitchens: 0, elevationM: 3.5 },
          { floor: 1, bathrooms: 1, basins: 2, kitchens: 1, elevationM: 0 },
        ],
      },
    },
    {
      name: 'satu lantai: semuanya di lantai dasar, elevasi nol',
      input: { floors: 1, bathrooms: 2, basins: 1, kitchens: 1, floorHeightM: 3.5 },
      expected: {
        floorsPlan: [{ floor: 1, bathrooms: 2, basins: 1, kitchens: 1, elevationM: 0 }],
      },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id:
        `Titik air disebar ke ${input.floors} lantai karena denahnya belum ada: ${output.floorsPlan
          .map(
            (f) =>
              `lantai ${f.floor} ${f.bathrooms} kamar mandi, ${f.basins} wastafel${f.kitchens > 0 ? `, ${f.kitchens} dapur` : ''}`,
          )
          .join('; ')} (sisa kamar mandi di lantai atas, sisa wastafel di lantai 1). ` +
        `Lantai teratas berada pada ${output.floorsPlan[0]?.elevationM ?? 0} meter dari lantai dasar.`,
      en:
        `Water outlets are spread over ${input.floors} floors because the floor plan is not available yet: ${output.floorsPlan
          .map(
            (f) =>
              `floor ${f.floor} ${f.bathrooms} bathrooms, ${f.basins} basins${f.kitchens > 0 ? `, ${f.kitchens} kitchens` : ''}`,
          )
          .join('; ')} (extra bathrooms on the upper floor, extra basins on floor 1). ` +
        `The top floor is ${output.floorsPlan[0]?.elevationM ?? 0} meters above the ground floor.`,
    }),
};

export const GROUP_B = [ENG_004, ENG_008];
