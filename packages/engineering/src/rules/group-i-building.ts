/**
 * Kelompok I — air bersih gedung bertingkat (keputusan pemilik 2026-10-09: gedung > 4 lantai
 * tetap dihitung, bukan berhenti di "perlu dihitung tim teknis").
 *
 * Metode buku acuan plambing Indonesia (Noerbambang & Morimura): kebutuhan harian dari jumlah
 * penghuni, pemakaian rata-rata per jam dari jam pemakaian, debit jam puncak dan menit puncak dari
 * faktornya; zona tekanan dari batas tekanan statik. Nilai yang tidak diberikan pengguna datang
 * dari registry asumsi. Semua `REQUIRES_DOMAIN_VALIDATION`.
 */

import { localized, requireInt, requireNumber, type RuleVersion } from '../rule.js';
import { barToHeadM, round1, round2 } from '../units.js';

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
  /** Debit jam puncak — dasar pompa transfer ke tangki atap. */
  readonly peakHourLs: number;
  /** Debit menit puncak — dasar riser distribusi dari tangki atap. */
  readonly peakMinuteLs: number;
}

export const ENG_502: RuleVersion<BuildingDemandInput, BuildingDemandResult> = {
  ruleId: 'ENG-502',
  version: 1,
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
      peakHourLs: round2((input.peakHourFactor * hourly) / 3.6),
      peakMinuteLs: round2((input.peakMinuteFactor * hourly) / 3.6),
    };
  },
  sourceReference:
    'Qd = penghuni × l/orang/hari; Qh = Qd ÷ jam pemakaian; Qh-maks = c1 × Qh; Qm-maks = c2 × Qh ÷ 60',
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
      id: `Kebutuhan harian ${output.dailyM3} m³ = ${input.occupants} orang × ${input.litresPerPersonPerDay} l; dipakai ${input.usageHours} jam → rata-rata ${output.averageHourM3h} m³/jam. Jam puncak (× ${input.peakHourFactor}) ${output.peakHourLs} l/s, menit puncak (× ${input.peakMinuteFactor}) ${output.peakMinuteLs} l/s.`,
      en: `Daily demand ${output.dailyM3} m³ = ${input.occupants} people × ${input.litresPerPersonPerDay} l; used over ${input.usageHours} hours → average ${output.averageHourM3h} m³/h. Peak hour (× ${input.peakHourFactor}) ${output.peakHourLs} l/s, peak minute (× ${input.peakMinuteFactor}) ${output.peakMinuteLs} l/s.`,
    }),
};

// ── ENG-503 · Zona tekanan dan booster ──────────────────────────────────────

export interface ZoningInput {
  readonly floors: number;
  readonly floorHeightM: number;
  readonly maxZoneBar: number;
  readonly residualBar: number;
}
export interface ZoningResult {
  readonly buildingHeightM: number;
  readonly zones: number;
  /** Zona di bawah zona teratas — masing-masing butuh katup penurun tekanan. */
  readonly reducedZones: number;
  /** Lantai teratas yang tekanan statiknya dari tangki atap kurang dari tekanan sisa. */
  readonly boosterFloors: number;
}

export const ENG_503: RuleVersion<ZoningInput, ZoningResult> = {
  ruleId: 'ENG-503',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      floors: requireInt('ENG-503', 'floors', o['floors'], { min: 1, max: 200 }),
      floorHeightM: requireNumber('ENG-503', 'floorHeightM', o['floorHeightM'], {
        min: 2,
        max: 10,
      }),
      maxZoneBar: requireNumber('ENG-503', 'maxZoneBar', o['maxZoneBar'], { min: 1, max: 10 }),
      residualBar: requireNumber('ENG-503', 'residualBar', o['residualBar'], { min: 0, max: 5 }),
    };
  },
  compute: (input) => {
    const height = input.floors * input.floorHeightM;
    const zones = Math.max(1, Math.ceil(height / barToHeadM(input.maxZoneBar)));
    // Tangki atap di atap; lantai ke-j dari atas punya tinggi statik j × tinggi lantai.
    const booster = Math.min(
      input.floors,
      Math.max(0, Math.ceil(barToHeadM(input.residualBar) / input.floorHeightM) - 1),
    );
    return {
      buildingHeightM: round1(height),
      zones,
      reducedZones: zones - 1,
      boosterFloors: booster,
    };
  },
  sourceReference:
    'Tinggi = lantai × tinggi lantai; zona = ⌈tinggi ÷ head tekanan statik maks⌉; booster bila tinggi statik di bawah tekanan sisa',
  validationStatus: PENDING,
  testCases: [
    {
      name: '12 lantai × 3,5 m, zona 4 bar, sisa 1 bar → 2 zona, 2 lantai booster',
      input: { floors: 12, floorHeightM: 3.5, maxZoneBar: 4, residualBar: 1 },
      expected: { buildingHeightM: 42, zones: 2, reducedZones: 1, boosterFloors: 2 },
    },
    {
      name: '5 lantai → satu zona',
      input: { floors: 5, floorHeightM: 3.5, maxZoneBar: 4, residualBar: 1 },
      expected: { buildingHeightM: 17.5, zones: 1, reducedZones: 0, boosterFloors: 2 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id:
        `Tinggi gedung ${output.buildingHeightM} m (${input.floors} × ${input.floorHeightM} m). Dengan tekanan statik maksimum ${input.maxZoneBar} bar per zona, sistemnya dibagi ${output.zones} zona` +
        (output.reducedZones > 0
          ? `, ${output.reducedZones} zona bawah memakai katup penurun tekanan`
          : '') +
        `. ${output.boosterFloors > 0 ? `${output.boosterFloors} lantai teratas butuh pompa booster karena tekanan dari tangki atap di bawah ${input.residualBar} bar.` : 'Semua lantai mendapat tekanan cukup dari tangki atap.'}`,
      en:
        `Building height ${output.buildingHeightM} m (${input.floors} × ${input.floorHeightM} m). With a maximum static pressure of ${input.maxZoneBar} bar per zone, the system is split into ${output.zones} zone(s)` +
        (output.reducedZones > 0
          ? `, the ${output.reducedZones} lower zone(s) using pressure-reducing valves`
          : '') +
        `. ${output.boosterFloors > 0 ? `The top ${output.boosterFloors} floor(s) need a booster pump because the pressure from the roof tank is below ${input.residualBar} bar.` : 'Every floor gets enough pressure from the roof tank.'}`,
    }),
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
          id: `Satu riser distribusi membawa debit menit puncak ${input.peakFlowLs} l/s.`,
          en: `One distribution riser carries the peak-minute flow of ${input.peakFlowLs} l/s.`,
        })
      : localized(locale, {
          id: `Debit menit puncak ${input.peakFlowLs} l/s terlalu besar untuk satu riser, jadi dibagi ${input.risers} riser → ${output.flowPerRiserLs} l/s per riser.`,
          en: `The peak-minute flow of ${input.peakFlowLs} l/s is too large for one riser, so it is split across ${input.risers} risers → ${output.flowPerRiserLs} l/s each.`,
        }),
};

export const GROUP_I = [ENG_501, ENG_502, ENG_503, ENG_504] as const;
