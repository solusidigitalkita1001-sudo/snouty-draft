/**
 * Kelompok I — air bersih gedung bertingkat (keputusan pemilik 2026-10-09: gedung > 4 lantai
 * tetap dihitung, bukan berhenti di "perlu dihitung tim teknis").
 *
 * Metode buku acuan plambing Indonesia (Noerbambang & Morimura): kebutuhan harian dari jumlah
 * penghuni, pemakaian rata-rata per jam dari jam pemakaian, debit jam puncak dan menit puncak dari
 * faktornya; zona tekanan dari batas tekanan statik. Nilai yang tidak diberikan pengguna datang
 * dari registry asumsi. Semua `REQUIRES_DOMAIN_VALIDATION`.
 */

import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';
import { barToHeadM, headMToBar, m3hToLs, round1, round2 } from '../units.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

// ── ENG-501 · Penghuni dari luas lantai ─────────────────────────────────────

export interface OccupantsInput {
  readonly floorAreaM2: number;
  readonly floors: number;
  readonly areaPerPersonM2: number;
}

export const ENG_501: RuleVersion<OccupantsInput, { readonly occupants: number }> = {
  ruleId: 'ENG-501',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      floorAreaM2: requireNumber('ENG-501', 'floorAreaM2', o['floorAreaM2'], {
        min: 10,
        max: 1_000_000,
      }),
      floors: requireInt('ENG-501', 'floors', o['floors'], { min: 1, max: 200 }),
      areaPerPersonM2: requireNumber('ENG-501', 'areaPerPersonM2', o['areaPerPersonM2'], {
        min: 1,
        max: 100,
      }),
    };
  },
  compute: (input) => ({
    occupants: Math.ceil((input.floorAreaM2 * input.floors) / input.areaPerPersonM2),
  }),
  sourceReference: 'Penghuni = luas lantai × jumlah lantai ÷ luas per orang',
  validationStatus: PENDING,
  testCases: [
    {
      name: '3 000 m² × 12 lantai ÷ 10 m²/orang → 3 600 orang',
      input: { floorAreaM2: 3000, floors: 12, areaPerPersonM2: 10 },
      expected: { occupants: 3600 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Penghuni diperkirakan ${output.occupants} orang = ${input.floorAreaM2} m² × ${input.floors} lantai ÷ ${input.areaPerPersonM2} m² per orang.`,
      en: `Occupancy is estimated at ${output.occupants} people = ${input.floorAreaM2} m² × ${input.floors} floors ÷ ${input.areaPerPersonM2} m² per person.`,
    }),
};

// ── ENG-502 · Kebutuhan air gedung ──────────────────────────────────────────

export interface BuildingDemandInput {
  readonly occupants: number;
  readonly litresPerPersonPerDay: number;
  readonly usageHours: number;
  readonly peakHourFactor: number;
  readonly peakMinuteFactor: number;
}
export interface BuildingDemandResult {
  readonly dailyM3: number;
  readonly averageHourM3h: number;
  /** Debit jam puncak — dasar pompa transfer ke tangki atap. Presisi penuh (audit C2). */
  readonly peakHourLs: number;
  /** Debit menit puncak — dasar riser distribusi dari tangki atap. Presisi penuh. */
  readonly peakMinuteLs: number;
}

export const ENG_502: RuleVersion<BuildingDemandInput, BuildingDemandResult> = {
  ruleId: 'ENG-502',
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      occupants: requireInt('ENG-502', 'occupants', o['occupants'], { min: 1, max: 1_000_000 }),
      litresPerPersonPerDay: requireNumber(
        'ENG-502',
        'litresPerPersonPerDay',
        o['litresPerPersonPerDay'],
        { min: 10, max: 1000 },
      ),
      usageHours: requireNumber('ENG-502', 'usageHours', o['usageHours'], { min: 1, max: 24 }),
      peakHourFactor: requireNumber('ENG-502', 'peakHourFactor', o['peakHourFactor'], {
        min: 1,
        max: 5,
      }),
      peakMinuteFactor: requireNumber('ENG-502', 'peakMinuteFactor', o['peakMinuteFactor'], {
        min: 1,
        max: 10,
      }),
    };
  },
  compute: (input) => {
    const daily = (input.occupants * input.litresPerPersonPerDay) / 1000;
    const hourly = daily / input.usageHours;
    return {
      dailyM3: round1(daily),
      averageHourM3h: round2(hourly),
      // Debit tidak dibulatkan: nilai ini masuk ke pompa, riser, dan tangki. Membulatkannya di
      // sini membuat 300 m³/jam kembali sebagai 299,99 m³/jam (audit C2).
      peakHourLs: m3hToLs(input.peakHourFactor * hourly),
      peakMinuteLs: m3hToLs(input.peakMinuteFactor * hourly),
    };
  },
  sourceReference:
    'Qd = penghuni × l/orang/hari (m³/hari); Qh = Qd ÷ jam pemakaian (m³/jam); Qh-maks = c1 × Qh; Qm-maks = c2 × Qh ÷ 60 (m³/menit); keduanya dinyatakan dalam l/s (1 m³/jam = 1/3,6 l/s)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '3 600 orang × 150 l, 10 jam, c1 2, c2 3',
      input: {
        occupants: 3600,
        litresPerPersonPerDay: 150,
        usageHours: 10,
        peakHourFactor: 2,
        peakMinuteFactor: 3,
      },
      expected: { dailyM3: 540, averageHourM3h: 54, peakHourLs: 30, peakMinuteLs: 45 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Kebutuhan harian ${output.dailyM3} m³ = ${input.occupants} orang × ${input.litresPerPersonPerDay} l; dipakai ${input.usageHours} jam → rata-rata ${output.averageHourM3h} m³/jam. Jam puncak (× ${input.peakHourFactor}) ${round2(output.peakHourLs)} l/s, menit puncak (× ${input.peakMinuteFactor}) ${round2(output.peakMinuteLs)} l/s.`,
      en: `Daily demand ${output.dailyM3} m³ = ${input.occupants} people × ${input.litresPerPersonPerDay} l; used over ${input.usageHours} hours → average ${output.averageHourM3h} m³/h. Peak hour (× ${input.peakHourFactor}) ${round2(output.peakHourLs)} l/s, peak minute (× ${input.peakMinuteFactor}) ${round2(output.peakMinuteLs)} l/s.`,
    }),
};

// ── ENG-503 · Zona tekanan dan booster ──────────────────────────────────────
//
// Zona dari geometri, bukan dari ambang saja (audit C4). Muka air tangki atap dianggap setinggi
// pelat atap (lantai × tinggi lantai di atas lantai dasar); titik air di lantai ke-k berada di
// elevasi (k − 1) × tinggi lantai. Tekanan statik lantai k = (tinggi gedung − elevasinya) dalam bar.
// Dari atas ke bawah:
//   - lantai yang tekanannya di bawah tekanan sisa minimum → pompa booster;
//   - lantai berikutnya selama tekanannya ≤ batas maksimum → langsung dari tangki atap (gravitasi);
//   - sisanya dibagi zona berkatup penurun tekanan; katup disetel supaya lantai teratas zonanya
//     mendapat tekanan sisa minimum, lalu tekanan naik satu tinggi lantai per lantai ke bawah
//     sampai batas maksimum.

export interface ZoningInput {
  readonly floors: number;
  readonly floorHeightM: number;
  readonly maxZoneBar: number;
  readonly residualBar: number;
}
export type PressureZoneKind = 'booster' | 'gravity' | 'reduced';
export interface PressureZone {
  readonly kind: PressureZoneKind;
  /** Lantai teratas dan terbawah zona (1 = lantai dasar). */
  readonly topFloor: number;
  readonly bottomFloor: number;
  readonly topElevationM: number;
  readonly bottomElevationM: number;
  /** Tekanan di lantai teratas/terbawah zona; untuk `booster` = tekanan dari tangki tanpa pompa. */
  readonly topPressureBar: number;
  readonly bottomPressureBar: number;
}
export interface ZoningResult {
  readonly buildingHeightM: number;
  /** Zona gravitasi + zona berkatup penurun tekanan (zona booster dihitung di `boosterFloors`). */
  readonly zones: number;
  /** Zona di bawah zona gravitasi — masing-masing butuh katup penurun tekanan. */
  readonly reducedZones: number;
  /** Lantai teratas yang tekanan statiknya dari tangki atap kurang dari tekanan sisa. */
  readonly boosterFloors: number;
  /** Tekanan statik di kaki riser (lantai dasar) — yang ditahan pipa riser bila tanpa katup. */
  readonly riserBaseStaticBar: number;
  readonly zoneTable: readonly PressureZone[];
}

export function pressureZones(input: ZoningInput): ZoningResult {
  const height = input.floors * input.floorHeightM;
  const elevation = (floor: number) => (floor - 1) * input.floorHeightM;
  const staticHeadM = (floor: number) => height - elevation(floor);
  const minHeadM = barToHeadM(input.residualBar);
  const maxHeadM = barToHeadM(input.maxZoneBar);
  const zoneTable: PressureZone[] = [];
  const zone = (
    kind: PressureZoneKind,
    top: number,
    bottom: number,
    topHeadM: number,
    bottomHeadM: number,
  ) =>
    zoneTable.push({
      kind,
      topFloor: top,
      bottomFloor: bottom,
      topElevationM: round1(elevation(top)),
      bottomElevationM: round1(elevation(bottom)),
      topPressureBar: round2(headMToBar(topHeadM)),
      bottomPressureBar: round2(headMToBar(bottomHeadM)),
    });

  let floor = input.floors;
  const boosterTop = floor;
  while (floor >= 1 && staticHeadM(floor) < minHeadM) floor -= 1;
  const boosterFloors = boosterTop - floor;
  if (boosterFloors > 0) {
    zone('booster', boosterTop, floor + 1, staticHeadM(boosterTop), staticHeadM(floor + 1));
  }

  const gravityTop = floor;
  while (floor >= 1 && staticHeadM(floor) <= maxHeadM) floor -= 1;
  if (gravityTop > floor) {
    zone('gravity', gravityTop, floor + 1, staticHeadM(gravityTop), staticHeadM(floor + 1));
  }

  // Lantai per zona berkatup: dari tekanan sisa di lantai teratas sampai batas maksimum.
  const floorsPerZone = Math.floor((maxHeadM - minHeadM) / input.floorHeightM) + 1;
  let reducedZones = 0;
  while (floor >= 1) {
    const top = floor;
    const bottom = Math.max(1, top - floorsPerZone + 1);
    zone('reduced', top, bottom, minHeadM, minHeadM + (top - bottom) * input.floorHeightM);
    reducedZones += 1;
    floor = bottom - 1;
  }

  return {
    buildingHeightM: round1(height),
    zones: zoneTable.filter((z) => z.kind !== 'booster').length,
    reducedZones,
    boosterFloors,
    riserBaseStaticBar: round2(headMToBar(height)),
    zoneTable,
  };
}

const floorRange = (z: PressureZone) =>
  z.topFloor === z.bottomFloor ? `${z.topFloor}` : `${z.bottomFloor}–${z.topFloor}`;

export const ENG_503: RuleVersion<ZoningInput, ZoningResult> = {
  ruleId: 'ENG-503',
  version: 2,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const input = {
      floors: requireInt('ENG-503', 'floors', o['floors'], { min: 1, max: 200 }),
      floorHeightM: requireNumber('ENG-503', 'floorHeightM', o['floorHeightM'], {
        min: 2,
        max: 10,
      }),
      maxZoneBar: requireNumber('ENG-503', 'maxZoneBar', o['maxZoneBar'], { min: 1, max: 10 }),
      residualBar: requireNumber('ENG-503', 'residualBar', o['residualBar'], { min: 0, max: 5 }),
    };
    // Tekanan minimum di atas batas maksimum tidak bisa dipenuhi zona mana pun.
    if (input.residualBar >= input.maxZoneBar) {
      throw new RuleInputError(
        'ENG-503',
        `residualBar ${input.residualBar} ≥ maxZoneBar ${input.maxZoneBar}`,
      );
    }
    return input;
  },
  compute: pressureZones,
  sourceReference:
    'Tekanan statik lantai k = (tinggi gedung − elevasi lantai k) ÷ 10,197 m/bar dari muka air tangki atap; booster bila < tekanan sisa minimum, zona berkatup penurun tekanan bila > tekanan statik maksimum per zona',
  validationStatus: PENDING,
  testCases: [
    {
      name: '12 lantai × 3,5 m, zona 4 bar, sisa 1 bar → gravitasi 2–10, katup lantai 1, booster 11–12',
      input: { floors: 12, floorHeightM: 3.5, maxZoneBar: 4, residualBar: 1 },
      expected: {
        buildingHeightM: 42,
        zones: 2,
        reducedZones: 1,
        boosterFloors: 2,
        riserBaseStaticBar: 4.12,
        zoneTable: [
          {
            kind: 'booster',
            topFloor: 12,
            bottomFloor: 11,
            topElevationM: 38.5,
            bottomElevationM: 35,
            topPressureBar: 0.34,
            bottomPressureBar: 0.69,
          },
          {
            kind: 'gravity',
            topFloor: 10,
            bottomFloor: 2,
            topElevationM: 31.5,
            bottomElevationM: 3.5,
            topPressureBar: 1.03,
            bottomPressureBar: 3.78,
          },
          {
            kind: 'reduced',
            topFloor: 1,
            bottomFloor: 1,
            topElevationM: 0,
            bottomElevationM: 0,
            topPressureBar: 1,
            bottomPressureBar: 1,
          },
        ],
      },
    },
  ],
  explain: (input, output, locale) => {
    const id: string[] = [
      `Tinggi gedung ${output.buildingHeightM} m (${input.floors} × ${input.floorHeightM} m); muka air tangki atap dianggap setinggi atap.`,
    ];
    const en: string[] = [
      `Building height ${output.buildingHeightM} m (${input.floors} × ${input.floorHeightM} m); the roof tank water level is taken as roof level.`,
    ];
    for (const z of output.zoneTable) {
      if (z.kind === 'booster') {
        id.push(
          `Lantai ${floorRange(z)} hanya mendapat ${z.topPressureBar}–${z.bottomPressureBar} bar dari tangki atap, di bawah ${input.residualBar} bar, jadi butuh pompa booster.`,
        );
        en.push(
          `Floor(s) ${floorRange(z)} only get ${z.topPressureBar}–${z.bottomPressureBar} bar from the roof tank, below ${input.residualBar} bar, so they need a booster pump.`,
        );
      } else if (z.kind === 'gravity') {
        id.push(
          `Lantai ${floorRange(z)} dilayani langsung dari tangki atap dengan tekanan ${z.topPressureBar}–${z.bottomPressureBar} bar.`,
        );
        en.push(
          `Floor(s) ${floorRange(z)} are fed straight from the roof tank at ${z.topPressureBar}–${z.bottomPressureBar} bar.`,
        );
      } else {
        id.push(
          `Lantai ${floorRange(z)} lewat katup penurun tekanan: ${z.topPressureBar} bar di lantai teratasnya sampai ${z.bottomPressureBar} bar di lantai terbawahnya.`,
        );
        en.push(
          `Floor(s) ${floorRange(z)} go through a pressure-reducing valve: ${z.topPressureBar} bar on the top floor down to ${z.bottomPressureBar} bar on the lowest.`,
        );
      }
    }
    id.push(
      `Batas tekanan per zona ${input.maxZoneBar} bar; kaki riser di lantai dasar menahan tekanan statik ${output.riserBaseStaticBar} bar.`,
    );
    en.push(
      `Pressure limit per zone ${input.maxZoneBar} bar; the riser base at ground level holds a static pressure of ${output.riserBaseStaticBar} bar.`,
    );
    return localized(locale, { id: id.join(' '), en: en.join(' ') });
  },
};

// ── ENG-504 · Pembagian riser ───────────────────────────────────────────────

export interface RiserSplitInput {
  readonly peakFlowLs: number;
  readonly risers: number;
}

export const ENG_504: RuleVersion<RiserSplitInput, { readonly flowPerRiserLs: number }> = {
  ruleId: 'ENG-504',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      peakFlowLs: requireNumber('ENG-504', 'peakFlowLs', o['peakFlowLs'], {
        min: 0.01,
        max: 10_000,
      }),
      risers: requireInt('ENG-504', 'risers', o['risers'], { min: 1, max: 50 }),
    };
  },
  compute: (input) => ({ flowPerRiserLs: round2(input.peakFlowLs / input.risers) }),
  sourceReference: 'Debit per riser = debit menit puncak ÷ jumlah riser',
  validationStatus: PENDING,
  testCases: [
    {
      name: '45 l/s ÷ 3 riser',
      input: { peakFlowLs: 45, risers: 3 },
      expected: { flowPerRiserLs: 15 },
    },
  ],
  explain: (input, output, locale) =>
    input.risers === 1
      ? localized(locale, {
          id: `Satu riser distribusi membawa debit menit puncak ${round2(input.peakFlowLs)} l/s.`,
          en: `One distribution riser carries the peak-minute flow of ${round2(input.peakFlowLs)} l/s.`,
        })
      : localized(locale, {
          id: `Debit menit puncak ${round2(input.peakFlowLs)} l/s terlalu besar untuk satu riser, jadi dibagi ${input.risers} riser → ${output.flowPerRiserLs} l/s per riser.`,
          en: `The peak-minute flow of ${round2(input.peakFlowLs)} l/s is too large for one riser, so it is split across ${input.risers} risers → ${output.flowPerRiserLs} l/s each.`,
        }),
};

// ── ENG-505 · Pipa induk tiap lantai ────────────────────────────────────────

export interface FloorHeaderInput {
  readonly peakMinuteLs: number;
  readonly floors: number;
  /** Luas satu lantai; 0 = tidak diketahui → `defaultLengthM`. */
  readonly floorAreaM2: number;
  readonly defaultLengthM: number;
}
export interface FloorHeaderResult {
  readonly flowPerFloorLs: number;
  readonly headerLengthM: number;
}

export const ENG_505: RuleVersion<FloorHeaderInput, FloorHeaderResult> = {
  ruleId: 'ENG-505',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      peakMinuteLs: requireNumber('ENG-505', 'peakMinuteLs', o['peakMinuteLs'], {
        min: 0.01,
        max: 10_000,
      }),
      floors: requireInt('ENG-505', 'floors', o['floors'], { min: 1, max: 200 }),
      floorAreaM2: requireNumber('ENG-505', 'floorAreaM2', o['floorAreaM2'], {
        min: 0,
        max: 1_000_000,
      }),
      defaultLengthM: requireNumber('ENG-505', 'defaultLengthM', o['defaultLengthM'], {
        min: 1,
        max: 1000,
      }),
    };
  },
  compute: (input) => ({
    flowPerFloorLs: round2(input.peakMinuteLs / input.floors),
    headerLengthM:
      input.floorAreaM2 > 0 ? round1(Math.sqrt(input.floorAreaM2)) : input.defaultLengthM,
  }),
  sourceReference:
    'Debit per lantai = debit menit puncak ÷ jumlah lantai (titik air sama tiap lantai); panjang induk lantai = sisi denah persegi (√luas)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '45 l/s, 12 lantai, 3 000 m² → 3,75 l/s, 54,8 m',
      input: { peakMinuteLs: 45, floors: 12, floorAreaM2: 3000, defaultLengthM: 20 },
      expected: { flowPerFloorLs: 3.75, headerLengthM: 54.8 },
    },
    {
      name: 'luas tidak diketahui → panjang asumsi',
      input: { peakMinuteLs: 10, floors: 20, floorAreaM2: 0, defaultLengthM: 20 },
      expected: { flowPerFloorLs: 0.5, headerLengthM: 20 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Tiap lantai menerima ${output.flowPerFloorLs} l/s (${round2(input.peakMinuteLs)} l/s ÷ ${input.floors} lantai) lewat pipa induk lantai sepanjang ${output.headerLengthM} m${input.floorAreaM2 > 0 ? ` (sisi denah ${input.floorAreaM2} m²)` : ''}.`,
      en: `Each floor receives ${output.flowPerFloorLs} l/s (${round2(input.peakMinuteLs)} l/s ÷ ${input.floors} floors) through a floor header ${output.headerLengthM} m long${input.floorAreaM2 > 0 ? ` (side of a ${input.floorAreaM2} m² plan)` : ''}.`,
    }),
};

// ── ENG-506 · Volume tangki bawah dan tangki atap ───────────────────────────
//
// Tangki atap (Noerbambang & Morimura): VE = (Qp − Qpu) · Tp + Qpu · Tpu.
//   (Qp − Qpu) · Tp  — kekurangan selama periode puncak, saat pemakaian melebihi pompa pengisi;
//   Qpu · Tpu        — cadangan supaya pompa pengisi tidak hidup-mati terlalu sering.
// Tangki bawah menampung kebutuhan sekian hari TANPA mengurangi pasokan PDAM/sumur selama hari itu:
// kontinuitas pasokan belum diketahui, jadi volume ini batas atas yang aman, bukan kebutuhan pasti.
// Keduanya volume efektif (yang bisa dipakai), belum termasuk ruang bebas dan endapan di dasar.

export interface TankInput {
  readonly dailyM3: number;
  readonly peakMinuteLs: number;
  /** Debit pompa pengisi tangki atap (pompa transfer). */
  readonly pumpFlowLs: number;
  readonly peakDurationMin: number;
  /** Lama pompa pengisi bekerja per siklus. */
  readonly pumpCycleMin: number;
  readonly groundTankDays: number;
}
export interface TankResult {
  readonly groundTankM3: number;
  /** Bagian tangki atap untuk kekurangan saat puncak. */
  readonly roofPeakDeficitM3: number;
  /** Bagian tangki atap untuk siklus pompa. */
  readonly roofPumpCycleM3: number;
  readonly roofTankM3: number;
}

export const ENG_506: RuleVersion<TankInput, TankResult> = {
  ruleId: 'ENG-506',
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      dailyM3: requireNumber('ENG-506', 'dailyM3', o['dailyM3'], { min: 0.1, max: 1_000_000 }),
      peakMinuteLs: requireNumber('ENG-506', 'peakMinuteLs', o['peakMinuteLs'], {
        min: 0.01,
        max: 10_000,
      }),
      pumpFlowLs: requireNumber('ENG-506', 'pumpFlowLs', o['pumpFlowLs'], {
        min: 0.01,
        max: 10_000,
      }),
      peakDurationMin: requireNumber('ENG-506', 'peakDurationMin', o['peakDurationMin'], {
        min: 1,
        max: 240,
      }),
      pumpCycleMin: requireNumber('ENG-506', 'pumpCycleMin', o['pumpCycleMin'], {
        min: 0,
        max: 120,
      }),
      groundTankDays: requireNumber('ENG-506', 'groundTankDays', o['groundTankDays'], {
        min: 0.1,
        max: 7,
      }),
    };
  },
  compute: (input) => {
    const litresToM3 = (ls: number, minutes: number) => (ls * minutes * 60) / 1000;
    const deficit = litresToM3(
      Math.max(0, input.peakMinuteLs - input.pumpFlowLs),
      input.peakDurationMin,
    );
    const cycle = litresToM3(input.pumpFlowLs, input.pumpCycleMin);
    return {
      groundTankM3: round1(input.dailyM3 * input.groundTankDays),
      roofPeakDeficitM3: round1(deficit),
      roofPumpCycleM3: round1(cycle),
      roofTankM3: round1(deficit + cycle),
    };
  },
  sourceReference:
    'Tangki bawah = kebutuhan harian × hari cadangan (pasokan selama hari itu tidak dikurangkan); tangki atap VE = (Qp − Qpu) · Tp + Qpu · Tpu (Noerbambang & Morimura); volume efektif',
  validationStatus: PENDING,
  testCases: [
    {
      name: '540 m³/hari, puncak 45 l/s, pompa 30 l/s, 30 menit, siklus 10 menit, 1 hari',
      input: {
        dailyM3: 540,
        peakMinuteLs: 45,
        pumpFlowLs: 30,
        peakDurationMin: 30,
        pumpCycleMin: 10,
        groundTankDays: 1,
      },
      expected: {
        groundTankM3: 540,
        roofPeakDeficitM3: 27,
        roofPumpCycleM3: 18,
        roofTankM3: 45,
      },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Tangki bawah ${output.groundTankM3} m³ menampung kebutuhan ${input.groundTankDays} hari (${input.dailyM3} m³/hari) tanpa menghitung pasokan PDAM atau sumur selama hari itu. Tangki atap ${output.roofTankM3} m³ terdiri dari ${output.roofPeakDeficitM3} m³ untuk ${input.peakDurationMin} menit tersibuk, saat air dipakai ${round2(input.peakMinuteLs)} l/s sementara pompa mengisi ${round2(input.pumpFlowLs)} l/s, ditambah ${output.roofPumpCycleM3} m³ supaya pompa bekerja minimal ${input.pumpCycleMin} menit sekali hidup. Keduanya volume efektif, belum termasuk ruang kosong di atas dan endapan di dasar tangki.`,
      en: `The ground tank of ${output.groundTankM3} m³ holds ${input.groundTankDays} day(s) of demand (${input.dailyM3} m³/day) without counting mains or well supply during that day. The roof tank of ${output.roofTankM3} m³ is ${output.roofPeakDeficitM3} m³ for the busiest ${input.peakDurationMin} minutes, when water is used at ${round2(input.peakMinuteLs)} l/s while the pump supplies ${round2(input.pumpFlowLs)} l/s, plus ${output.roofPumpCycleM3} m³ so the pump runs at least ${input.pumpCycleMin} minutes each time it starts. Both are usable volumes, excluding freeboard and the sediment zone at the bottom.`,
    }),
};

export const GROUP_I = [ENG_501, ENG_502, ENG_503, ENG_504, ENG_505, ENG_506] as const;
