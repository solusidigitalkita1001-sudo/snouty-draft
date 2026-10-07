/**
 * Orkestrator jaringan cluster perumahan (fase 4): kebutuhan puncak dari jumlah sambungan
 * (ENG-405), lalu sizing jalur distribusi utama sebagai jalur bertekanan (Kelompok F). Murni.
 */

import { assumption } from './parameters/assumptions.js';
import {
  computePressurized,
  type PressurizedInput,
  type PressurizedResult,
} from './compute-pressurized.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import { ENG_405 } from './rules/group-h-gravity.js';

export interface NetworkInput {
  readonly connections: number;
  readonly routeLengthM: number;
  readonly staticHeadM: number;
  readonly personsPerConnection?: number;
  readonly litresPerPersonPerDay?: number;
  readonly peakFactor?: number;
  readonly residualPressureBar?: number;
  readonly material?: PressurizedInput['material'];
}

export interface NetworkResult extends PressurizedResult {
  readonly connections: number;
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
}

/** `locale` hanya memilih bahasa `explanation` di trace (P15-04b); angka tidak berubah. */
export function computeNetwork(
  input: NetworkInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
): NetworkResult {
  const applied: string[] = [];
  const use = (id: string): number => {
    applied.push(id);
    return assumption(id).value as number;
  };
  const demandInput = ENG_405.parseInput({
    connections: input.connections,
    personsPerConnection: input.personsPerConnection ?? use('PERSONS_PER_UNIT_4'),
    litresPerPersonPerDay: input.litresPerPersonPerDay ?? use('DEMAND_LPCD_150'),
    peakFactor: input.peakFactor ?? use('PEAK_HOUR_FACTOR_2'),
  });
  const demand = ENG_405.compute(demandInput);
  const demandTrace: CalculationTrace = {
    ruleId: ENG_405.ruleId,
    ruleVersion: ENG_405.version,
    inputs: demandInput,
    output: demand,
    provenance: gateEngineProvenance({
      ruleStatus: ENG_405.validationStatus,
      hasRealDimensions: false,
    }),
    explanation: ENG_405.explain(demandInput, demand, locale),
  };

  const residual = input.residualPressureBar ?? use('RESIDUAL_PRESSURE_FIXTURE');
  const pressurized = computePressurized(
    {
      designFlowLs: demand.peakFlowLs,
      routeLengthM: input.routeLengthM,
      staticHeadM: input.staticHeadM,
      residualPressureBar: residual,
      ...(input.material ? { material: input.material } : {}),
    },
    locale,
  );

  return {
    ...pressurized,
    connections: input.connections,
    averageFlowLs: demand.averageFlowLs,
    peakFlowLs: demand.peakFlowLs,
    traces: [demandTrace, ...pressurized.traces],
    appliedAssumptionIds: [...new Set([...applied, ...pressurized.appliedAssumptionIds])],
  };
}
