/**
 * Orkestrator kolam / tambak ikan (Fase 14). Satu panggilan, satu trace per aturan; nilai yang
 * tidak diberikan diambil dari registry asumsi dan dicatat di `appliedAssumptionIds`.
 * Murni, tanpa I/O.
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import { ENG_102 } from './rules/group-e-irrigation.js';
import { ENG_301, ENG_302, ENG_303, ENG_304, type PondBomLine } from './rules/group-g-pond.js';

export interface PondInput {
  readonly lengthM: number;
  readonly widthM: number;
  readonly depthM?: number;
  readonly ponds?: number;
  readonly fillTimeHours?: number;
  readonly drainTimeHours?: number;
  readonly routeLengthM?: number;
}

export interface PondResult {
  readonly areaM2: number;
  readonly volumeM3: number;
  readonly designFlowLs: number;
  readonly flowM3h: number;
  readonly inletSize: string;
  readonly inletFamily: 'PVC AW';
  readonly drainSize: string;
  readonly drainFamily: 'PVC D';
  readonly drainFlowLs: number;
  readonly ponds: number;
  readonly bom: readonly PondBomLine[];
  readonly appliedAssumptionIds: readonly string[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

/** `locale` hanya memilih bahasa `explanation` di trace (P15-04b); angka tidak berubah. */
export function computePond(
  input: PondInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
  /** Nilai asumsi yang diganti pengguna, per ID registry — menggantikan nilai baku. */
  overrides: AssumptionOverrides = {},
): PondResult {
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

  const depthM = input.depthM ?? use('POND_DEPTH_1M');
  const ponds = input.ponds ?? 1;
  const fillTimeHours = input.fillTimeHours ?? use('POND_FILL_TIME_3H');
  const drainTimeHours = input.drainTimeHours ?? use('POND_DRAIN_TIME_1H');
  const routeLengthM = input.routeLengthM ?? use('POND_INLET_ROUTE_10M');
  const inletVelocity = use('DESIGN_VELOCITY_PLASTIC');
  const drainVelocity = use('DRAIN_VELOCITY_GRAVITY');

  const volume = run(ENG_301, { lengthM: input.lengthM, widthM: input.widthM, depthM, ponds });
  const fill = run(ENG_302, { volumeM3: volume.volumeM3, fillTimeHours });
  const inlet = run(ENG_102, { designFlowLs: fill.designFlowLs, velocityMs: inletVelocity });
  const drain = run(ENG_303, {
    volumePerPondM3: volume.volumePerPondM3,
    drainTimeHours,
    drainVelocityMs: drainVelocity,
  });
  const bom = run(ENG_304, {
    ponds,
    lengthM: input.lengthM,
    depthM,
    routeLengthM,
    inletSize: inlet.mainSize,
    drainSize: drain.drainSize,
  });

  return {
    areaM2: volume.areaM2,
    volumeM3: volume.volumeM3,
    designFlowLs: fill.designFlowLs,
    flowM3h: fill.flowM3h,
    inletSize: inlet.mainSize,
    inletFamily: 'PVC AW',
    drainSize: drain.drainSize,
    drainFamily: 'PVC D',
    drainFlowLs: drain.drainFlowLs,
    ponds,
    bom: bom.lines,
    appliedAssumptionIds: [...new Set(applied)],
    traces,
    overallProvenance: traces.some((t) => t.provenance !== 'VERIFIED') ? 'ASSUMED' : 'VERIFIED',
  };
}
