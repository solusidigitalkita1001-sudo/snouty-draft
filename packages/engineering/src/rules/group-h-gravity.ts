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
import { barToHeadM, headMToBar, round1, round2, round3 } from '../units.js';
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
  /** Infiltrasi air tanah/hujan ke pipa sebagai % dari debit rata-rata. */
  readonly infiltrationPercent: number;
}
export interface SewerFlowResult {
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
}

export const ENG_406: RuleVersion<SewerFlowInput, SewerFlowResult> = {
  ruleId: 'ENG-406',
  // v2 (P22-08): infiltrasi ditambahkan ke debit puncak.
  version: 2,
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
      infiltrationPercent: requireNumber(
        'ENG-406',
        'infiltrationPercent',
        o['infiltrationPercent'],
        { min: 0, max: 100 },
      ),
    };
  },
  compute: (input) => {
    const average =
      (input.connections *
        input.personsPerConnection *
        input.litresPerPersonPerDay *
        input.returnFactor) /
      86_400;
    return {
      averageFlowLs: round2(average),
      peakFlowLs: round2(average * input.peakFactor + (average * input.infiltrationPercent) / 100),
    };
  },
  sourceReference:
    'Q_limbah rata = sambungan × orang × l/orang/hari × faktor kembali ÷ 86 400; Q_puncak = Q_rata × faktor puncak + infiltrasi % × Q_rata (kriteria perencanaan SPALD-T: air limbah ±80 % pemakaian air, infiltrasi ±10 %)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '200 SR × 5 orang × 100 l × 0,8 kembali, puncak 2,5 + infiltrasi 10 % → 0,93 → 2,41 l/s',
      input: {
        connections: 200,
        personsPerConnection: 5,
        litresPerPersonPerDay: 100,
        returnFactor: 0.8,
        peakFactor: 2.5,
        infiltrationPercent: 10,
      },
      expected: { averageFlowLs: 0.93, peakFlowLs: 2.41 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id: `Air limbah puncak ${output.peakFlowLs} l/s = ${input.connections} sambungan × ${input.personsPerConnection} orang × ${input.litresPerPersonPerDay} l/hari × ${input.returnFactor} yang kembali sebagai limbah ÷ 86 400 (= ${output.averageFlowLs} l/s rata-rata) × faktor puncak ${input.peakFactor}, ditambah infiltrasi ${input.infiltrationPercent} % dari rata-rata.`,
      en: `Peak wastewater ${output.peakFlowLs} l/s = ${input.connections} connections × ${input.personsPerConnection} persons × ${input.litresPerPersonPerDay} l/day × ${input.returnFactor} returned as wastewater ÷ 86 400 (= ${output.averageFlowLs} l/s average) × peak factor ${input.peakFactor}, plus ${input.infiltrationPercent} % of the average as infiltration.`,
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

// ── ENG-409 · Kebutuhan air jaringan air minum (SPAM): domestik, non-domestik, kebocoran, puncak ──

export interface SupplyDemandInput {
  readonly connections: number;
  readonly personsPerConnection: number;
  readonly litresPerPersonPerDay: number;
  /** Non-domestik (sekolah, masjid, hidran umum) sebagai % dari domestik. */
  readonly nonDomesticPercent: number;
  /** Kehilangan air / NRW sebagai % dari produksi. */
  readonly nrwPercent: number;
  readonly dayPeakFactor: number;
  readonly hourPeakFactor: number;
}
export interface SupplyDemandResult {
  readonly domesticAverageLs: number;
  /** Produksi rata-rata: domestik + non-domestik, ditambah kebocoran. */
  readonly averageLs: number;
  readonly maxDayLs: number;
  readonly peakHourLs: number;
  readonly dailyVolumeM3: number;
}

export const ENG_409: RuleVersion<SupplyDemandInput, SupplyDemandResult> = {
  ruleId: 'ENG-409',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      connections: requireInt('ENG-409', 'connections', o['connections'], {
        min: 1,
        max: 1_000_000,
      }),
      personsPerConnection: requireNumber(
        'ENG-409',
        'personsPerConnection',
        o['personsPerConnection'],
        { min: 1, max: 50 },
      ),
      litresPerPersonPerDay: requireNumber(
        'ENG-409',
        'litresPerPersonPerDay',
        o['litresPerPersonPerDay'],
        { min: 20, max: 500 },
      ),
      nonDomesticPercent: requireNumber('ENG-409', 'nonDomesticPercent', o['nonDomesticPercent'], {
        min: 0,
        max: 100,
      }),
      nrwPercent: requireNumber('ENG-409', 'nrwPercent', o['nrwPercent'], { min: 0, max: 60 }),
      dayPeakFactor: requireNumber('ENG-409', 'dayPeakFactor', o['dayPeakFactor'], {
        min: 1,
        max: 2,
      }),
      hourPeakFactor: requireNumber('ENG-409', 'hourPeakFactor', o['hourPeakFactor'], {
        min: 1,
        max: 5,
      }),
    };
  },
  compute: (i) => {
    const domestic = (i.connections * i.personsPerConnection * i.litresPerPersonPerDay) / 86_400;
    const average = (domestic * (1 + i.nonDomesticPercent / 100)) / (1 - i.nrwPercent / 100);
    return {
      domesticAverageLs: round2(domestic),
      averageLs: round2(average),
      maxDayLs: round2(average * i.dayPeakFactor),
      peakHourLs: round2(average * i.hourPeakFactor),
      dailyVolumeM3: round1(average * 86.4),
    };
  },
  sourceReference:
    'Kriteria perencanaan SPAM: Q_rata = (domestik × (1 + non-domestik %)) ÷ (1 − NRW %); Q_hari maks = Q_rata × f_hari; Q_jam puncak = Q_rata × f_jam; pipa transmisi/reservoir pada Q_hari maks, distribusi pada Q_jam puncak',
  validationStatus: PENDING,
  testCases: [
    {
      name: '500 SR × 5 × 100 l, non-domestik 15 %, NRW 20 %, f_hari 1,15, f_jam 1,75',
      input: {
        connections: 500,
        personsPerConnection: 5,
        litresPerPersonPerDay: 100,
        nonDomesticPercent: 15,
        nrwPercent: 20,
        dayPeakFactor: 1.15,
        hourPeakFactor: 1.75,
      },
      // domestik 2,894 l/s → × 1,15 ÷ 0,8 = 4,161 → hari maks 4,785 → jam puncak 7,282; 359,5 m³/hari
      expected: {
        domesticAverageLs: 2.89,
        averageLs: 4.16,
        maxDayLs: 4.78,
        peakHourLs: 7.28,
        dailyVolumeM3: 359.4,
      },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Kebutuhan domestik ${o.domesticAverageLs} l/s (${i.connections} SR × ${i.personsPerConnection} jiwa × ${i.litresPerPersonPerDay} l/hari), ditambah non-domestik ${i.nonDomesticPercent} % dan kebocoran ${i.nrwPercent} % → produksi rata-rata ${o.averageLs} l/s (${o.dailyVolumeM3} m³/hari); hari maksimum ${o.maxDayLs} l/s (× ${i.dayPeakFactor}) untuk transmisi dan reservoir, jam puncak ${o.peakHourLs} l/s (× ${i.hourPeakFactor}) untuk pipa distribusi.`,
      en: `Domestic demand ${o.domesticAverageLs} l/s (${i.connections} connections × ${i.personsPerConnection} people × ${i.litresPerPersonPerDay} l/day), plus ${i.nonDomesticPercent} % non-domestic and ${i.nrwPercent} % losses → average production ${o.averageLs} l/s (${o.dailyVolumeM3} m³/day); maximum day ${o.maxDayLs} l/s (× ${i.dayPeakFactor}) for transmission and the reservoir, peak hour ${o.peakHourLs} l/s (× ${i.hourPeakFactor}) for the distribution pipe.`,
    }),
};

// ── ENG-410 · Volume reservoir dari kebutuhan hari maksimum ────────────────

export interface ReservoirInput {
  readonly maxDayLs: number;
  /** Volume reservoir sebagai % dari kebutuhan hari maksimum. */
  readonly fractionPercent: number;
}
export interface ReservoirResult {
  readonly maxDayVolumeM3: number;
  readonly reservoirM3: number;
}

export const ENG_410: RuleVersion<ReservoirInput, ReservoirResult> = {
  ruleId: 'ENG-410',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      maxDayLs: requireNumber('ENG-410', 'maxDayLs', o['maxDayLs'], { min: 0.01, max: 100_000 }),
      fractionPercent: requireNumber('ENG-410', 'fractionPercent', o['fractionPercent'], {
        min: 5,
        max: 100,
      }),
    };
  },
  compute: (i) => {
    const maxDayVolumeM3 = i.maxDayLs * 86.4;
    return {
      maxDayVolumeM3: round1(maxDayVolumeM3),
      reservoirM3: round1((maxDayVolumeM3 * i.fractionPercent) / 100),
    };
  },
  sourceReference:
    'Kriteria perencanaan SPAM: volume reservoir distribusi ±15–20 % kebutuhan hari maksimum (penyeimbang jam puncak)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '4,78 l/s hari maks → 413 m³/hari → reservoir 20 % = 82,6 m³',
      input: { maxDayLs: 4.78, fractionPercent: 20 },
      expected: { maxDayVolumeM3: 413, reservoirM3: 82.6 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Reservoir distribusi ≈ ${i.fractionPercent} % × kebutuhan hari maksimum ${o.maxDayVolumeM3} m³ = ${o.reservoirM3} m³.`,
      en: `Distribution reservoir ≈ ${i.fractionPercent} % × maximum-day demand ${o.maxDayVolumeM3} m³ = ${o.reservoirM3} m³.`,
    }),
};

// ── ENG-411 · Kelas tekanan pipa dari tekanan kerja maksimum ────────────────

/** PN yang lazim untuk PE100 dan padanan SDR-nya. */
export const PN_CLASSES: ReadonlyArray<{ readonly pn: number; readonly sdr: number }> = [
  { pn: 6.3, sdr: 26 },
  { pn: 8, sdr: 21 },
  { pn: 10, sdr: 17 },
  { pn: 12.5, sdr: 13.6 },
  { pn: 16, sdr: 11 },
  { pn: 20, sdr: 9 },
];

export interface PressureClassInput {
  readonly maxPressureBar: number;
  /** Tunjangan surja (water hammer) di atas tekanan kerja; 0 bila tanpa pompa. */
  readonly surgeBar: number;
  readonly marginPercent: number;
}
export interface PressureClassResult {
  readonly requiredBar: number;
  readonly pn: number | null;
  readonly sdr: number | null;
}

export const ENG_411: RuleVersion<PressureClassInput, PressureClassResult> = {
  ruleId: 'ENG-411',
  // v2 (audit PDAM 2026-10-16): surja ikut dihitung sebelum margin.
  version: 2,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      maxPressureBar: requireNumber('ENG-411', 'maxPressureBar', o['maxPressureBar'], {
        min: 0,
        max: 100,
      }),
      surgeBar: requireNumber('ENG-411', 'surgeBar', o['surgeBar'], { min: 0, max: 50 }),
      marginPercent: requireNumber('ENG-411', 'marginPercent', o['marginPercent'], {
        min: 0,
        max: 100,
      }),
    };
  },
  compute: (i) => {
    const requiredBar = round2((i.maxPressureBar + i.surgeBar) * (1 + i.marginPercent / 100));
    const cls = PN_CLASSES.find((c) => c.pn >= requiredBar) ?? null;
    return { requiredBar, pn: cls?.pn ?? null, sdr: cls?.sdr ?? null };
  },
  sourceReference:
    'Kelas tekanan nominal (PN) ≥ (tekanan kerja maksimum + surja) × (1 + margin) — tekanan statis, tekanan sumber, atau head pompa; surja Joukowsky Δh = a·v/g; PE100: PN 6,3/8/10/12,5/16/20 ↔ SDR 26/21/17/13,6/11/9',
  validationStatus: PENDING,
  testCases: [
    {
      name: '10,2 bar + 10 % → 11,22 bar → PN 12,5 (SDR 13,6)',
      input: { maxPressureBar: 10.2, surgeBar: 0, marginPercent: 10 },
      expected: { requiredBar: 11.22, pn: 12.5, sdr: 13.6 },
    },
    {
      name: '2 bar + 10 % → PN 6,3',
      input: { maxPressureBar: 2, surgeBar: 0, marginPercent: 10 },
      expected: { requiredBar: 2.2, pn: 6.3, sdr: 26 },
    },
    {
      name: '8 bar + surja 2 bar + 10 % → 11 bar → PN 12,5',
      input: { maxPressureBar: 8, surgeBar: 2, marginPercent: 10 },
      expected: { requiredBar: 11, pn: 12.5, sdr: 13.6 },
    },
    {
      name: '25 bar → di luar kelas yang lazim',
      input: { maxPressureBar: 25, surgeBar: 0, marginPercent: 0 },
      expected: { requiredBar: 25, pn: null, sdr: null },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id:
        o.pn === null
          ? `Tekanan kerja ${i.maxPressureBar} bar (+${i.marginPercent} % margin = ${o.requiredBar} bar) melampaui kelas PN yang lazim — perlu kajian tim teknis.`
          : `Tekanan kerja maksimum ${i.maxPressureBar} bar${i.surgeBar > 0 ? ` + surja ${i.surgeBar} bar` : ''} + margin ${i.marginPercent} % = ${o.requiredBar} bar → kelas PN ${o.pn} (PE100 SDR ${o.sdr}).`,
      en:
        o.pn === null
          ? `Working pressure ${i.maxPressureBar} bar (+${i.marginPercent} % margin = ${o.requiredBar} bar) exceeds the usual PN classes — technical review needed.`
          : `Maximum working pressure ${i.maxPressureBar} bar${i.surgeBar > 0 ? ` + surge ${i.surgeBar} bar` : ''} + ${i.marginPercent} % margin = ${o.requiredBar} bar → class PN ${o.pn} (PE100 SDR ${o.sdr}).`,
    }),
};

// ── ENG-412 · Aliran sebagian di pipa air limbah: d/D, kecepatan, kemiringan minimum ──

export interface SewerPartialFlowInput {
  readonly designFlowLs: number;
  readonly innerDiameterMm: number;
  readonly slopePercent: number;
  readonly manningN: number;
  readonly velocityMinMs: number;
  readonly velocityMaxMs: number;
  /** d/D maksimum yang diizinkan pada debit rencana (0–1). */
  readonly maxDepthRatio: number;
}
export interface SewerPartialFlowResult {
  readonly depthRatio: number;
  readonly velocityMs: number;
  readonly selfCleansing: boolean;
  readonly tooFast: boolean;
  readonly depthOk: boolean;
  /** Kemiringan agar kecepatan penuh ≥ minimum — rujukan bila kemiringan rencana kurang. */
  readonly minimumSlopePercent: number;
}

/** Luas dan jari-jari hidraulik segmen lingkaran pada kedalaman relatif y = d/D. */
function circularSection(dM: number, y: number): { area: number; radius: number } {
  const theta = 2 * Math.acos(1 - 2 * y);
  const area = ((dM * dM) / 8) * (theta - Math.sin(theta));
  const perimeter = (dM * theta) / 2;
  return { area, radius: perimeter > 0 ? area / perimeter : 0 };
}

export const ENG_412: RuleVersion<SewerPartialFlowInput, SewerPartialFlowResult> = {
  ruleId: 'ENG-412',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const velocityMinMs = requireNumber('ENG-412', 'velocityMinMs', o['velocityMinMs'], {
      min: 0.1,
      max: 3,
    });
    return {
      designFlowLs: requireNumber('ENG-412', 'designFlowLs', o['designFlowLs'], {
        min: 0.001,
        max: 100_000,
      }),
      innerDiameterMm: requireNumber('ENG-412', 'innerDiameterMm', o['innerDiameterMm'], {
        min: 10,
        max: 5000,
      }),
      slopePercent: requireNumber('ENG-412', 'slopePercent', o['slopePercent'], {
        min: 0.01,
        max: 50,
      }),
      manningN: requireNumber('ENG-412', 'manningN', o['manningN'], { min: 0.005, max: 0.05 }),
      velocityMinMs,
      velocityMaxMs: requireNumber('ENG-412', 'velocityMaxMs', o['velocityMaxMs'], {
        min: velocityMinMs,
        max: 10,
      }),
      maxDepthRatio: requireNumber('ENG-412', 'maxDepthRatio', o['maxDepthRatio'], {
        min: 0.1,
        max: 1,
      }),
    };
  },
  compute: (i) => {
    const dM = i.innerDiameterMm / 1000;
    const s = i.slopePercent / 100;
    const q = i.designFlowLs / 1000;
    const flowAt = (y: number) => {
      const { area, radius } = circularSection(dM, y);
      return (area * Math.pow(radius, 2 / 3) * Math.sqrt(s)) / i.manningN;
    };
    // Kedalaman relatif pada debit rencana: bisection pada 0 < y ≤ 1 (debit naik monoton sampai
    // ±0,94 D; di atas itu dianggap penuh).
    let lo = 0.001;
    let hi = 1;
    let y: number;
    if (flowAt(0.94) <= q) {
      y = 1;
    } else {
      for (let n = 0; n < 60; n += 1) {
        const mid = (lo + hi) / 2;
        if (flowAt(mid) < q) lo = mid;
        else hi = mid;
      }
      y = hi;
    }
    const { area } = circularSection(dM, Math.min(y, 1));
    const velocity = area > 0 ? q / area : 0;
    // Kemiringan minimum supaya kecepatan PADA DEBIT RENCANA mencapai v_min: kecepatan ≈ ∝ √S pada
    // kedalaman yang sama, jadi S_min ≈ S × (v_min / v)²; bila sudah cukup, kemiringan rencana dipakai.
    const minimumSlope =
      velocity >= i.velocityMinMs || velocity === 0
        ? i.slopePercent
        : i.slopePercent * Math.pow(i.velocityMinMs / velocity, 2);
    return {
      depthRatio: round2(y),
      velocityMs: round2(velocity),
      selfCleansing: velocity >= i.velocityMinMs,
      tooFast: velocity > i.velocityMaxMs,
      depthOk: y <= i.maxDepthRatio,
      minimumSlopePercent: round2(minimumSlope),
    };
  },
  sourceReference:
    'Manning pada segmen lingkaran: A = D²/8 (θ − sin θ), P = Dθ/2, θ = 2 arccos(1 − 2d/D); kecepatan pembersihan sendiri ≥ 0,6 m/s pada debit rencana, maksimum ≈ 3 m/s, d/D ≤ 0,8; S_min ≈ S × (v_min ÷ v)²',
  validationStatus: PENDING,
  testCases: [
    {
      name: '2,4 l/s di 6" (152,2 mm) pada 0,5 %: d/D ±0,27, v ±0,59 m/s (< 0,6) → kemiringan min ±0,51 %',
      input: {
        designFlowLs: 2.4,
        innerDiameterMm: 152.2,
        slopePercent: 0.5,
        manningN: 0.01,
        velocityMinMs: 0.6,
        velocityMaxMs: 3,
        maxDepthRatio: 0.8,
      },
      expected: {
        depthRatio: 0.27,
        velocityMs: 0.59,
        selfCleansing: false,
        tooFast: false,
        depthOk: true,
        minimumSlopePercent: 0.51,
      },
    },
    {
      name: 'debit di atas kapasitas penuh → d/D 1, kedalaman tidak memenuhi',
      input: {
        designFlowLs: 60,
        innerDiameterMm: 152.2,
        slopePercent: 0.5,
        manningN: 0.01,
        velocityMinMs: 0.6,
        velocityMaxMs: 3,
        maxDepthRatio: 0.8,
      },
      expected: {
        depthRatio: 1,
        velocityMs: 3.3,
        selfCleansing: true,
        tooFast: true,
        depthOk: false,
        minimumSlopePercent: 0.5,
      },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Pada debit rencana ${i.designFlowLs} l/s pipa ${i.innerDiameterMm} mm terisi ${Math.round(o.depthRatio * 100)} % (d/D ${o.depthRatio}${o.depthOk ? '' : ` > ${i.maxDepthRatio}`}) dengan kecepatan ${o.velocityMs} m/s — ${o.selfCleansing ? 'cukup membersihkan sendiri' : `di bawah ${i.velocityMinMs} m/s, endapan bisa menumpuk; kemiringan minimum supaya debit rencana mencapai ${i.velocityMinMs} m/s adalah ${o.minimumSlopePercent} %`}${o.tooFast ? `; melampaui ${i.velocityMaxMs} m/s, pipa bisa tergerus` : ''}.`,
      en: `At the design flow of ${i.designFlowLs} l/s the ${i.innerDiameterMm} mm pipe runs ${Math.round(o.depthRatio * 100)} % full (d/D ${o.depthRatio}${o.depthOk ? '' : ` > ${i.maxDepthRatio}`}) at ${o.velocityMs} m/s — ${o.selfCleansing ? 'self-cleansing' : `below ${i.velocityMinMs} m/s, solids may settle; the minimum slope for the design flow to reach ${i.velocityMinMs} m/s is ${o.minimumSlopePercent} %`}${o.tooFast ? `; above ${i.velocityMaxMs} m/s, the pipe may scour` : ''}.`,
    }),
};

// ── ENG-413 · Profil jalur air limbah: manhole, penurunan, kedalaman galian ──

export interface SewerProfileInput {
  readonly routeLengthM: number;
  readonly slopePercent: number;
  readonly manholeSpacingM: number;
  /** Kedalaman dasar pipa di awal jalur (timbunan + pipa). */
  readonly startDepthM: number;
  /** Kedalaman galian praktis maksimum sebelum butuh stasiun pompa angkat. */
  readonly maxDepthM: number;
}
export interface SewerProfileResult {
  readonly manholes: number;
  readonly fallM: number;
  readonly endDepthM: number;
  readonly liftNeeded: boolean;
}

export const ENG_413: RuleVersion<SewerProfileInput, SewerProfileResult> = {
  ruleId: 'ENG-413',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      routeLengthM: requireNumber('ENG-413', 'routeLengthM', o['routeLengthM'], {
        min: 1,
        max: 100_000,
      }),
      slopePercent: requireNumber('ENG-413', 'slopePercent', o['slopePercent'], {
        min: 0.01,
        max: 50,
      }),
      manholeSpacingM: requireNumber('ENG-413', 'manholeSpacingM', o['manholeSpacingM'], {
        min: 10,
        max: 200,
      }),
      startDepthM: requireNumber('ENG-413', 'startDepthM', o['startDepthM'], { min: 0.3, max: 10 }),
      maxDepthM: requireNumber('ENG-413', 'maxDepthM', o['maxDepthM'], { min: 1, max: 20 }),
    };
  },
  compute: (i) => {
    const fallM = (i.routeLengthM * i.slopePercent) / 100;
    const endDepthM = i.startDepthM + fallM;
    return {
      manholes: Math.ceil(i.routeLengthM / i.manholeSpacingM) + 1,
      fallM: round2(fallM),
      endDepthM: round2(endDepthM),
      liftNeeded: endDepthM > i.maxDepthM,
    };
  },
  sourceReference:
    'Manhole tiap ≤ 50 m (pipa kecil) dan di tiap belokan/pertemuan; penurunan = panjang × kemiringan; galian lebih dalam dari ±4 m → stasiun pompa angkat (kriteria perencanaan SPALD-T)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '1 500 m pada 0,6 %, manhole tiap 50 m, awal 1 m, maks 4 m → 31 manhole, turun 9 m, perlu pompa angkat',
      input: {
        routeLengthM: 1500,
        slopePercent: 0.6,
        manholeSpacingM: 50,
        startDepthM: 1,
        maxDepthM: 4,
      },
      expected: { manholes: 31, fallM: 9, endDepthM: 10, liftNeeded: true },
    },
    {
      name: '300 m pada 0,5 % → 7 manhole, turun 1,5 m, galian akhir 2,5 m',
      input: {
        routeLengthM: 300,
        slopePercent: 0.5,
        manholeSpacingM: 50,
        startDepthM: 1,
        maxDepthM: 4,
      },
      expected: { manholes: 7, fallM: 1.5, endDepthM: 2.5, liftNeeded: false },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Jalur ${i.routeLengthM} m pada ${i.slopePercent} % turun ${o.fallM} m: dari kedalaman awal ${i.startDepthM} m, dasar pipa di ujung ${o.endDepthM} m${o.liftNeeded ? ` — lebih dalam dari batas praktis ${i.maxDepthM} m, perlu stasiun pompa angkat atau jalur dipecah` : ''}; manhole tiap ${i.manholeSpacingM} m → ${o.manholes} buah (ditambah di belokan dan pertemuan).`,
      en: `A ${i.routeLengthM} m run at ${i.slopePercent} % drops ${o.fallM} m: from a starting depth of ${i.startDepthM} m the invert ends at ${o.endDepthM} m${o.liftNeeded ? ` — deeper than the practical ${i.maxDepthM} m, a lift station or a split route is needed` : ''}; a manhole every ${i.manholeSpacingM} m → ${o.manholes} (plus bends and junctions).`,
    }),
};

// ── ENG-414 · Alokasi debit per segmen: pipa induk + N cabang seragam ──────

export interface SegmentDemandInput {
  readonly connections: number;
  /** Jumlah cabang; 0 = tidak diketahui → satu pipa, topologi diasumsikan. */
  readonly branches: number;
  readonly peakFlowLs: number;
  readonly trunkLengthM: number;
  /** Panjang tiap cabang sebagai bagian dari pipa induk (asumsi registry). */
  readonly branchLengthRatio: number;
}
export interface SegmentDemandResult {
  readonly topologyAssumed: boolean;
  readonly branches: number;
  readonly connectionsPerBranch: number | null;
  readonly trunkFlowLs: number;
  readonly branchFlowLs: number | null;
  readonly branchLengthM: number | null;
}

export const ENG_414: RuleVersion<SegmentDemandInput, SegmentDemandResult> = {
  ruleId: 'ENG-414',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      connections: requireInt('ENG-414', 'connections', o['connections'], {
        min: 1,
        max: 1_000_000,
      }),
      branches: requireInt('ENG-414', 'branches', o['branches'], { min: 0, max: 500 }),
      peakFlowLs: requireNumber('ENG-414', 'peakFlowLs', o['peakFlowLs'], {
        min: 0.001,
        max: 100_000,
      }),
      trunkLengthM: requireNumber('ENG-414', 'trunkLengthM', o['trunkLengthM'], {
        min: 1,
        max: 100_000,
      }),
      branchLengthRatio: requireNumber('ENG-414', 'branchLengthRatio', o['branchLengthRatio'], {
        min: 0.05,
        max: 5,
      }),
    };
  },
  compute: (i) => {
    if (i.branches === 0) {
      return {
        topologyAssumed: true,
        branches: 0,
        connectionsPerBranch: null,
        trunkFlowLs: i.peakFlowLs,
        branchFlowLs: null,
        branchLengthM: null,
      };
    }
    // Seluruh debit puncak lewat pipa induk; tiap cabang membawa bagiannya — tidak ada segmen
    // yang dihitung memikul debit yang sudah diambil cabang lain (audit PDAM 2026-10-16).
    return {
      topologyAssumed: false,
      branches: i.branches,
      connectionsPerBranch: Math.ceil(i.connections / i.branches),
      trunkFlowLs: i.peakFlowLs,
      branchFlowLs: round3(i.peakFlowLs / i.branches),
      branchLengthM: round1(i.trunkLengthM * i.branchLengthRatio),
    };
  },
  sourceReference:
    'Topologi pipa induk + N cabang seragam: Q_induk = Q_puncak; Q_cabang = Q_puncak ÷ N; SR per cabang = ⌈SR ÷ N⌉; panjang cabang = rasio × panjang induk (asumsi)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '500 SR, 4 cabang, 7,28 l/s, induk 2 000 m, rasio 0,5 → cabang 1,82 l/s × 1 000 m, 125 SR tiap cabang',
      input: {
        connections: 500,
        branches: 4,
        peakFlowLs: 7.28,
        trunkLengthM: 2000,
        branchLengthRatio: 0.5,
      },
      expected: {
        topologyAssumed: false,
        branches: 4,
        connectionsPerBranch: 125,
        trunkFlowLs: 7.28,
        branchFlowLs: 1.82,
        branchLengthM: 1000,
      },
    },
    {
      name: 'cabang tidak diketahui → satu pipa, topologi diasumsikan',
      input: {
        connections: 500,
        branches: 0,
        peakFlowLs: 7.28,
        trunkLengthM: 2000,
        branchLengthRatio: 0.5,
      },
      expected: {
        topologyAssumed: true,
        branches: 0,
        connectionsPerBranch: null,
        trunkFlowLs: 7.28,
        branchFlowLs: null,
        branchLengthM: null,
      },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: o.topologyAssumed
        ? `Jumlah cabang belum disebut: seluruh ${o.trunkFlowLs} l/s dihitung lewat satu pipa sepanjang ${i.trunkLengthM} m — topologi diasumsikan, bukan hasil pemodelan.`
        : `Pipa induk membawa seluruh ${o.trunkFlowLs} l/s; ${o.branches} cabang masing-masing ${o.branchFlowLs} l/s untuk ±${o.connectionsPerBranch} sambungan, panjang cabang ${o.branchLengthM} m (${i.branchLengthRatio} × pipa induk, asumsi).`,
      en: o.topologyAssumed
        ? `The number of branches was not given: the full ${o.trunkFlowLs} l/s is sized through one ${i.trunkLengthM} m pipe — an assumed topology, not a model.`
        : `The trunk carries the full ${o.trunkFlowLs} l/s; ${o.branches} branches carry ${o.branchFlowLs} l/s each for about ${o.connectionsPerBranch} connections, branch length ${o.branchLengthM} m (${i.branchLengthRatio} × trunk, assumed).`,
    }),
};

// ── ENG-415 · Head yang dibutuhkan di jalur kritis: induk + satu cabang terjauh ──

export interface CriticalPathInput {
  /** Beda tinggi sumber → titik kritis (positif = titik kritis lebih tinggi). */
  readonly staticHeadM: number;
  readonly trunkLossM: number;
  readonly branchLossM: number;
  readonly residualBar: number;
}
export interface CriticalPathResult {
  readonly lossM: number;
  readonly residualM: number;
  /** Head yang harus disediakan sumber/pompa; negatif = gravitasi sudah lebih dari cukup. */
  readonly requiredHeadM: number;
}

export const ENG_415: RuleVersion<CriticalPathInput, CriticalPathResult> = {
  ruleId: 'ENG-415',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      staticHeadM: requireNumber('ENG-415', 'staticHeadM', o['staticHeadM'], {
        min: -500,
        max: 500,
      }),
      trunkLossM: requireNumber('ENG-415', 'trunkLossM', o['trunkLossM'], { min: 0, max: 5000 }),
      branchLossM: requireNumber('ENG-415', 'branchLossM', o['branchLossM'], { min: 0, max: 5000 }),
      residualBar: requireNumber('ENG-415', 'residualBar', o['residualBar'], { min: 0, max: 20 }),
    };
  },
  compute: (i) => {
    const lossM = round2(i.trunkLossM + i.branchLossM);
    const residualM = round2(barToHeadM(i.residualBar));
    return { lossM, residualM, requiredHeadM: round2(i.staticHeadM + lossM + residualM) };
  },
  sourceReference:
    'Head titik kritis = beda tinggi + Σ kehilangan segmen di jalur terjauh (induk + cabang) + tekanan sisa yang disyaratkan di sambungan',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'statis 20 m, induk 30 m, cabang 5 m, sisa 1 bar → 65,2 m',
      input: { staticHeadM: 20, trunkLossM: 30, branchLossM: 5, residualBar: 1 },
      expected: { lossM: 35, residualM: 10.2, requiredHeadM: 65.2 },
    },
    {
      name: 'reservoir 40 m di atas, kehilangan 12 m, sisa 1 bar → −17,8 m (gravitasi lebih dari cukup)',
      input: { staticHeadM: -40, trunkLossM: 10, branchLossM: 2, residualBar: 1 },
      expected: { lossM: 12, residualM: 10.2, requiredHeadM: -17.8 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Di titik kritis (ujung terjauh/tertinggi): beda tinggi ${i.staticHeadM} m + kehilangan ${o.lossM} m (induk ${i.trunkLossM} m, cabang ${i.branchLossM} m) + tekanan sisa ${i.residualBar} bar (${o.residualM} m) = ${o.requiredHeadM} m yang harus disediakan sumber atau pompa.`,
      en: `At the critical point (farthest/highest): static ${i.staticHeadM} m + losses ${o.lossM} m (trunk ${i.trunkLossM} m, branch ${i.branchLossM} m) + residual ${i.residualBar} bar (${o.residualM} m) = ${o.requiredHeadM} m to be supplied by the source or a pump.`,
    }),
};

// ── ENG-416 · Mode sistem: gravitasi, suplai langsung PDAM, booster, pompa ──

export type SupplyMode = 'gravity' | 'direct_supply' | 'booster' | 'pumped';

export interface SupplyModeInput {
  readonly requiredHeadM: number;
  readonly residualM: number;
  /** Tekanan tersedia di sumber (PDAM) dalam meter; `null` = reservoir/sumur tanpa tekanan. */
  readonly sourceHeadM: number | null;
}
export interface SupplyModeResult {
  readonly mode: SupplyMode;
  readonly availableHeadM: number;
  /** Head pompa yang dibutuhkan; 0 bila tanpa pompa. */
  readonly pumpHeadM: number;
  /** Tekanan sisa yang akan terjadi di titik kritis dengan mode ini. */
  readonly residualAtCriticalBar: number;
}

export const ENG_416: RuleVersion<SupplyModeInput, SupplyModeResult> = {
  ruleId: 'ENG-416',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const source = o['sourceHeadM'];
    return {
      requiredHeadM: requireNumber('ENG-416', 'requiredHeadM', o['requiredHeadM'], {
        min: -1000,
        max: 10_000,
      }),
      residualM: requireNumber('ENG-416', 'residualM', o['residualM'], { min: 0, max: 500 }),
      sourceHeadM:
        source === null || source === undefined
          ? null
          : requireNumber('ENG-416', 'sourceHeadM', source, { min: 0, max: 500 }),
    };
  },
  compute: (i) => {
    const availableHeadM = i.sourceHeadM ?? 0;
    const surplusM = availableHeadM - i.requiredHeadM;
    let mode: SupplyMode;
    if (i.sourceHeadM === null) mode = i.requiredHeadM <= 0 ? 'gravity' : 'pumped';
    else mode = surplusM >= 0 ? 'direct_supply' : 'booster';
    const pumpHeadM = surplusM >= 0 ? 0 : round2(-surplusM);
    return {
      mode,
      availableHeadM,
      pumpHeadM,
      residualAtCriticalBar: round2(headMToBar(i.residualM + Math.max(0, surplusM))),
    };
  },
  sourceReference:
    'Gravitasi bila head titik kritis ≤ 0 tanpa tekanan sumber; suplai langsung bila tekanan PDAM ≥ head titik kritis; booster sebesar kekurangannya; pompa penuh bila sumber tanpa tekanan',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'reservoir, head titik kritis −17,8 m → gravitasi, sisa 1 bar + 1,75 bar surplus',
      input: { requiredHeadM: -17.8, residualM: 10.2, sourceHeadM: null },
      expected: { mode: 'gravity', availableHeadM: 0, pumpHeadM: 0, residualAtCriticalBar: 2.75 },
    },
    {
      name: 'PDAM 3 bar (30,6 m), butuh 20 m → suplai langsung, sisa di titik kritis 2,04 bar',
      input: { requiredHeadM: 20, residualM: 10.2, sourceHeadM: 30.6 },
      expected: {
        mode: 'direct_supply',
        availableHeadM: 30.6,
        pumpHeadM: 0,
        residualAtCriticalBar: 2.04,
      },
    },
    {
      name: 'PDAM 1,5 bar (15,3 m), butuh 65,2 m → booster 49,9 m, sisa tepat 1 bar',
      input: { requiredHeadM: 65.2, residualM: 10.2, sourceHeadM: 15.3 },
      expected: {
        mode: 'booster',
        availableHeadM: 15.3,
        pumpHeadM: 49.9,
        residualAtCriticalBar: 1,
      },
    },
    {
      name: 'sumur, butuh 65,2 m → pompa 65,2 m',
      input: { requiredHeadM: 65.2, residualM: 10.2, sourceHeadM: null },
      expected: { mode: 'pumped', availableHeadM: 0, pumpHeadM: 65.2, residualAtCriticalBar: 1 },
    },
  ],
  explain: (i, o, locale) => {
    const need = i.requiredHeadM;
    return localized(locale, {
      id:
        o.mode === 'gravity'
          ? `Reservoir di atas titik kritis: gravitasi memberi ${-need} m lebih dari yang dibutuhkan, tekanan sisa ±${o.residualAtCriticalBar} bar — tanpa pompa.`
          : o.mode === 'direct_supply'
            ? `Tekanan PDAM ${o.availableHeadM} m cukup untuk ${need} m yang dibutuhkan: suplai langsung tanpa pompa, sisa ±${o.residualAtCriticalBar} bar di titik kritis.`
            : o.mode === 'booster'
              ? `Tekanan PDAM ${o.availableHeadM} m kurang dari ${need} m yang dibutuhkan: pompa booster ${o.pumpHeadM} m menutup kekurangannya.`
              : `Sumber tanpa tekanan: pompa harus menyediakan ${o.pumpHeadM} m (beda tinggi, kehilangan, dan tekanan sisa).`,
      en:
        o.mode === 'gravity'
          ? `The reservoir sits above the critical point: gravity gives ${-need} m more than needed, residual about ${o.residualAtCriticalBar} bar — no pump.`
          : o.mode === 'direct_supply'
            ? `Mains pressure ${o.availableHeadM} m covers the ${need} m needed: direct supply without a pump, about ${o.residualAtCriticalBar} bar left at the critical point.`
            : o.mode === 'booster'
              ? `Mains pressure ${o.availableHeadM} m is below the ${need} m needed: a ${o.pumpHeadM} m booster pump covers the shortfall.`
              : `A source without pressure: the pump must supply ${o.pumpHeadM} m (static, losses and residual).`,
    });
  },
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
  ENG_409,
  ENG_410,
  ENG_411,
  ENG_412,
  ENG_413,
  ENG_414,
  ENG_415,
  ENG_416,
] as const;
