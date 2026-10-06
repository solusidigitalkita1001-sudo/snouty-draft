/**
 * Orkestrator saluran gravitasi (drainase, air hujan, gorong-gorong) — Kelompok H, fase 4.
 * Satu panggilan, satu trace per aturan; default dari registry asumsi dicatat di
 * `appliedAssumptionIds`. Intensitas hujan WAJIB dari pemanggil: tidak ada asumsinya. Murni.
 */

import { assumption } from './parameters/assumptions.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import {
  ENG_401,
  ENG_402,
  ENG_403,
  ENG_404,
  type CulvertStructuralResult,
  type GravityCandidate,
} from './rules/group-h-gravity.js';

export type GravityKind = 'drainage' | 'stormwater' | 'culvert';
export type TrafficLoad = 'light' | 'car' | 'heavy';

export interface GravityInput {
  readonly kind: GravityKind;
  /** Debit rencana; untuk `stormwater` boleh kosong bila tangkapan + hujan diberikan. */
  readonly designFlowLs?: number;
  readonly slopePercent?: number;
  /** Air hujan: luas tangkapan (ha), intensitas (mm/jam, wajib), koefisien limpasan. */
  readonly catchmentHa?: number;
  readonly rainfallMmPerHour?: number;
  readonly runoffCoefficient?: number;
  /** Gorong-gorong: timbunan di atas pipa dan beban lalu lintas. */
  readonly coverDepthM?: number;
  readonly trafficLoad?: TrafficLoad;
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

export function computeGravity(input: GravityInput): GravityResult {
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
      provenance: gateEngineProvenance({
        ruleStatus: rule.validationStatus,
        hasRealDimensions: false,
      }),
      explanation: rule.explain(parsed, output),
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
  if (designFlowLs === undefined) throw new GravityInputError('debit rencana tidak diketahui');

  const slopePercent =
    input.slopePercent ??
    (input.kind === 'culvert' ? use('GRAVITY_SLOPE_MIN_0_5') : use('GRAVITY_SLOPE_MIN_0_5'));
  const manningN = use('MANNING_N_PLASTIC');
  const fillRatio = use('PIPE_FILL_RATIO_GRAVITY') / 100;
  const velocityMinMs = use('VELOCITY_MIN_SELF_CLEANING');

  const sizing = run(ENG_402, { designFlowLs, slopePercent, manningN, fillRatio, velocityMinMs });
  const pick = sizing.candidates.find((c) => c.size === sizing.recommended)!;
  const full = run(ENG_401, { innerDiameterMm: pick.innerDiameterMm, slopePercent, manningN });

  let structural: CulvertStructuralResult | null = null;
  if (input.kind === 'culvert') {
    const coverDepthM = input.coverDepthM ?? use('CULVERT_COVER_MIN_0_6');
    structural = run(ENG_404, {
      innerDiameterMm: pick.innerDiameterMm,
      coverDepthM,
      trafficLoad: input.trafficLoad ?? 'car',
    });
  }

  return {
    kind: input.kind,
    designFlowLs,
    slopePercent,
    candidates: sizing.candidates,
    recommendedSize: sizing.recommended,
    innerDiameterMm: pick.innerDiameterMm,
    fullFlowLs: full.fullFlowLs,
    fullVelocityMs: full.fullVelocityMs,
    utilisationPercent: pick.utilisationPercent,
    allCriteriaMet: sizing.allCriteriaMet,
    structural,
    appliedAssumptionIds: [...new Set(applied)],
    traces,
    overallProvenance: traces.some((t) => t.provenance !== 'VERIFIED') ? 'ASSUMED' : 'VERIFIED',
  };
}
