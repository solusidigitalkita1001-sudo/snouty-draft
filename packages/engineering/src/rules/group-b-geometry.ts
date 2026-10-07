/**
 * Kelompok B — geometri dan elevasi. docs/ENGINEERING_RULES.md §3.
 *
 * ENG-008 adalah **murni heuristik gambar**: sistem tidak tahu denah sebenarnya,
 * jadi semua node yang dihasilkan bertanda `ASSUMED`. ENG-011 adalah klaim teknik
 * yang cukup berani untuk dibuat tanpa mengetahui tinggi toren maupun panjang jalur,
 * dan termasuk yang paling perlu ditinjau ahli.
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
export const ENG_008: RuleVersion<FloorPlanInput, FloorPlanResult> = {
  ruleId: 'ENG-008',
  version: 1,
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
    const plan: FloorNode[] = [];
    for (let floor = input.floors; floor >= 1; floor -= 1) {
      const isTop = floor === input.floors;
      plan.push({
        floor,
        bathrooms: isTop
          ? Math.ceil(input.bathrooms / input.floors)
          : Math.floor(input.bathrooms / input.floors),
        basins: input.basins > 0 ? Math.max(1, Math.round(input.basins / input.floors)) : 0,
        // Dapur selalu di lantai 1 (prototipe).
        kitchens: floor === 1 ? input.kitchens : 0,
        elevationM: (floor - 1) * input.floorHeightM,
      });
    }
    return { floorsPlan: plan };
  },
  sourceReference: 'Prototipe baru SNOUTY; heuristik gambar, bukan denah sebenarnya',
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
        `Titik air disebar ke ${input.floors} lantai sebagai perkiraan gambar — sistem tidak mengetahui denah ` +
        `sebenarnya. Lantai teratas berada pada ${output.floorsPlan[0]?.elevationM ?? 0} meter dari lantai dasar.`,
      en:
        `Water outlets are spread over ${input.floors} floors as a drawing estimate — the system does not know the actual ` +
        `floor plan. The top floor is ${output.floorsPlan[0]?.elevationM ?? 0} meters above the ground floor.`,
    }),
};

export interface BoosterInput {
  readonly buildingType: 'residential' | 'boarding_house' | 'light_commercial' | 'industrial';
  readonly waterSource: 'rooftop_tank' | 'ground_tank' | 'pump' | 'municipal';
}

/**
 * ENG-011 · Kecukupan gravitasi toren atap.
 *
 * Asal: kalimat prototipe "tekanan gravitasi umumnya cukup tanpa pompa pendorong".
 * Tanpa tinggi toren dan panjang jalur, ini klaim yang berani; ia dipertahankan apa
 * adanya karena desain menyampaikannya kepada pengguna, tetapi keluarannya selalu
 * asumsi sampai ahli menilainya.
 */
export const ENG_011: RuleVersion<BoosterInput, { readonly boosterPumpNeeded: boolean }> = {
  ruleId: 'ENG-011',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const buildingType = o['buildingType'];
    const waterSource = o['waterSource'];
    const buildings = ['residential', 'boarding_house', 'light_commercial', 'industrial'];
    const sources = ['rooftop_tank', 'ground_tank', 'pump', 'municipal'];
    if (typeof buildingType !== 'string' || !buildings.includes(buildingType)) {
      throw new Error(`ENG-011: buildingType tidak dikenal: ${String(buildingType)}`);
    }
    if (typeof waterSource !== 'string' || !sources.includes(waterSource)) {
      throw new Error(`ENG-011: waterSource tidak dikenal: ${String(waterSource)}`);
    }
    return {
      buildingType: buildingType as BoosterInput['buildingType'],
      waterSource: waterSource as BoosterInput['waterSource'],
    };
  },
  compute: (input) => {
    const gravityFed =
      input.waterSource === 'rooftop_tank' &&
      (input.buildingType === 'residential' || input.buildingType === 'light_commercial');
    return { boosterPumpNeeded: !gravityFed };
  },
  sourceReference: 'Prototipe: "tekanan gravitasi umumnya cukup tanpa pompa pendorong"',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'hunian dengan toren atap: tanpa pompa pendorong',
      input: { buildingType: 'residential', waterSource: 'rooftop_tank' },
      expected: { boosterPumpNeeded: false },
    },
    {
      name: 'toren bawah: pompa pendorong diperlukan',
      input: { buildingType: 'residential', waterSource: 'ground_tank' },
      expected: { boosterPumpNeeded: true },
    },
    {
      name: 'industri walau toren atap: tidak mengandalkan gravitasi',
      input: { buildingType: 'industrial', waterSource: 'rooftop_tank' },
      expected: { boosterPumpNeeded: true },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: output.boosterPumpNeeded
        ? `Dengan sumber ${input.waterSource === 'ground_tank' ? 'toren bawah' : input.waterSource}, distribusi diperkirakan memerlukan pompa pendorong.`
        : 'Dengan toren di atap, tekanan gravitasi umumnya cukup tanpa pompa pendorong.',
      en: output.boosterPumpNeeded
        ? `With a ${WATER_SOURCE_EN[input.waterSource]} source, distribution is expected to need a booster pump.`
        : 'With a rooftop tank, gravity pressure is generally sufficient without a booster pump.',
    }),
};

const WATER_SOURCE_EN: Readonly<Record<BoosterInput['waterSource'], string>> = {
  rooftop_tank: 'rooftop tank',
  ground_tank: 'ground tank',
  pump: 'pump',
  municipal: 'mains water',
};

export const GROUP_B = [ENG_004, ENG_008, ENG_011];
