/**
 * Kelompok F — hidraulik bertekanan umum (brief §11–§14, fase 3). docs/ENGINEERING_RULES.md §3.
 *
 * Rumus teknik baku yang terdokumentasi — kontinuitas, Hazen-Williams, head dinamis total,
 * daya hidraulik — dipakai untuk kasus transfer pompa, sumur, cluster, dan gedung. Tidak ada
 * tabel produk, kurva pompa, atau diameter dalam yang dikarang: diameter dalam nominal memakai
 * pendekatan `NOMINAL_SIZES` (ENG-102) yang sama-sama menunggu validasi; pompa hanya
 * dinyatakan sebagai titik kerja Q/H, bukan merek/model.
 *
 * Semua `REQUIRES_DOMAIN_VALIDATION`.
 */

import { localized, requireNumber, type RuleVersion } from '../rule.js';
import { barToHeadM, headMToBar, lsToM3h, round1, round2, round3 } from '../units.js';
import { withWallSdr } from './group-e-irrigation.js';
import { sizeTable, type SizeTableId } from '../parameters/size-tables.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;
const G = 9.81;

// ── ENG-201 · Luas penampang dan kecepatan ──────────────────────────────────

export interface VelocityInput {
  readonly designFlowLs: number;
  readonly innerDiameterMm: number;
}
export interface VelocityResult {
  readonly areaMm2: number;
  readonly velocityMs: number;
}

export function velocityOf(designFlowLs: number, innerDiameterMm: number): VelocityResult {
  const radiusM = innerDiameterMm / 2000;
  const areaM2 = Math.PI * radiusM * radiusM;
  return { areaMm2: round1(areaM2 * 1e6), velocityMs: round2(designFlowLs / 1000 / areaM2) };
}

export const ENG_201: RuleVersion<VelocityInput, VelocityResult> = {
  ruleId: 'ENG-201',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      designFlowLs: requireNumber('ENG-201', 'designFlowLs', o['designFlowLs'], {
        min: 0.01,
        max: 5_000,
      }),
      innerDiameterMm: requireNumber('ENG-201', 'innerDiameterMm', o['innerDiameterMm'], {
        min: 5,
        max: 2_000,
      }),
    };
  },
  compute: (input) => velocityOf(input.designFlowLs, input.innerDiameterMm),
  sourceReference: 'Kontinuitas: A = πD²/4, V = Q/A',
  validationStatus: PENDING,
  testCases: [
    {
      name: '5 l/s dalam 50 mm → 2,55 m/s',
      input: { designFlowLs: 5, innerDiameterMm: 50 },
      expected: { areaMm2: 1963.5, velocityMs: 2.55 },
    },
    {
      name: '1,5 l/s dalam 40 mm → 1,19 m/s',
      input: { designFlowLs: 1.5, innerDiameterMm: 40 },
      expected: { areaMm2: 1256.6, velocityMs: 1.19 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Kecepatan ${output.velocityMs} m/s = ${round2(input.designFlowLs)} l/s ÷ luas penampang ${output.areaMm2} mm² (diameter dalam ${input.innerDiameterMm} mm).`,
      en: `Velocity ${output.velocityMs} m/s = ${round2(input.designFlowLs)} l/s ÷ cross-sectional area ${output.areaMm2} mm² (inner diameter ${input.innerDiameterMm} mm).`,
    }),
};

// ── ENG-202 · Kerugian gesek Hazen-Williams ─────────────────────────────────

export interface FrictionInput {
  readonly designFlowLs: number;
  readonly innerDiameterMm: number;
  readonly lengthM: number;
  readonly hazenWilliamsC: number;
}
export interface FrictionResult {
  readonly frictionLossM: number;
  readonly gradientMPer100m: number;
}

export function frictionLossOf(
  designFlowLs: number,
  innerDiameterMm: number,
  lengthM: number,
  hazenWilliamsC: number,
): FrictionResult {
  const q = designFlowLs / 1000;
  const d = innerDiameterMm / 1000;
  const loss =
    (10.67 * lengthM * Math.pow(q, 1.852)) /
    (Math.pow(hazenWilliamsC, 1.852) * Math.pow(d, 4.8704));
  return { frictionLossM: round2(loss), gradientMPer100m: round2((loss / lengthM) * 100) };
}

export const ENG_202: RuleVersion<FrictionInput, FrictionResult> = {
  ruleId: 'ENG-202',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      designFlowLs: requireNumber('ENG-202', 'designFlowLs', o['designFlowLs'], {
        min: 0.01,
        max: 5_000,
      }),
      innerDiameterMm: requireNumber('ENG-202', 'innerDiameterMm', o['innerDiameterMm'], {
        min: 5,
        max: 2_000,
      }),
      lengthM: requireNumber('ENG-202', 'lengthM', o['lengthM'], { min: 0.1, max: 100_000 }),
      hazenWilliamsC: requireNumber('ENG-202', 'hazenWilliamsC', o['hazenWilliamsC'], {
        min: 60,
        max: 160,
      }),
    };
  },
  compute: (input) =>
    frictionLossOf(input.designFlowLs, input.innerDiameterMm, input.lengthM, input.hazenWilliamsC),
  sourceReference: 'Hazen-Williams (SI): hf = 10,67 · L · Q^1,852 / (C^1,852 · D^4,8704)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '5 l/s, 50 mm, 100 m, C 150',
      input: { designFlowLs: 5, innerDiameterMm: 50, lengthM: 100, hazenWilliamsC: 150 },
      expected: { frictionLossM: 11.83, gradientMPer100m: 11.83 },
    },
    {
      name: '5 l/s, 65 mm, 800 m, C 150',
      input: { designFlowLs: 5, innerDiameterMm: 65, lengthM: 800, hazenWilliamsC: 150 },
      expected: { frictionLossM: 26.38, gradientMPer100m: 3.3 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Air kehilangan tekanan ${output.frictionLossM} m sepanjang ${input.lengthM} m pipa (diameter dalam ${input.innerDiameterMm} mm, ${round2(input.designFlowLs)} l/s) — sekitar ${output.gradientMPer100m} m tiap 100 m pipa.`,
      en: `The water loses ${output.frictionLossM} m of pressure along ${input.lengthM} m of pipe (inner diameter ${input.innerDiameterMm} mm, ${round2(input.designFlowLs)} l/s) — about ${output.gradientMPer100m} m per 100 m of pipe.`,
    }),
};

// ── ENG-203 · Kerugian minor ────────────────────────────────────────────────

export interface MinorLossInput {
  readonly frictionLossM: number;
  /** Fraksi dari kerugian gesek bila daftar fitting tidak diketahui. */
  readonly fraction: number;
}
export interface MinorLossResult {
  readonly minorLossM: number;
}

export const ENG_203: RuleVersion<MinorLossInput, MinorLossResult> = {
  ruleId: 'ENG-203',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      frictionLossM: requireNumber('ENG-203', 'frictionLossM', o['frictionLossM'], {
        min: 0,
        max: 10_000,
      }),
      fraction: requireNumber('ENG-203', 'fraction', o['fraction'], { min: 0, max: 1 }),
    };
  },
  compute: (input) => ({ minorLossM: round2(input.frictionLossM * input.fraction) }),
  sourceReference:
    'Pendekatan kerugian minor sebagai fraksi kerugian gesek bila fitting belum diketahui',
  validationStatus: PENDING,
  testCases: [
    {
      name: '10 % dari 26,38 m',
      input: { frictionLossM: 26.38, fraction: 0.1 },
      expected: { minorLossM: 2.64 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Belokan, sambungan, dan katup menambah kehilangan tekanan sekitar ${output.minorLossM} m — diperkirakan ${Math.round(input.fraction * 100)} % dari kehilangan di pipa lurus, karena jumlah fittingnya belum diketahui.`,
      en: `Bends, joints, and valves add about ${output.minorLossM} m of pressure loss — estimated at ${Math.round(input.fraction * 100)} % of the loss in the straight pipe, since the number of fittings is not known yet.`,
    }),
};

// ── ENG-204 · Head dinamis total ────────────────────────────────────────────

export interface TdhInput {
  readonly staticHeadM: number;
  readonly frictionLossM: number;
  readonly minorLossM: number;
  readonly residualPressureBar: number;
}
export interface TdhResult {
  readonly residualHeadM: number;
  readonly totalDynamicHeadM: number;
}

export function tdhOf(input: TdhInput): TdhResult {
  const residualHeadM = round2(barToHeadM(input.residualPressureBar));
  return {
    residualHeadM,
    totalDynamicHeadM: round2(
      Math.max(0, input.staticHeadM) + input.frictionLossM + input.minorLossM + residualHeadM,
    ),
  };
}

export const ENG_204: RuleVersion<TdhInput, TdhResult> = {
  ruleId: 'ENG-204',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      staticHeadM: requireNumber('ENG-204', 'staticHeadM', o['staticHeadM'], {
        min: -1_000,
        max: 1_000,
      }),
      frictionLossM: requireNumber('ENG-204', 'frictionLossM', o['frictionLossM'], {
        min: 0,
        max: 10_000,
      }),
      minorLossM: requireNumber('ENG-204', 'minorLossM', o['minorLossM'], { min: 0, max: 10_000 }),
      residualPressureBar: requireNumber(
        'ENG-204',
        'residualPressureBar',
        o['residualPressureBar'],
        { min: 0, max: 25 },
      ),
    };
  },
  compute: tdhOf,
  sourceReference:
    'TDH = tinggi statis + kerugian gesek + kerugian minor + tekanan sisa (1 bar ≈ 10,2 m)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '12 m statis + 26,38 + 2,64 + 0,5 bar',
      input: { staticHeadM: 12, frictionLossM: 26.38, minorLossM: 2.64, residualPressureBar: 0.5 },
      expected: { residualHeadM: 5.1, totalDynamicHeadM: 46.12 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Tinggi angkat total ${output.totalDynamicHeadM} m = beda tinggi ${Math.max(0, input.staticHeadM)} m + kehilangan di pipa ${input.frictionLossM} m + di sambungan ${input.minorLossM} m + sisa tekanan di ujung ${output.residualHeadM} m (${input.residualPressureBar} bar).`,
      en: `Total lift ${output.totalDynamicHeadM} m = height difference ${Math.max(0, input.staticHeadM)} m + loss in the pipe ${input.frictionLossM} m + in the fittings ${input.minorLossM} m + pressure left at the end ${output.residualHeadM} m (${input.residualPressureBar} bar).`,
    }),
};

// ── ENG-205 · Sizing pipa multi-kriteria dengan kandidat ────────────────────

export interface SizingInput {
  readonly designFlowLs: number;
  readonly lengthM: number;
  readonly staticHeadM: number;
  readonly residualPressureBar: number;
  readonly hazenWilliamsC: number;
  readonly velocityMinMs: number;
  readonly velocityMaxMs: number;
  readonly gradientMaxMPer100m: number;
  readonly minorLossFraction: number;
  /** Tabel ukuran kandidat: inci (PVC) atau mm (HDPE). */
  readonly sizeTable: SizeTableId;
  /** SDR untuk memperkirakan tebal dinding (diameter dalam = OD − 2·OD/SDR). */
  readonly wallSdr: number;
}
export type CandidateStatus = 'ok' | 'too_fast' | 'too_slow' | 'high_loss';
export interface SizeCandidate {
  readonly size: string;
  readonly innerDiameterMm: number;
  readonly velocityMs: number;
  readonly frictionLossM: number;
  readonly gradientMPer100m: number;
  readonly totalDynamicHeadM: number;
  readonly status: CandidateStatus;
}
export interface SizingResult {
  readonly candidates: readonly SizeCandidate[];
  /** Ukuran terkecil yang memenuhi semua kriteria (atau yang paling mendekati bila tak ada). */
  readonly recommended: string;
  /** Satu ukuran di atasnya bila ada: kerugian lebih rendah, biaya pipa lebih tinggi. */
  readonly alternative: string | null;
  readonly allCriteriaMet: boolean;
}

/** Hasil kandidat kasus uji ENG-205 (5 l/s, 800 m, statis 12 m, C 150, sisa 0,5 bar, SDR 26,5) — dari probe; diameter dalam diperiksa ulang di spec dengan hitungan acuan. */
const PROBE_CANDIDATES: readonly SizeCandidate[] = [
  {
    size: '1/2"',
    innerDiameterMm: 20.3,
    velocityMs: 15.45,
    frictionLossM: 7634.79,
    gradientMPer100m: 954.35,
    totalDynamicHeadM: 8415.37,
    status: 'too_fast',
  },
  {
    size: '3/4"',
    innerDiameterMm: 24,
    velocityMs: 11.05,
    frictionLossM: 3377.89,
    gradientMPer100m: 422.24,
    totalDynamicHeadM: 3732.78,
    status: 'too_fast',
  },
  {
    size: '1"',
    innerDiameterMm: 29.6,
    velocityMs: 7.27,
    frictionLossM: 1216.32,
    gradientMPer100m: 152.04,
    totalDynamicHeadM: 1355.05,
    status: 'too_fast',
  },
  {
    size: '1¼"',
    innerDiameterMm: 38.8,
    velocityMs: 4.23,
    frictionLossM: 325.52,
    gradientMPer100m: 40.69,
    totalDynamicHeadM: 375.17,
    status: 'too_fast',
  },
  {
    size: '1½"',
    innerDiameterMm: 44.4,
    velocityMs: 3.23,
    frictionLossM: 168.82,
    gradientMPer100m: 21.1,
    totalDynamicHeadM: 202.8,
    status: 'too_fast',
  },
  {
    size: '2"',
    innerDiameterMm: 55.5,
    velocityMs: 2.07,
    frictionLossM: 56.94,
    gradientMPer100m: 7.12,
    totalDynamicHeadM: 79.73,
    status: 'too_fast',
  },
  {
    size: '2½"',
    innerDiameterMm: 70.3,
    velocityMs: 1.29,
    frictionLossM: 18.01,
    gradientMPer100m: 2.25,
    totalDynamicHeadM: 36.91,
    status: 'ok',
  },
  {
    size: '3"',
    innerDiameterMm: 82.3,
    velocityMs: 0.94,
    frictionLossM: 8.36,
    gradientMPer100m: 1.04,
    totalDynamicHeadM: 26.3,
    status: 'ok',
  },
  {
    size: '4"',
    innerDiameterMm: 105.4,
    velocityMs: 0.57,
    frictionLossM: 2.5,
    gradientMPer100m: 0.31,
    totalDynamicHeadM: 19.85,
    status: 'too_slow',
  },
  {
    size: '6"',
    innerDiameterMm: 152.5,
    velocityMs: 0.27,
    frictionLossM: 0.41,
    gradientMPer100m: 0.05,
    totalDynamicHeadM: 17.55,
    status: 'too_slow',
  },
];

export const ENG_205: RuleVersion<SizingInput, SizingResult> = {
  ruleId: 'ENG-205',
  version: 3,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const n = (field: string, min: number, max: number) =>
      requireNumber('ENG-205', field, o[field], { min, max });
    return {
      designFlowLs: n('designFlowLs', 0.01, 5_000),
      lengthM: n('lengthM', 0.1, 100_000),
      staticHeadM: n('staticHeadM', -1_000, 1_000),
      residualPressureBar: n('residualPressureBar', 0, 25),
      hazenWilliamsC: n('hazenWilliamsC', 60, 160),
      velocityMinMs: n('velocityMinMs', 0, 3),
      velocityMaxMs: n('velocityMaxMs', 0.5, 5),
      gradientMaxMPer100m: n('gradientMaxMPer100m', 0.1, 100),
      minorLossFraction: n('minorLossFraction', 0, 1),
      ...withWallSdr('ENG-205', o),
    };
  },
  compute: (input) => {
    const candidates: SizeCandidate[] = sizeTable(input.sizeTable, input.wallSdr).map(
      ({ size, innerMm }) => {
        const v = velocityOf(input.designFlowLs, innerMm);
        const f = frictionLossOf(input.designFlowLs, innerMm, input.lengthM, input.hazenWilliamsC);
        const minor = round2(f.frictionLossM * input.minorLossFraction);
        const tdh = tdhOf({
          staticHeadM: input.staticHeadM,
          frictionLossM: f.frictionLossM,
          minorLossM: minor,
          residualPressureBar: input.residualPressureBar,
        });
        const status: CandidateStatus =
          v.velocityMs > input.velocityMaxMs
            ? 'too_fast'
            : f.gradientMPer100m > input.gradientMaxMPer100m
              ? 'high_loss'
              : v.velocityMs < input.velocityMinMs
                ? 'too_slow'
                : 'ok';
        return {
          size,
          innerDiameterMm: innerMm,
          velocityMs: v.velocityMs,
          frictionLossM: f.frictionLossM,
          gradientMPer100m: f.gradientMPer100m,
          totalDynamicHeadM: tdh.totalDynamicHeadM,
          status,
        };
      },
    );
    const okIndex = candidates.findIndex((c) => c.status === 'ok');
    if (okIndex >= 0) {
      const next = candidates[okIndex + 1];
      return {
        candidates,
        recommended: candidates[okIndex]!.size,
        alternative: next && next.status !== 'too_slow' ? next.size : null,
        allCriteriaMet: true,
      };
    }
    // Tidak ada yang memenuhi semua: ambil yang tidak terlalu cepat dan tidak terlalu rugi
    // (ukuran terkecil yang lolos dua kriteria itu), lalu yang terbesar sebagai cadangan.
    const nearest =
      candidates.find((c) => c.status === 'too_slow') ?? candidates[candidates.length - 1]!;
    return { candidates, recommended: nearest.size, alternative: null, allCriteriaMet: false };
  },
  sourceReference:
    'Kriteria ganda: kecepatan dalam batas, gradien kerugian ≤ batas; kandidat dari tabel diameter nominal ENG-102',
  validationStatus: PENDING,
  testCases: [
    {
      name: '5 l/s, 800 m, statis 12 m → kandidat 2½" (2,25 m/100 m, 1,29 m/s) dengan alternatif 3"',
      input: {
        designFlowLs: 5,
        lengthM: 800,
        staticHeadM: 12,
        residualPressureBar: 0.5,
        hazenWilliamsC: 150,
        velocityMinMs: 0.6,
        velocityMaxMs: 2,
        gradientMaxMPer100m: 10,
        minorLossFraction: 0.1,
        sizeTable: 'pvc_inch',
        wallSdr: 26.5,
      },
      expected: {
        candidates: PROBE_CANDIDATES,
        recommended: '2½"',
        alternative: '3"',
        allCriteriaMet: true,
      },
    },
  ],
  explain: (input, output, locale) => {
    const pick = output.candidates.find((c) => c.size === output.recommended)!;
    return localized(locale, {
      id: `Dicoba ${output.candidates.length} ukuran; ${output.recommended} yang terkecil dengan kecepatan air ${input.velocityMinMs}–${input.velocityMaxMs} m/s dan kehilangan tekanan paling banyak ${input.gradientMaxMPer100m} m tiap 100 m pipa. Di ukuran ini air mengalir ${pick.velocityMs} m/s dan kehilangan ${pick.frictionLossM} m sepanjang ${input.lengthM} m${output.alternative ? `; ${output.alternative} satu ukuran di atasnya lebih hemat tekanan, tetapi pipanya lebih mahal` : ''}.`,
      en: `${output.candidates.length} sizes were tried; ${output.recommended} is the smallest with a water speed of ${input.velocityMinMs}–${input.velocityMaxMs} m/s and a pressure loss of at most ${input.gradientMaxMPer100m} m per 100 m of pipe. At this size the water flows at ${pick.velocityMs} m/s and loses ${pick.frictionLossM} m over ${input.lengthM} m${output.alternative ? `; ${output.alternative}, one size up, saves pressure but the pipe costs more` : ''}.`,
    });
  },
};

// ── ENG-206 · Titik kerja pompa ─────────────────────────────────────────────
//
// Tiga daya yang sering tertukar (audit C3):
//   daya hidraulik  P_h = ρ·g·Q·H          — energi yang benar-benar diterima air;
//   daya poros      P_s = P_h ÷ η_pompa     — yang harus diberikan ke poros pompa;
//   daya masuk motor     = P_s ÷ η_motor    — tidak dihitung: efisiensi motor dan cadangan daya
//                                             datang dari pabrikan, bukan dari aturan ini.

export interface PumpDutyInput {
  readonly designFlowLs: number;
  readonly totalDynamicHeadM: number;
  /** Efisiensi pompa (hidraulik → poros), 0–1. Bukan efisiensi motor, bukan pemilihan pompa. */
  readonly efficiency: number;
}
export interface PumpDutyResult {
  readonly flowM3h: number;
  /** Head pompa (m kolom air) = tinggi angkat total ENG-204. */
  readonly headM: number;
  /** Beda tekanan sisi isap–tekan yang setara dengan head itu. */
  readonly differentialPressureBar: number;
  readonly hydraulicPowerKw: number;
  /** Daya poros pompa = daya hidraulik ÷ efisiensi pompa. */
  readonly indicativeShaftPowerKw: number;
}

export const ENG_206: RuleVersion<PumpDutyInput, PumpDutyResult> = {
  ruleId: 'ENG-206',
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      designFlowLs: requireNumber('ENG-206', 'designFlowLs', o['designFlowLs'], {
        min: 0.01,
        max: 5_000,
      }),
      totalDynamicHeadM: requireNumber('ENG-206', 'totalDynamicHeadM', o['totalDynamicHeadM'], {
        min: 0.1,
        max: 2_000,
      }),
      efficiency: requireNumber('ENG-206', 'efficiency', o['efficiency'], { min: 0.2, max: 0.95 }),
    };
  },
  compute: (input) => {
    const hydraulicKw = G * (input.designFlowLs / 1000) * input.totalDynamicHeadM; // ρ=1000 → kW
    return {
      flowM3h: round2(lsToM3h(input.designFlowLs)),
      headM: round2(input.totalDynamicHeadM),
      differentialPressureBar: round2(headMToBar(input.totalDynamicHeadM)),
      hydraulicPowerKw: round3(hydraulicKw),
      indicativeShaftPowerKw: round2(hydraulicKw / input.efficiency),
    };
  },
  sourceReference:
    'Daya hidraulik P = ρ·g·Q·H; daya poros = P ÷ η pompa (η indikatif, tanpa kurva pompa); daya masuk motor tidak dihitung',
  validationStatus: PENDING,
  testCases: [
    {
      name: '5 l/s pada 25,21 m, η pompa 0,6',
      input: { designFlowLs: 5, totalDynamicHeadM: 25.21, efficiency: 0.6 },
      expected: {
        flowM3h: 18,
        headM: 25.21,
        differentialPressureBar: 2.47,
        hydraulicPowerKw: 1.237,
        indicativeShaftPowerKw: 2.06,
      },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Pompa yang dicari: ${output.flowM3h} m³/jam (${round2(input.designFlowLs)} l/s) dengan tinggi angkat ${output.headM} m (beda tekanan sekitar ${output.differentialPressureBar} bar). Air menerima ${output.hydraulicPowerKw} kW; dengan efisiensi pompa ${Math.round(input.efficiency * 100)} % porosnya butuh sekitar ${output.indicativeShaftPowerKw} kW. Daya motor lebih besar lagi dan ditentukan dari data pabrikan, begitu juga pilihan pompanya.`,
      en: `The pump to look for: ${output.flowM3h} m³/h (${round2(input.designFlowLs)} l/s) with a lift of ${output.headM} m (a pressure difference of about ${output.differentialPressureBar} bar). The water receives ${output.hydraulicPowerKw} kW; at ${Math.round(input.efficiency * 100)} % pump efficiency the shaft needs about ${output.indicativeShaftPowerKw} kW. The motor rating is higher still and comes from the manufacturer, as does the pump choice.`,
    }),
};

export const GROUP_F = [ENG_201, ENG_202, ENG_203, ENG_204, ENG_205, ENG_206] as const;
