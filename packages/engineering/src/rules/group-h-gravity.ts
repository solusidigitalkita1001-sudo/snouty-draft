/**
 * Kelompok H — gravitasi, air hujan, gorong-gorong, jaringan cluster (brief §15–§18, fase 4).
 * docs/ENGINEERING_RULES.md §3.
 *
 * Rumus baku: Manning untuk kapasitas pipa penuh, metode rasional untuk debit limpasan, kebutuhan
 * puncak dari jumlah sambungan. Intensitas hujan TIDAK pernah dikarang — ia masukan wajib.
 * Gorong-gorong hanya dihitung hidrauliknya; strukturnya ditandai "perlu validasi".
 * Semua `REQUIRES_DOMAIN_VALIDATION`.
 */

import { requireInt, requireNumber, type RuleVersion } from '../rule.js';
import { round1, round2 } from '../units.js';
import { NOMINAL_SIZES } from './group-e-irrigation.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

/**
 * Ukuran nominal untuk saluran gravitasi: tabel bertekanan (½"–6") ditambah 8"–16" yang lazim
 * untuk drainase dan gorong-gorong. Diameter dalam pendekatan, bukan tabel produk.
 */
export const GRAVITY_SIZES: ReadonlyArray<{ readonly size: string; readonly innerMm: number }> = [
  ...NOMINAL_SIZES,
  { size: '8"', innerMm: 200 },
  { size: '10"', innerMm: 250 },
  { size: '12"', innerMm: 300 },
  { size: '16"', innerMm: 400 },
];

// ── ENG-401 · Kapasitas pipa penuh (Manning) ───────────────────────────────

export interface ManningInput {
  readonly innerDiameterMm: number;
  readonly slopePercent: number;
  readonly manningN: number;
}
export interface ManningResult {
  /** Kapasitas pipa penuh, l/s. */
  readonly fullFlowLs: number;
  /** Kecepatan pada aliran penuh, m/s. */
  readonly fullVelocityMs: number;
}

export function manningFullFlow(input: ManningInput): ManningResult {
  const d = input.innerDiameterMm / 1000;
  const area = (Math.PI * d * d) / 4;
  const radius = d / 4;
  const slope = input.slopePercent / 100;
  const velocity = (1 / input.manningN) * Math.pow(radius, 2 / 3) * Math.sqrt(slope);
  return { fullFlowLs: round2(area * velocity * 1000), fullVelocityMs: round2(velocity) };
}

export const ENG_401: RuleVersion<ManningInput, ManningResult> = {
  ruleId: 'ENG-401',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      innerDiameterMm: requireNumber('ENG-401', 'innerDiameterMm', o['innerDiameterMm'], {
        min: 20,
        max: 3_000,
      }),
      slopePercent: requireNumber('ENG-401', 'slopePercent', o['slopePercent'], {
        min: 0.05,
        max: 50,
      }),
      manningN: requireNumber('ENG-401', 'manningN', o['manningN'], { min: 0.008, max: 0.03 }),
    };
  },
  compute: manningFullFlow,
  sourceReference: 'Manning: V = (1/n) · R^(2/3) · S^(1/2), R = D/4 untuk pipa penuh; Q = V · A',
  validationStatus: PENDING,
  testCases: [
    {
      name: '300 mm, 1 %, n 0,010 → ±126 l/s',
      input: { innerDiameterMm: 300, slopePercent: 1, manningN: 0.01 },
      expected: { fullFlowLs: 125.71, fullVelocityMs: 1.78 },
    },
  ],
  explain: (input, output) =>
    `Pipa Ø${input.innerDiameterMm} mm pada kemiringan ${input.slopePercent} % mengalirkan ±${output.fullFlowLs} l/s saat penuh (${output.fullVelocityMs} m/s; Manning n = ${input.manningN}).`,
};

/** Kandidat kasus uji ENG-402 (20 l/s, 1 %, n 0,010, isi 80 %, v ≥ 0,6) — diisi dari probe. */
const GRAVITY_PROBE: readonly GravityCandidate[] = [
  {
    size: '1/2"',
    innerDiameterMm: 15,
    fullFlowLs: 0.04,
    fullVelocityMs: 0.24,
    utilisationPercent: 50000,
    status: 'too_small',
  },
  {
    size: '3/4"',
    innerDiameterMm: 20,
    fullFlowLs: 0.09,
    fullVelocityMs: 0.29,
    utilisationPercent: 22222.2,
    status: 'too_small',
  },
  {
    size: '1"',
    innerDiameterMm: 25,
    fullFlowLs: 0.17,
    fullVelocityMs: 0.34,
    utilisationPercent: 11764.7,
    status: 'too_small',
  },
  {
    size: '1¼"',
    innerDiameterMm: 32,
    fullFlowLs: 0.32,
    fullVelocityMs: 0.4,
    utilisationPercent: 6250,
    status: 'too_small',
  },
  {
    size: '1½"',
    innerDiameterMm: 40,
    fullFlowLs: 0.58,
    fullVelocityMs: 0.46,
    utilisationPercent: 3448.3,
    status: 'too_small',
  },
  {
    size: '2"',
    innerDiameterMm: 50,
    fullFlowLs: 1.06,
    fullVelocityMs: 0.54,
    utilisationPercent: 1886.8,
    status: 'too_small',
  },
  {
    size: '2½"',
    innerDiameterMm: 65,
    fullFlowLs: 2.13,
    fullVelocityMs: 0.64,
    utilisationPercent: 939,
    status: 'too_small',
  },
  {
    size: '3"',
    innerDiameterMm: 80,
    fullFlowLs: 3.7,
    fullVelocityMs: 0.74,
    utilisationPercent: 540.5,
    status: 'too_small',
  },
  {
    size: '4"',
    innerDiameterMm: 100,
    fullFlowLs: 6.72,
    fullVelocityMs: 0.85,
    utilisationPercent: 297.6,
    status: 'too_small',
  },
  {
    size: '6"',
    innerDiameterMm: 150,
    fullFlowLs: 19.8,
    fullVelocityMs: 1.12,
    utilisationPercent: 101,
    status: 'too_small',
  },
  {
    size: '8"',
    innerDiameterMm: 200,
    fullFlowLs: 42.64,
    fullVelocityMs: 1.36,
    utilisationPercent: 46.9,
    status: 'ok',
  },
  {
    size: '10"',
    innerDiameterMm: 250,
    fullFlowLs: 77.31,
    fullVelocityMs: 1.57,
    utilisationPercent: 25.9,
    status: 'ok',
  },
  {
    size: '12"',
    innerDiameterMm: 300,
    fullFlowLs: 125.71,
    fullVelocityMs: 1.78,
    utilisationPercent: 15.9,
    status: 'ok',
  },
  {
    size: '16"',
    innerDiameterMm: 400,
    fullFlowLs: 270.73,
    fullVelocityMs: 2.15,
    utilisationPercent: 7.4,
    status: 'ok',
  },
];

// ── ENG-402 · Sizing pipa gravitasi ─────────────────────────────────────────

export interface GravitySizingInput {
  readonly designFlowLs: number;
  readonly slopePercent: number;
  readonly manningN: number;
  /** Debit rencana ≤ fillRatio × kapasitas penuh (0–1). */
  readonly fillRatio: number;
  readonly velocityMinMs: number;
}
export interface GravityCandidate {
  readonly size: string;
  readonly innerDiameterMm: number;
  readonly fullFlowLs: number;
  readonly fullVelocityMs: number;
  /** Rasio debit rencana terhadap kapasitas penuh (%). */
  readonly utilisationPercent: number;
  readonly status: 'ok' | 'too_small' | 'too_slow';
}
export interface GravitySizingResult {
  readonly candidates: readonly GravityCandidate[];
  readonly recommended: string;
  readonly innerDiameterMm: number;
  readonly allCriteriaMet: boolean;
}

export const ENG_402: RuleVersion<GravitySizingInput, GravitySizingResult> = {
  ruleId: 'ENG-402',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      designFlowLs: requireNumber('ENG-402', 'designFlowLs', o['designFlowLs'], {
        min: 0.01,
        max: 50_000,
      }),
      slopePercent: requireNumber('ENG-402', 'slopePercent', o['slopePercent'], {
        min: 0.05,
        max: 50,
      }),
      manningN: requireNumber('ENG-402', 'manningN', o['manningN'], { min: 0.008, max: 0.03 }),
      fillRatio: requireNumber('ENG-402', 'fillRatio', o['fillRatio'], { min: 0.3, max: 1 }),
      velocityMinMs: requireNumber('ENG-402', 'velocityMinMs', o['velocityMinMs'], {
        min: 0,
        max: 3,
      }),
    };
  },
  compute: (input) => {
    const candidates: GravityCandidate[] = GRAVITY_SIZES.map(({ size, innerMm }) => {
      const full = manningFullFlow({
        innerDiameterMm: innerMm,
        slopePercent: input.slopePercent,
        manningN: input.manningN,
      });
      const utilisation = round1((input.designFlowLs / full.fullFlowLs) * 100);
      const status: GravityCandidate['status'] =
        utilisation > input.fillRatio * 100
          ? 'too_small'
          : full.fullVelocityMs < input.velocityMinMs
            ? 'too_slow'
            : 'ok';
      return { size, innerDiameterMm: innerMm, ...full, utilisationPercent: utilisation, status };
    });
    const ok = candidates.find((c) => c.status === 'ok');
    const pick =
      ok ?? candidates.find((c) => c.status === 'too_slow') ?? candidates[candidates.length - 1]!;
    return {
      candidates,
      recommended: pick.size,
      innerDiameterMm: pick.innerDiameterMm,
      allCriteriaMet: ok !== undefined,
    };
  },
  sourceReference:
    'Ukuran nominal terkecil dengan debit rencana ≤ rasio pengisian × kapasitas Manning penuh dan kecepatan ≥ batas pembersihan diri',
  validationStatus: PENDING,
  testCases: [
    {
      name: '20 l/s, 1 %, isi 80 % → 8" (±43 l/s penuh)',
      input: {
        designFlowLs: 20,
        slopePercent: 1,
        manningN: 0.01,
        fillRatio: 0.8,
        velocityMinMs: 0.6,
      },
      expected: {
        candidates: GRAVITY_PROBE,
        recommended: '8"',
        innerDiameterMm: 200,
        allCriteriaMet: true,
      },
    },
  ],
  explain: (input, output) => {
    const pick = output.candidates.find((c) => c.size === output.recommended)!;
    return `Pipa gravitasi ${output.recommended}: kapasitas penuh ${pick.fullFlowLs} l/s pada ${input.slopePercent} %, debit rencana ${input.designFlowLs} l/s = ${pick.utilisationPercent} % (batas ${Math.round(input.fillRatio * 100)} %); kecepatan penuh ${pick.fullVelocityMs} m/s.`;
  },
};

// ── ENG-403 · Debit limpasan hujan (metode rasional) ────────────────────────

export interface RationalInput {
  readonly catchmentHa: number;
  readonly rainfallMmPerHour: number;
  readonly runoffCoefficient: number;
}
export interface RationalResult {
  readonly designFlowLs: number;
}

export const ENG_403: RuleVersion<RationalInput, RationalResult> = {
  ruleId: 'ENG-403',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      catchmentHa: requireNumber('ENG-403', 'catchmentHa', o['catchmentHa'], {
        min: 0.01,
        max: 10_000,
      }),
      rainfallMmPerHour: requireNumber('ENG-403', 'rainfallMmPerHour', o['rainfallMmPerHour'], {
        min: 1,
        max: 500,
      }),
      runoffCoefficient: requireNumber('ENG-403', 'runoffCoefficient', o['runoffCoefficient'], {
        min: 0.05,
        max: 1,
      }),
    };
  },
  // Q (m³/s) = 0,278 · C · I (mm/jam) · A (km²)  →  l/s dengan A dalam ha: 2,78 · C · I · A
  compute: (input) => ({
    designFlowLs: round2(
      2.78 * input.runoffCoefficient * input.rainfallMmPerHour * input.catchmentHa,
    ),
  }),
  sourceReference:
    'Metode rasional Q = 0,278 · C · I · A (A km², I mm/jam) — I dari data hujan setempat, bukan dikarang',
  validationStatus: PENDING,
  testCases: [
    {
      name: '0,5 ha, 100 mm/jam, C 0,6 → 83,4 l/s',
      input: { catchmentHa: 0.5, rainfallMmPerHour: 100, runoffCoefficient: 0.6 },
      expected: { designFlowLs: 83.4 },
    },
  ],
  explain: (input, output) =>
    `Debit limpasan ${output.designFlowLs} l/s = 2,78 × C ${input.runoffCoefficient} × hujan ${input.rainfallMmPerHour} mm/jam × ${input.catchmentHa} ha (metode rasional).`,
};

// ── ENG-404 · Gorong-gorong: penanda struktural awal ────────────────────────

export interface CulvertStructuralInput {
  readonly innerDiameterMm: number;
  readonly coverDepthM: number;
  readonly trafficLoad: 'light' | 'car' | 'heavy';
}
export interface CulvertStructuralResult {
  readonly minimumCoverM: number;
  readonly coverAdequate: boolean;
  readonly structuralNote: string;
}

export const ENG_404: RuleVersion<CulvertStructuralInput, CulvertStructuralResult> = {
  ruleId: 'ENG-404',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const load = o['trafficLoad'];
    if (load !== 'light' && load !== 'car' && load !== 'heavy') {
      throw new Error(`masukan tidak sah untuk ENG-404: trafficLoad ${String(load)}`);
    }
    return {
      innerDiameterMm: requireNumber('ENG-404', 'innerDiameterMm', o['innerDiameterMm'], {
        min: 20,
        max: 3_000,
      }),
      coverDepthM: requireNumber('ENG-404', 'coverDepthM', o['coverDepthM'], { min: 0, max: 20 }),
      trafficLoad: load,
    };
  },
  compute: (input) => {
    // Timbunan minimum: ≥ 1 × diameter dan ≥ 0,6 m; beban berat menaikkannya ke ≥ 1,0 m.
    const byDiameter = input.innerDiameterMm / 1000;
    const base = input.trafficLoad === 'heavy' ? 1 : 0.6;
    const minimumCoverM = round2(Math.max(base, byDiameter));
    const coverAdequate = input.coverDepthM >= minimumCoverM;
    return {
      minimumCoverM,
      coverAdequate,
      structuralNote: coverAdequate
        ? `Timbunan ${input.coverDepthM} m memenuhi minimum awal ${minimumCoverM} m; kelas kekakuan pipa dan pemadatan tetap diperiksa tim teknis.`
        : `Timbunan ${input.coverDepthM} m di bawah minimum awal ${minimumCoverM} m untuk beban ${input.trafficLoad === 'heavy' ? 'berat' : input.trafficLoad === 'car' ? 'mobil' : 'ringan'} — butuh selubung beton atau pipa kelas kekakuan tinggi; wajib validasi struktural.`,
    };
  },
  sourceReference:
    'Praktik umum pipa plastik tertanam di bawah jalan: timbunan ≥ 1D dan ≥ 0,6 m (≥ 1,0 m beban berat); bukan analisis struktur',
  validationStatus: PENDING,
  testCases: [
    {
      name: '300 mm, timbunan 0,5 m, truk → kurang (min 1,0 m)',
      input: { innerDiameterMm: 300, coverDepthM: 0.5, trafficLoad: 'heavy' },
      expected: {
        minimumCoverM: 1,
        coverAdequate: false,
        structuralNote:
          'Timbunan 0.5 m di bawah minimum awal 1 m untuk beban berat — butuh selubung beton atau pipa kelas kekakuan tinggi; wajib validasi struktural.',
      },
    },
  ],
  explain: (_input, output) => output.structuralNote,
};

// ── ENG-405 · Kebutuhan puncak jaringan ─────────────────────────────────────

export interface NetworkDemandInput {
  readonly connections: number;
  readonly personsPerConnection: number;
  readonly litresPerPersonPerDay: number;
  readonly peakFactor: number;
}
export interface NetworkDemandResult {
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
}

export const ENG_405: RuleVersion<NetworkDemandInput, NetworkDemandResult> = {
  ruleId: 'ENG-405',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      connections: requireInt('ENG-405', 'connections', o['connections'], { min: 1, max: 100_000 }),
      personsPerConnection: requireNumber(
        'ENG-405',
        'personsPerConnection',
        o['personsPerConnection'],
        { min: 1, max: 50 },
      ),
      litresPerPersonPerDay: requireNumber(
        'ENG-405',
        'litresPerPersonPerDay',
        o['litresPerPersonPerDay'],
        { min: 20, max: 500 },
      ),
      peakFactor: requireNumber('ENG-405', 'peakFactor', o['peakFactor'], { min: 1, max: 5 }),
    };
  },
  compute: (input) => {
    const average =
      (input.connections * input.personsPerConnection * input.litresPerPersonPerDay) / 86_400;
    return { averageFlowLs: round2(average), peakFlowLs: round2(average * input.peakFactor) };
  },
  sourceReference:
    'Q_rata = sambungan × orang × l/orang/hari ÷ 86 400; Q_puncak = Q_rata × faktor jam puncak',
  validationStatus: PENDING,
  testCases: [
    {
      name: '120 unit × 4 orang × 150 l, faktor 2 → 0,83 → 1,67 l/s',
      input: {
        connections: 120,
        personsPerConnection: 4,
        litresPerPersonPerDay: 150,
        peakFactor: 2,
      },
      expected: { averageFlowLs: 0.83, peakFlowLs: 1.67 },
    },
  ],
  explain: (input, output) =>
    `Kebutuhan puncak ${output.peakFlowLs} l/s = ${input.connections} sambungan × ${input.personsPerConnection} orang × ${input.litresPerPersonPerDay} l/hari ÷ 86 400 (= ${output.averageFlowLs} l/s rata-rata) × faktor jam puncak ${input.peakFactor}.`,
};

export const GROUP_H = [ENG_401, ENG_402, ENG_403, ENG_404, ENG_405] as const;
