/**
 * Orkestrator renovasi (P23-01) — lapisan di atas hitungan kasus mana pun. Kasusnya tetap
 * mengukur pipa untuk bagian yang dikerjakan; lapisan ini menambahkan apa yang hanya ada pada
 * instalasi yang sudah terpasang: pipa lama cukup atau tidak (ENG-901), cara menyambung ke pipa
 * lama (ENG-902), porsi pipa untuk penggantian sebagian (ENG-903), beban total (ENG-904). Murni.
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { HDPE_MM_SIZES, PVC_INCH_SIZES, PVC_LARGE_SIZES } from './parameters/size-tables.js';
import { gateEngineProvenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import {
  ENG_901,
  ENG_902,
  ENG_903,
  ENG_904,
  type ExistingMaterial,
  type TieInResult,
} from './rules/group-m-renovation.js';
import { parseInchLabel } from './units.js';

export type RenovationMode = 'new' | 'replace_all' | 'replace_partial' | 'extend';

/** Nilai protokol `work_type` (registry) → mode; satu tempat, dipakai API dan engine. */
export const WORK_TYPE_MODE: Readonly<Record<string, RenovationMode>> = {
  'Bangun baru': 'new',
  'Ganti semua pipa': 'replace_all',
  'Ganti sebagian': 'replace_partial',
  Perluasan: 'extend',
};

export function renovationModeOf(workType: unknown): RenovationMode {
  return typeof workType === 'string' ? (WORK_TYPE_MODE[workType] ?? 'new') : 'new';
}

/** Label bahan pipa lama (registry) → nilai aturan ENG-902; selain itu `unknown`. */
export function existingMaterialOf(label: unknown): ExistingMaterial {
  return label === 'PVC' || label === 'Galvanis / besi' || label === 'HDPE' || label === 'PPR'
    ? label
    : 'unknown';
}

/**
 * Diameter luar sebuah label ukuran: inci lewat tabel PRALON AW (PROD/STD-04), mm = OD ISO 4427.
 * `null` bila labelnya tidak terbaca — ukuran yang tidak dikenal tidak dibandingkan.
 */
export function outerDiameterMmOf(label: string): number | null {
  const mm = /^(\d+(?:[.,]\d+)?)\s*mm$/i.exec(label.trim());
  if (mm) {
    const value = Number(mm[1]!.replace(',', '.'));
    return HDPE_MM_SIZES.find((s) => s.outerMm === value)?.outerMm ?? value;
  }
  const inches = parseInchLabel(label);
  if (inches === null) return null;
  const row = [...PVC_INCH_SIZES, ...PVC_LARGE_SIZES].find(
    (s) => parseInchLabel(s.size) === inches,
  );
  return row?.outerMm ?? null;
}

export interface RenovationInput {
  readonly mode: Exclude<RenovationMode, 'new'>;
  /** Ukuran pipa utama/induk yang baru dihitung untuk bagian yang dikerjakan. */
  readonly newMainSize: string;
  /** Ukuran cabang baru yang disambung ke pipa lama (perluasan); kosong = pipa utama baru. */
  readonly branchSize?: string | null;
  readonly existingSize?: string | null;
  readonly existingMaterial?: string | null;
  /** Ukuran yang dibutuhkan beban total menurut aturan kasusnya; kosong = tidak bisa dihitung. */
  readonly requiredSizeForTotal?: string | null;
  readonly existingLoad?: number | null;
  readonly newLoad?: number | null;
  readonly loadUnit?: 'titik' | 'sambungan';
  readonly replacementLengthM?: number | null;
  readonly routeLengthM?: number | null;
}

export interface RenovationResult {
  readonly mode: Exclude<RenovationMode, 'new'>;
  readonly totalLoad: number | null;
  /** Perluasan: pipa lama dibandingkan dengan kebutuhan total; `null` bila datanya kurang. */
  readonly capacity: {
    readonly existingSize: string;
    readonly requiredSize: string;
    readonly sufficient: boolean;
    readonly marginPct: number;
  } | null;
  /** Mengapa kapasitas tidak dicek — supaya solusi menyebutnya, bukan diam. */
  readonly capacityUnchecked: 'no_existing_size' | 'no_total_size' | 'unknown_size' | null;
  readonly tieIn:
    (TieInResult & { readonly existingSize: string; readonly branchSize: string }) | null;
  readonly partial: {
    readonly ratio: number;
    readonly couplings: number;
    readonly lengthM: number;
  } | null;
  readonly traces: readonly CalculationTrace[];
  readonly appliedAssumptionIds: readonly string[];
}

export function computeRenovation(
  input: RenovationInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
  overrides: AssumptionOverrides = {},
): RenovationResult {
  const { use, applied } = assumptionReader(overrides);
  const traces: CalculationTrace[] = [];
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
      hasRealDimensions: false,
      explanation: rule.explain(parsed, output, locale),
    });
    return output;
  }

  let totalLoad: number | null = null;
  let capacity: RenovationResult['capacity'] = null;
  let capacityUnchecked: RenovationResult['capacityUnchecked'] = null;
  let tieIn: RenovationResult['tieIn'] = null;
  let partial: RenovationResult['partial'] = null;

  if (input.mode === 'extend') {
    const existingLoad = input.existingLoad ?? null;
    const newLoad = input.newLoad ?? null;
    if (existingLoad !== null && newLoad !== null) {
      totalLoad = run(ENG_904, {
        existingLoad,
        newLoad,
        unit: input.loadUnit ?? 'titik',
      }).totalLoad;
    }
    const existingSize = input.existingSize ?? null;
    const requiredSize = input.requiredSizeForTotal ?? null;
    if (existingSize === null) capacityUnchecked = 'no_existing_size';
    else if (requiredSize === null) capacityUnchecked = 'no_total_size';
    else {
      const existingOuterMm = outerDiameterMmOf(existingSize);
      const requiredOuterMm = outerDiameterMmOf(requiredSize);
      if (existingOuterMm === null || requiredOuterMm === null) capacityUnchecked = 'unknown_size';
      else {
        const out = run(ENG_901, { existingSize, existingOuterMm, requiredSize, requiredOuterMm });
        capacity = { existingSize, requiredSize, ...out };
      }
    }
    if (existingSize !== null) {
      const branchSize = input.branchSize ?? input.newMainSize;
      const out = run(ENG_902, {
        existingMaterial: existingMaterialOf(input.existingMaterial),
        existingSize,
        branchSize,
      });
      tieIn = { ...out, existingSize, branchSize };
    }
  }

  if (input.mode === 'replace_partial') {
    const couplings = use('RENOV_COUPLINGS_PER_SEGMENT_2');
    let lengthM = input.replacementLengthM ?? null;
    if (lengthM === null) {
      use('RENOV_REPLACE_WHOLE_ROUTE');
      lengthM = input.routeLengthM ?? null;
    }
    if (lengthM !== null) {
      partial = run(ENG_903, {
        replacementLengthM: lengthM,
        routeLengthM: input.routeLengthM ?? null,
        couplingsPerSegment: couplings,
      });
    }
  }

  return {
    mode: input.mode,
    totalLoad,
    capacity,
    capacityUnchecked,
    tieIn,
    partial,
    traces,
    appliedAssumptionIds: [...new Set(applied)],
  };
}
