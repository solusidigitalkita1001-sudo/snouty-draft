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

import { requireNumber, type RuleVersion } from '../rule.js';
import { barToHeadM, lsToM3h, round1, round2, round3 } from '../units.js';
import { requireSizeTable } from './group-e-irrigation.js';
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
  explain: (input, output) =>
    `Kecepatan ${output.velocityMs} m/s = ${input.designFlowLs} l/s ÷ luas penampang ${output.areaMm2} mm² (diameter dalam ${input.innerDiameterMm} mm).`,
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
  explain: (input, output) =>
    `Kerugian gesek ${output.frictionLossM} m untuk ${input.lengthM} m pipa Ø${input.innerDiameterMm} mm pada ${input.designFlowLs} l/s (Hazen-Williams, C = ${input.hazenWilliamsC}; ${output.gradientMPer100m} m per 100 m).`,
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
  explain: (input, output) =>
    `Kerugian di fitting ±${output.minorLossM} m (${Math.round(input.fraction * 100)} % dari kerugian gesek).`,
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
  explain: (input, output) =>
    `Head total ${output.totalDynamicHeadM} m = statis ${Math.max(0, input.staticHeadM)} m + gesek ${input.frictionLossM} m + fitting ${input.minorLossM} m + sisa ${output.residualHeadM} m (${input.residualPressureBar} bar).`,
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

/** Hasil kandidat kasus uji ENG-205 (5 l/s, 800 m, statis 12 m, C 150, sisa 0,5 bar) — dari probe. */
const PROBE_CANDIDATES: readonly SizeCandidate[] = [
  {
    size: '1/2"',
    innerDiameterMm: 15,
    velocityMs: 28.29,
    frictionLossM: 33326.6,
    gradientMPer100m: 4165.82,
    totalDynamicHeadM: 36676.36,
    status: 'too_fast',
  },
  {
    size: '3/4"',
    innerDiameterMm: 20,
    velocityMs: 15.92,
    frictionLossM: 8208.98,
    gradientMPer100m: 1026.12,
    totalDynamicHeadM: 9046.98,
    status: 'too_fast',
  },
  {
    size: '1"',
    innerDiameterMm: 25,
    velocityMs: 10.19,
    frictionLossM: 2768.85,
    gradientMPer100m: 346.11,
    totalDynamicHeadM: 3062.84,
    status: 'too_fast',
  },
  {
    size: '1¼"',
    innerDiameterMm: 32,
    velocityMs: 6.22,
    frictionLossM: 832.04,
    gradientMPer100m: 104,
    totalDynamicHeadM: 932.34,
    status: 'too_fast',
  },
  {
    size: '1½"',
    innerDiameterMm: 40,
    velocityMs: 3.98,
    frictionLossM: 280.64,
    gradientMPer100m: 35.08,
    totalDynamicHeadM: 325.8,
    status: 'too_fast',
  },
  {
    size: '2"',
    innerDiameterMm: 50,
    velocityMs: 2.55,
    frictionLossM: 94.66,
    gradientMPer100m: 11.83,
    totalDynamicHeadM: 121.23,
    status: 'too_fast',
  },
  {
    size: '2½"',
    innerDiameterMm: 65,
    velocityMs: 1.51,
    frictionLossM: 26.38,
    gradientMPer100m: 3.3,
    totalDynamicHeadM: 46.12,
    status: 'ok',
  },
  {
    size: '3"',
    innerDiameterMm: 80,
    velocityMs: 0.99,
    frictionLossM: 9.59,
    gradientMPer100m: 1.2,
    totalDynamicHeadM: 27.65,
    status: 'ok',
  },
  {
    size: '4"',
    innerDiameterMm: 100,
    velocityMs: 0.64,
    frictionLossM: 3.24,
    gradientMPer100m: 0.4,
    totalDynamicHeadM: 20.66,
    status: 'ok',
  },
  {
    size: '6"',
    innerDiameterMm: 150,
    velocityMs: 0.28,
    frictionLossM: 0.45,
    gradientMPer100m: 0.06,
    totalDynamicHeadM: 17.6,
    status: 'too_slow',
  },
];

export const ENG_205: RuleVersion<SizingInput, SizingResult> = {
  ruleId: 'ENG-205',
  version: 2,
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
      sizeTable: requireSizeTable('ENG-205', o['sizeTable']),
    };
  },
  compute: (input) => {
    const candidates: SizeCandidate[] = sizeTable(input.sizeTable).map(({ size, innerMm }) => {
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
    });
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
      name: '5 l/s, 800 m, statis 12 m → kandidat 2½" (3,3 m/100 m, 1,51 m/s) dengan alternatif 3"',
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
      },
      expected: {
        candidates: PROBE_CANDIDATES,
        recommended: '2½"',
        alternative: '3"',
        allCriteriaMet: true,
      },
    },
  ],
  explain: (input, output) => {
    const pick = output.candidates.find((c) => c.size === output.recommended)!;
    return `Dari ${output.candidates.length} kandidat, ${output.recommended} adalah ukuran terkecil yang memenuhi kecepatan ${input.velocityMinMs}–${input.velocityMaxMs} m/s dan gradien ≤ ${input.gradientMaxMPer100m} m/100 m: ${pick.velocityMs} m/s, kerugian ${pick.frictionLossM} m untuk ${input.lengthM} m${output.alternative ? `; alternatif ${output.alternative} menurunkan kerugian dengan biaya pipa lebih tinggi` : ''}.`;
  },
};

// ── ENG-206 · Titik kerja pompa ─────────────────────────────────────────────

export interface PumpDutyInput {
  readonly designFlowLs: number;
  readonly totalDynamicHeadM: number;
  /** Efisiensi keseluruhan indikatif (0–1) untuk daya poros; bukan pemilihan pompa. */
  readonly efficiency: number;
}
export interface PumpDutyResult {
  readonly flowM3h: number;
  readonly headM: number;
  readonly hydraulicPowerKw: number;
  readonly indicativeShaftPowerKw: number;
}

export const ENG_206: RuleVersion<PumpDutyInput, PumpDutyResult> = {
  ruleId: 'ENG-206',
  version: 1,
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
      hydraulicPowerKw: round3(hydraulicKw),
      indicativeShaftPowerKw: round2(hydraulicKw / input.efficiency),
    };
  },
  sourceReference:
    'Daya hidraulik P = ρ·g·Q·H; daya poros = P / η (η indikatif, tanpa kurva pompa)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '5 l/s pada 25,21 m, η 0,6',
      input: { designFlowLs: 5, totalDynamicHeadM: 25.21, efficiency: 0.6 },
      expected: {
        flowM3h: 18,
        headM: 25.21,
        hydraulicPowerKw: 1.237,
        indicativeShaftPowerKw: 2.06,
      },
    },
  ],
  explain: (input, output) =>
    `Titik kerja pompa: ${output.flowM3h} m³/jam (${input.designFlowLs} l/s) pada head ${output.headM} m; daya hidraulik ${output.hydraulicPowerKw} kW, daya poros indikatif ±${output.indicativeShaftPowerKw} kW pada efisiensi ${Math.round(input.efficiency * 100)} % — pilih pompa dari kurva pabrikan, bukan dari angka ini saja.`,
};

export const GROUP_F = [ENG_201, ENG_202, ENG_203, ENG_204, ENG_205, ENG_206] as const;
