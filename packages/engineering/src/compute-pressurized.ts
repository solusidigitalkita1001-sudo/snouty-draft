/**
 * Orkestrator hidraulik bertekanan (fase 3): transfer pompa, sumur → tandon, dan jalur
 * bertekanan lain yang debit, panjang, dan tinggi statisnya diketahui. Satu panggilan, satu
 * trace per aturan — kembaran `computeIrrigation`. Murni, tanpa I/O.
 *
 * Nilai yang tidak diberikan pemanggil diambil dari registry asumsi dan DICATAT di
 * `appliedAssumptionIds`, supaya kartu "Asumsi sementara" menampilkannya dengan ID yang sama.
 */

import { assumption } from './parameters/assumptions.js';
import { sizeTableFor } from './parameters/size-tables.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import {
  ENG_201,
  ENG_202,
  ENG_203,
  ENG_204,
  ENG_205,
  ENG_206,
  type PumpDutyResult,
  type SizeCandidate,
} from './rules/group-f-pressurized.js';

export type PipeMaterial = 'PVC' | 'HDPE' | 'PPR' | 'Galvanis';

export interface PressurizedInput {
  readonly designFlowLs: number;
  readonly routeLengthM: number;
  /** Positif = tujuan lebih tinggi dari sumber. */
  readonly staticHeadM: number;
  /** Tekanan sisa yang dibutuhkan di titik keluar; kosong → asumsi margin. */
  readonly residualPressureBar?: number;
  readonly material?: PipeMaterial;
  /** `false` memaksa evaluasi gravitasi (tanpa titik kerja pompa); kosong → dari tinggi statis. */
  readonly pumpRequired?: boolean;
}

export interface PressurizedResult {
  readonly candidates: readonly SizeCandidate[];
  readonly recommendedSize: string;
  readonly alternativeSize: string | null;
  readonly allCriteriaMet: boolean;
  readonly innerDiameterMm: number;
  readonly velocityMs: number;
  readonly frictionLossM: number;
  readonly minorLossM: number;
  readonly totalDynamicHeadM: number;
  readonly hazenWilliamsC: number;
  readonly pumpDuty: PumpDutyResult | null;
  readonly appliedAssumptionIds: readonly string[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

function hazenWilliamsFor(material: PipeMaterial | undefined): { c: number; id: string } {
  const id = material === 'Galvanis' ? 'HAZEN_WILLIAMS_C_GALVANIZED' : 'HAZEN_WILLIAMS_C_PLASTIC';
  return { c: assumption(id).value as number, id };
}

export function computePressurized(input: PressurizedInput): PressurizedResult {
  const traces: CalculationTrace[] = [];
  const applied: string[] = [];
  const use = (id: string): number => {
    applied.push(id);
    return assumption(id).value as number;
  };

  function run<I, O>(rule: RuleVersion<I, O>, raw: unknown): O {
    const parsed = rule.parseInput(raw);
    const output = rule.compute(parsed);
    traces.push({
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      inputs: parsed,
      output,
      // Panjang dan tinggi dari kalimat pengguna, bukan ukuran lapangan → tidak VERIFIED di sini.
      provenance: gateEngineProvenance({
        ruleStatus: rule.validationStatus,
        hasRealDimensions: false,
      }),
      explanation: rule.explain(parsed, output),
    });
    return output;
  }

  const hw = hazenWilliamsFor(input.material);
  applied.push(hw.id);
  const residualPressureBar = input.residualPressureBar ?? use('TRANSFER_DISCHARGE_MARGIN');
  const velocityMinMs = use('VELOCITY_MIN_SELF_CLEANING');
  const velocityMaxMs = use('VELOCITY_MAX_PLASTIC');
  const gradientMaxMPer100m = use('HEADLOSS_GRADIENT_MAX');
  const minorLossFraction = use('MINOR_LOSS_FRACTION');

  const sizing = run(ENG_205, {
    designFlowLs: input.designFlowLs,
    lengthM: input.routeLengthM,
    staticHeadM: input.staticHeadM,
    residualPressureBar,
    hazenWilliamsC: hw.c,
    velocityMinMs,
    velocityMaxMs,
    gradientMaxMPer100m,
    minorLossFraction,
    // HDPE/MDPE dijual dalam mm (OD); PVC dalam inci — label hasil langsung cocok dengan katalog.
    sizeTable: sizeTableFor(input.material ?? 'PVC'),
  });
  const pick = sizing.candidates.find((c) => c.size === sizing.recommended)!;

  // Rantai perhitungan untuk ukuran terpilih — tiap langkah punya trace-nya sendiri.
  const velocity = run(ENG_201, {
    designFlowLs: input.designFlowLs,
    innerDiameterMm: pick.innerDiameterMm,
  });
  const friction = run(ENG_202, {
    designFlowLs: input.designFlowLs,
    innerDiameterMm: pick.innerDiameterMm,
    lengthM: input.routeLengthM,
    hazenWilliamsC: hw.c,
  });
  const minor = run(ENG_203, {
    frictionLossM: friction.frictionLossM,
    fraction: minorLossFraction,
  });
  const tdh = run(ENG_204, {
    staticHeadM: input.staticHeadM,
    frictionLossM: friction.frictionLossM,
    minorLossM: minor.minorLossM,
    residualPressureBar,
  });

  const pumpRequired = input.pumpRequired ?? input.staticHeadM >= 0;
  let pumpDuty: PumpDutyResult | null = null;
  if (pumpRequired) {
    pumpDuty = run(ENG_206, {
      designFlowLs: input.designFlowLs,
      totalDynamicHeadM: tdh.totalDynamicHeadM,
      efficiency: use('PUMP_EFFICIENCY_INDICATIVE'),
    });
  }

  return {
    candidates: sizing.candidates,
    recommendedSize: sizing.recommended,
    alternativeSize: sizing.alternative,
    allCriteriaMet: sizing.allCriteriaMet,
    innerDiameterMm: pick.innerDiameterMm,
    velocityMs: velocity.velocityMs,
    frictionLossM: friction.frictionLossM,
    minorLossM: minor.minorLossM,
    totalDynamicHeadM: tdh.totalDynamicHeadM,
    hazenWilliamsC: hw.c,
    pumpDuty,
    appliedAssumptionIds: [...new Set(applied)],
    traces,
    overallProvenance: traces.some((t) => t.provenance !== 'VERIFIED') ? 'ASSUMED' : 'VERIFIED',
  };
}
