/**
 * Kelompok H — gravitasi, air hujan, gorong-gorong, jaringan cluster (brief §15–§18, fase 4).
 * docs/ENGINEERING_RULES.md §3.
 *
 * Rumus baku: Manning untuk kapasitas pipa penuh, metode rasional untuk debit limpasan, kebutuhan
 * puncak dari jumlah sambungan. Intensitas hujan TIDAK pernah dikarang — ia masukan wajib.
 * Gorong-gorong hanya dihitung hidrauliknya; strukturnya ditandai "perlu validasi".
 * Semua `REQUIRES_DOMAIN_VALIDATION`.
 */

import type { EngineeringLocale } from '../parameters/locale.js';
import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';
import { round1, round2 } from '../units.js';
import { NOMINAL_SIZES } from './group-e-irrigation.js';
import { PVC_LARGE_SIZES } from '../parameters/size-tables.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

/**
 * Ukuran nominal untuk saluran gravitasi: tabel bertekanan (½"–6") ditambah 8"–12" yang lazim
 * untuk drainase dan gorong-gorong. Diameter dalam dari OD resmi (Knowledge Master §7.1) dikurangi
 * tebal dinding perkiraan (size-tables.ts). 16" tidak dimasukkan: OD-nya tidak ada di sumber.
 */
export const GRAVITY_SIZES: ReadonlyArray<{ readonly size: string; readonly innerMm: number }> = [
  ...NOMINAL_SIZES,
  ...PVC_LARGE_SIZES,
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
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Pipa Ø${input.innerDiameterMm} mm pada kemiringan ${input.slopePercent} % mengalirkan ±${output.fullFlowLs} l/s saat penuh (${output.fullVelocityMs} m/s; Manning n = ${input.manningN}).`,
      en: `A Ø${input.innerDiameterMm} mm pipe at a ${input.slopePercent} % slope carries ±${output.fullFlowLs} l/s when full (${output.fullVelocityMs} m/s; Manning n = ${input.manningN}).`,
    }),
};

/** Kandidat kasus uji ENG-402 (20 l/s, 1 %, n 0,010, isi 80 %, v ≥ 0,6) — diisi dari probe. */
const GRAVITY_PROBE: readonly GravityCandidate[] = [
  {
    size: '1/2"',
    innerDiameterMm: 18.9,
    fullFlowLs: 0.08,
    fullVelocityMs: 0.28,
    utilisationPercent: 25000,
    status: 'too_small',
  },
  {
    size: '3/4"',
    innerDiameterMm: 22.3,
    fullFlowLs: 0.12,
    fullVelocityMs: 0.31,
    utilisationPercent: 16666.7,
    status: 'too_small',
  },
  {
    size: '1"',
    innerDiameterMm: 27.9,
    fullFlowLs: 0.22,
    fullVelocityMs: 0.37,
    utilisationPercent: 9090.9,
    status: 'too_small',
  },
  {
    size: '1¼"',
    innerDiameterMm: 37.3,
    fullFlowLs: 0.48,
    fullVelocityMs: 0.44,
    utilisationPercent: 4166.7,
    status: 'too_small',
  },
  {
    size: '1½"',
    innerDiameterMm: 43.3,
    fullFlowLs: 0.72,
    fullVelocityMs: 0.49,
    utilisationPercent: 2777.8,
    status: 'too_small',
  },
  {
    size: '2"',
    innerDiameterMm: 55.3,
    fullFlowLs: 1.38,
    fullVelocityMs: 0.58,
    utilisationPercent: 1449.3,
    status: 'too_small',
  },
  {
    size: '2½"',
    innerDiameterMm: 70.8,
    fullFlowLs: 2.67,
    fullVelocityMs: 0.68,
    utilisationPercent: 749.1,
    status: 'too_small',
  },
  {
    size: '3"',
    innerDiameterMm: 82.8,
    fullFlowLs: 4.06,
    fullVelocityMs: 0.75,
    utilisationPercent: 492.6,
    status: 'too_small',
  },
  {
    size: '4"',
    innerDiameterMm: 105.4,
    fullFlowLs: 7.73,
    fullVelocityMs: 0.89,
    utilisationPercent: 258.7,
    status: 'too_small',
  },
  {
    size: '6"',
    innerDiameterMm: 152.3,
    fullFlowLs: 20.62,
    fullVelocityMs: 1.13,
    utilisationPercent: 97,
    status: 'too_small',
  },
  {
    size: '8"',
    innerDiameterMm: 199.6,
    fullFlowLs: 42.41,
    fullVelocityMs: 1.36,
    utilisationPercent: 47.2,
    status: 'ok',
  },
  {
    size: '10"',
    innerDiameterMm: 247.8,
    fullFlowLs: 75.51,
    fullVelocityMs: 1.57,
    utilisationPercent: 26.5,
    status: 'ok',
  },
  {
    size: '12"',
    innerDiameterMm: 295.3,
    fullFlowLs: 120.53,
    fullVelocityMs: 1.76,
    utilisationPercent: 16.6,
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
  version: 2,
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
        innerDiameterMm: 199.6,
        allCriteriaMet: true,
      },
    },
  ],
  explain: (input, output, locale) => {
    const pick = output.candidates.find((c) => c.size === output.recommended)!;
    return localized(locale, {
      id: `Pipa gravitasi ${output.recommended}: kapasitas penuh ${pick.fullFlowLs} l/s pada ${input.slopePercent} %, debit rencana ${input.designFlowLs} l/s = ${pick.utilisationPercent} % (batas ${Math.round(input.fillRatio * 100)} %); kecepatan penuh ${pick.fullVelocityMs} m/s.`,
      en: `Gravity pipe ${output.recommended}: full capacity ${pick.fullFlowLs} l/s at ${input.slopePercent} %, design flow ${input.designFlowLs} l/s = ${pick.utilisationPercent} % (limit ${Math.round(input.fillRatio * 100)} %); full-bore velocity ${pick.fullVelocityMs} m/s.`,
    });
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
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Debit limpasan ${output.designFlowLs} l/s = 2,78 × C ${input.runoffCoefficient} × hujan ${input.rainfallMmPerHour} mm/jam × ${input.catchmentHa} ha (metode rasional).`,
      en: `Runoff flow ${output.designFlowLs} l/s = 2.78 × C ${input.runoffCoefficient} × rainfall ${input.rainfallMmPerHour} mm/h × ${input.catchmentHa} ha (rational method).`,
    }),
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
      structuralNote: culvertStructuralNote(input, { minimumCoverM, coverAdequate }, 'id'),
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
  // Indonesia memakai `structuralNote` apa adanya (byte-identik dengan sebelum P15-04b);
  // Inggris disusun dari angka yang sama lewat `culvertStructuralNote`.
  explain: (input, output, locale) =>
    localized(locale, {
      id: output.structuralNote,
      en: culvertStructuralNote(input, output, 'en'),
    }),
};

/**
 * Catatan struktur gorong-gorong dalam dua bahasa. `compute` ENG-404 menyimpan versi
 * Indonesia di `structuralNote` (kontrak keluaran aturan, dipersistenkan di trace);
 * orkestrator memakai fungsi ini untuk menampilkan versi bahasa percakapan.
 */
export function culvertStructuralNote(
  input: CulvertStructuralInput,
  result: Pick<CulvertStructuralResult, 'minimumCoverM' | 'coverAdequate'>,
  locale: EngineeringLocale,
): string {
  const { minimumCoverM, coverAdequate } = result;
  if (locale === 'en') {
    return coverAdequate
      ? `Cover of ${input.coverDepthM} m meets the preliminary minimum of ${minimumCoverM} m; the pipe stiffness class and compaction are still to be checked by the technical team.`
      : `Cover of ${input.coverDepthM} m is below the preliminary minimum of ${minimumCoverM} m for ${input.trafficLoad === 'heavy' ? 'heavy' : input.trafficLoad === 'car' ? 'car' : 'light'} loads — needs a concrete surround or a high-stiffness-class pipe; structural validation is mandatory.`;
  }
  return coverAdequate
    ? `Timbunan ${input.coverDepthM} m memenuhi minimum awal ${minimumCoverM} m; kelas kekakuan pipa dan pemadatan tetap diperiksa tim teknis.`
    : `Timbunan ${input.coverDepthM} m di bawah minimum awal ${minimumCoverM} m untuk beban ${input.trafficLoad === 'heavy' ? 'berat' : input.trafficLoad === 'car' ? 'mobil' : 'ringan'} — butuh selubung beton atau pipa kelas kekakuan tinggi; wajib validasi struktural.`;
}

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
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Kebutuhan puncak ${output.peakFlowLs} l/s = ${input.connections} sambungan × ${input.personsPerConnection} orang × ${input.litresPerPersonPerDay} l/hari ÷ 86 400 (= ${output.averageFlowLs} l/s rata-rata) × faktor jam puncak ${input.peakFactor}.`,
      en: `Peak demand ${output.peakFlowLs} l/s = ${input.connections} connections × ${input.personsPerConnection} persons × ${input.litresPerPersonPerDay} l/day ÷ 86 400 (= ${output.averageFlowLs} l/s average) × peak-hour factor ${input.peakFactor}.`,
    }),
};

// ── ENG-406 · Debit air limbah domestik dari sambungan rumah ───────────────

export interface SewerFlowInput {
  readonly connections: number;
  readonly personsPerConnection: number;
  readonly litresPerPersonPerDay: number;
  /** Bagian pemakaian air yang kembali sebagai air limbah (0–1). */
  readonly returnFactor: number;
  readonly peakFactor: number;
}
export interface SewerFlowResult {
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
}

export const ENG_406: RuleVersion<SewerFlowInput, SewerFlowResult> = {
  ruleId: 'ENG-406',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      connections: requireInt('ENG-406', 'connections', o['connections'], { min: 1, max: 100_000 }),
      personsPerConnection: requireNumber(
        'ENG-406',
        'personsPerConnection',
        o['personsPerConnection'],
        { min: 1, max: 50 },
      ),
      litresPerPersonPerDay: requireNumber(
        'ENG-406',
        'litresPerPersonPerDay',
        o['litresPerPersonPerDay'],
        { min: 20, max: 500 },
      ),
      returnFactor: requireNumber('ENG-406', 'returnFactor', o['returnFactor'], {
        min: 0.1,
        max: 1,
      }),
      peakFactor: requireNumber('ENG-406', 'peakFactor', o['peakFactor'], { min: 1, max: 6 }),
    };
  },
  compute: (input) => {
    const average =
      (input.connections *
        input.personsPerConnection *
        input.litresPerPersonPerDay *
        input.returnFactor) /
      86_400;
    return { averageFlowLs: round2(average), peakFlowLs: round2(average * input.peakFactor) };
  },
  sourceReference:
    'Q_limbah rata = sambungan × orang × l/orang/hari × faktor kembali ÷ 86 400; Q_puncak = Q_rata × faktor puncak (kriteria perencanaan SPALD-T: air limbah ±80 % pemakaian air)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '200 SR × 5 orang × 100 l × 0,8 kembali, puncak 2,5 → 0,93 → 2,31 l/s',
      input: {
        connections: 200,
        personsPerConnection: 5,
        litresPerPersonPerDay: 100,
        returnFactor: 0.8,
        peakFactor: 2.5,
      },
      expected: { averageFlowLs: 0.93, peakFlowLs: 2.31 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Air limbah puncak ${output.peakFlowLs} l/s = ${input.connections} sambungan × ${input.personsPerConnection} orang × ${input.litresPerPersonPerDay} l/hari × ${input.returnFactor} yang kembali sebagai limbah ÷ 86 400 (= ${output.averageFlowLs} l/s rata-rata) × faktor puncak ${input.peakFactor}.`,
      en: `Peak wastewater ${output.peakFlowLs} l/s = ${input.connections} connections × ${input.personsPerConnection} persons × ${input.litresPerPersonPerDay} l/day × ${input.returnFactor} returned as wastewater ÷ 86 400 (= ${output.averageFlowLs} l/s average) × peak factor ${input.peakFactor}.`,
    }),
};

// ── ENG-407 · Ukuran minimum pipa air limbah ────────────────────────────────

export interface SewerMinimumSizeInput {
  readonly recommendedSize: string;
  readonly minimumSize: string;
}
export interface SewerMinimumSizeResult {
  readonly size: string;
  readonly raised: boolean;
}

function gravitySizeIndex(size: string): number {
  return GRAVITY_SIZES.findIndex((s) => s.size === size);
}

export const ENG_407: RuleVersion<SewerMinimumSizeInput, SewerMinimumSizeResult> = {
  ruleId: 'ENG-407',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const recommendedSize = String(o['recommendedSize'] ?? '');
    const minimumSize = String(o['minimumSize'] ?? '');
    if (gravitySizeIndex(recommendedSize) === -1) {
      throw new RuleInputError('ENG-407', `recommendedSize tidak dikenal: ${recommendedSize}`);
    }
    if (gravitySizeIndex(minimumSize) === -1) {
      throw new RuleInputError('ENG-407', `minimumSize tidak dikenal: ${minimumSize}`);
    }
    return { recommendedSize, minimumSize };
  },
  compute: (input) => {
    const raised = gravitySizeIndex(input.recommendedSize) < gravitySizeIndex(input.minimumSize);
    return { size: raised ? input.minimumSize : input.recommendedSize, raised };
  },
  sourceReference:
    'Pipa air limbah jaringan tidak lebih kecil dari ukuran minimum (150 mm / 6") supaya tidak tersumbat padatan — kriteria umum perencanaan SPALD-T',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'hidraulik cukup 3", minimum 6" → 6" (dinaikkan)',
      input: { recommendedSize: '3"', minimumSize: '6"' },
      expected: { size: '6"', raised: true },
    },
    {
      name: 'hidraulik butuh 8", minimum 6" → 8"',
      input: { recommendedSize: '8"', minimumSize: '6"' },
      expected: { size: '8"', raised: false },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: output.raised
        ? `Secara hidraulik ${input.recommendedSize} sudah cukup, tetapi pipa air limbah jaringan dipakai minimal ${input.minimumSize} supaya padatan tidak menyumbat; dipakai ${output.size}.`
        : `Ukuran ${output.size} sudah di atas minimum pipa air limbah ${input.minimumSize}.`,
      en: output.raised
        ? `Hydraulically ${input.recommendedSize} is enough, but a network sewer pipe is at least ${input.minimumSize} so solids do not block it; ${output.size} is used.`
        : `The ${output.size} size is already above the ${input.minimumSize} sewer minimum.`,
    }),
};

// ── ENG-408 · Sambungan rumah dari jumlah jiwa ──────────────────────────────

export interface ConnectionsFromPopulationInput {
  readonly population: number;
  readonly personsPerConnection: number;
}
export interface ConnectionsFromPopulationResult {
  readonly connections: number;
}

export const ENG_408: RuleVersion<ConnectionsFromPopulationInput, ConnectionsFromPopulationResult> =
  {
    ruleId: 'ENG-408',
    version: 1,
    category: 'load_sizing',
    parseInput: (raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      return {
        population: requireInt('ENG-408', 'population', o['population'], {
          min: 1,
          max: 5_000_000,
        }),
        personsPerConnection: requireNumber(
          'ENG-408',
          'personsPerConnection',
          o['personsPerConnection'],
          { min: 1, max: 50 },
        ),
      };
    },
    compute: (input) => ({
      connections: Math.max(1, Math.ceil(input.population / input.personsPerConnection)),
    }),
    sourceReference: 'Sambungan rumah = jiwa ÷ jiwa per sambungan, dibulatkan ke atas',
    validationStatus: PENDING,
    testCases: [
      {
        name: '1 000 jiwa ÷ 5 → 200 SR',
        input: { population: 1000, personsPerConnection: 5 },
        expected: { connections: 200 },
      },
      {
        name: '12 jiwa ÷ 5 → 3 SR (dibulatkan ke atas)',
        input: { population: 12, personsPerConnection: 5 },
        expected: { connections: 3 },
      },
    ],
    explain: (input, output, locale) =>
      localized(locale, {
        id: `${input.population} jiwa ÷ ${input.personsPerConnection} jiwa per sambungan = ${output.connections} sambungan rumah.`,
        en: `${input.population} people ÷ ${input.personsPerConnection} per connection = ${output.connections} house connections.`,
      }),
  };

export const GROUP_H = [
  ENG_401,
  ENG_402,
  ENG_403,
  ENG_404,
  ENG_405,
  ENG_406,
  ENG_407,
  ENG_408,
] as const;
