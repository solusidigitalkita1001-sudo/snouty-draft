/**
 * Orkestrator saluran gravitasi (drainase, air hujan, gorong-gorong, jaringan air limbah) —
 * Kelompok H, fase 4. Satu panggilan, satu trace per aturan; default dari registry asumsi dicatat
 * di `appliedAssumptionIds`. Intensitas hujan WAJIB dari pemanggil: tidak ada asumsinya. Murni.
 *
 * Jaringan air limbah (`sewer`, P22-05): debit dari sambungan rumah atau jiwa (ENG-408 → ENG-406),
 * ukuran hidraulik Manning (ENG-402), lalu ukuran minimum pipa air limbah (ENG-407).
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import {
  ENG_401,
  ENG_402,
  ENG_403,
  ENG_404,
  ENG_406,
  ENG_407,
  ENG_408,
  culvertStructuralNote,
  type CulvertStructuralResult,
  type GravityCandidate,
} from './rules/group-h-gravity.js';

export type GravityKind = 'drainage' | 'stormwater' | 'culvert' | 'sewer';
export type TrafficLoad = 'light' | 'car' | 'heavy';

export interface GravityInput {
  readonly kind: GravityKind;
  /** Debit rencana; untuk `stormwater` boleh kosong bila tangkapan + hujan diberikan, untuk `sewer` bila sambungan/jiwa diberikan. */
  readonly designFlowLs?: number;
  readonly slopePercent?: number;
  /** Air hujan: luas tangkapan (ha), intensitas (mm/jam, wajib), koefisien limpasan. */
  readonly catchmentHa?: number;
  readonly rainfallMmPerHour?: number;
  readonly runoffCoefficient?: number;
  /** Gorong-gorong: timbunan di atas pipa dan beban lalu lintas. */
  readonly coverDepthM?: number;
  readonly trafficLoad?: TrafficLoad;
  /** Air limbah: sambungan rumah, atau jiwa yang dilayani bila sambungannya tidak disebut. */
  readonly connections?: number;
  readonly population?: number;
}

/** Air limbah: asal debit rencananya (ENG-406), untuk tampilan dan laporan. */
export interface SewerDemand {
  readonly connections: number;
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
  /** Ukuran hidraulik sebelum dinaikkan ke minimum pipa air limbah; sama bila tidak dinaikkan. */
  readonly hydraulicSize: string;
  readonly minimumSize: string;
}

export interface GravityResult {
  readonly kind: GravityKind;
  readonly designFlowLs: number;
  readonly slopePercent: number;
  readonly candidates: readonly GravityCandidate[];
  readonly recommendedSize: string;
  readonly innerDiameterMm: number;
  readonly fullFlowLs: number;
  readonly fullVelocityMs: number;
  readonly utilisationPercent: number;
  readonly allCriteriaMet: boolean;
  readonly structural: CulvertStructuralResult | null;
  /** Hanya `kind: 'sewer'`. */
  readonly sewer: SewerDemand | null;
  readonly appliedAssumptionIds: readonly string[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

export class GravityInputError extends Error {
  constructor(detail: string) {
    super(`masukan gravitasi tidak cukup: ${detail}`);
    this.name = 'GravityInputError';
  }
}

/** `locale` hanya memilih bahasa `explanation` di trace (P15-04b); angka tidak berubah. */
export function computeGravity(
  input: GravityInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
  /** Nilai asumsi yang diganti pengguna, per ID registry — menggantikan nilai baku. */
  overrides: AssumptionOverrides = {},
): GravityResult {
  const traces: CalculationTrace[] = [];
  const { use, applied } = assumptionReader(overrides);
  function run<I, O>(rule: RuleVersion<I, O>, raw: unknown): O {
    const parsed = rule.parseInput(raw);
    const output = rule.compute(parsed);
    traces.push({
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      inputs: parsed,
      output,
      provenance: gateEngineProvenance({
        ruleStatus: rule.validationStatus,
        hasRealDimensions: false,
      }),
      explanation: rule.explain(parsed, output, locale),
    });
    return output;
  }

  let designFlowLs = input.designFlowLs;
  if (designFlowLs === undefined && input.kind === 'stormwater') {
    if (input.catchmentHa === undefined || input.rainfallMmPerHour === undefined) {
      throw new GravityInputError('air hujan butuh luas tangkapan dan intensitas hujan setempat');
    }
    const runoff = input.runoffCoefficient ?? use('RUNOFF_C_RESIDENTIAL');
    designFlowLs = run(ENG_403, {
      catchmentHa: input.catchmentHa,
      rainfallMmPerHour: input.rainfallMmPerHour,
      runoffCoefficient: runoff,
    }).designFlowLs;
  }
  // Air limbah: sambungan (atau jiwa → sambungan) → debit rata-rata dan puncak.
  let sewerDemand: Omit<SewerDemand, 'hydraulicSize' | 'minimumSize'> | null = null;
  if (input.kind === 'sewer' && designFlowLs === undefined) {
    const personsPerConnection = use('SPAM_PERSONS_PER_CONNECTION_5');
    const connections =
      input.connections ??
      (input.population === undefined
        ? undefined
        : run(ENG_408, { population: input.population, personsPerConnection }).connections);
    if (connections === undefined) {
      throw new GravityInputError(
        'air limbah butuh jumlah sambungan rumah atau jiwa yang dilayani',
      );
    }
    const demand = run(ENG_406, {
      connections,
      personsPerConnection,
      litresPerPersonPerDay: use('SPAM_DEMAND_LPCD_100'),
      returnFactor: use('SEWER_RETURN_FACTOR_0_8'),
      peakFactor: use('SEWER_PEAK_FACTOR_2_5'),
    });
    designFlowLs = demand.peakFlowLs;
    sewerDemand = { connections, ...demand };
  }
  if (designFlowLs === undefined) throw new GravityInputError('debit rencana tidak diketahui');

  const slopePercent = input.slopePercent ?? use('GRAVITY_SLOPE_MIN_0_5');
  const manningN = use('MANNING_N_PLASTIC');
  const fillRatio = use('PIPE_FILL_RATIO_GRAVITY') / 100;
  const velocityMinMs = use('VELOCITY_MIN_SELF_CLEANING');

  const sizing = run(ENG_402, { designFlowLs, slopePercent, manningN, fillRatio, velocityMinMs });
  // Air limbah jaringan: tidak lebih kecil dari ukuran minimum pipa air limbah (ENG-407).
  let recommendedSize = sizing.recommended;
  let sewer: SewerDemand | null = null;
  if (input.kind === 'sewer') {
    const minimumSize = SEWER_MINIMUM_SIZE;
    const minimum = run(ENG_407, { recommendedSize: sizing.recommended, minimumSize });
    recommendedSize = minimum.size;
    sewer = sewerDemand
      ? { ...sewerDemand, hydraulicSize: sizing.recommended, minimumSize }
      : {
          // Debit diberikan langsung: tidak ada sambungan yang diketahui.
          connections: input.connections ?? 0,
          averageFlowLs: designFlowLs,
          peakFlowLs: designFlowLs,
          hydraulicSize: sizing.recommended,
          minimumSize,
        };
  }
  const pick = sizing.candidates.find((c) => c.size === recommendedSize)!;
  const full = run(ENG_401, { innerDiameterMm: pick.innerDiameterMm, slopePercent, manningN });

  let structural: CulvertStructuralResult | null = null;
  if (input.kind === 'culvert') {
    const coverDepthM = input.coverDepthM ?? use('CULVERT_COVER_MIN_0_6');
    const structuralInput = {
      innerDiameterMm: pick.innerDiameterMm,
      coverDepthM,
      trafficLoad: input.trafficLoad ?? 'car',
    } as const;
    const checked = run(ENG_404, structuralInput);
    // Trace menyimpan keluaran aturan apa adanya (catatan Indonesia); hasil yang dibaca
    // tampilan membawa catatan dalam bahasa percakapan, dari angka yang sama.
    structural = {
      ...checked,
      structuralNote: culvertStructuralNote(ENG_404.parseInput(structuralInput), checked, locale),
    };
  }

  return {
    kind: input.kind,
    designFlowLs,
    slopePercent,
    candidates: sizing.candidates,
    recommendedSize,
    innerDiameterMm: pick.innerDiameterMm,
    fullFlowLs: full.fullFlowLs,
    fullVelocityMs: full.fullVelocityMs,
    utilisationPercent: pick.utilisationPercent,
    allCriteriaMet: sizing.allCriteriaMet,
    structural,
    sewer,
    appliedAssumptionIds: [...new Set(applied)],
    traces,
    overallProvenance: traces.some((t) => t.provenance !== 'VERIFIED') ? 'ASSUMED' : 'VERIFIED',
  };
}

/**
 * Ukuran minimum pipa air limbah jaringan (150 mm ≈ 6"), kriteria umum perencanaan SPALD-T —
 * menunggu pengesahan ahli Pralon (OQ-70). Konstanta, bukan asumsi angka: pilihannya nama ukuran.
 */
export const SEWER_MINIMUM_SIZE = '6"';
