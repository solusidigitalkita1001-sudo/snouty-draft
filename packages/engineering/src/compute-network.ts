/**
 * Orkestrator jaringan distribusi (cluster perumahan, jaringan air minum/SPAM): kebutuhan puncak
 * dari sambungan rumah (ENG-405) — atau dari jiwa yang dilayani (ENG-408) — lalu jalur bertekanan
 * (Kelompok F). Satu panggilan, satu trace per aturan. Murni.
 *
 * `kind` memilih asumsi kebutuhannya: cluster memakai kriteria perkotaan (150 l/orang/hari,
 * 4 orang/unit, faktor 2), jaringan air minum (P22-05) memakai kriteria SPAM (100 l/orang/hari,
 * 5 jiwa/SR, faktor jam puncak 1,75) — keduanya tercatat sebagai asumsi dan bisa diganti.
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import {
  computePressurized,
  type PressurizedInput,
  type PressurizedResult,
} from './compute-pressurized.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import { ENG_405, ENG_408 } from './rules/group-h-gravity.js';

export type NetworkKind = 'cluster' | 'water_supply';

export interface NetworkInput {
  /** Sambungan rumah; boleh kosong bila `population` (jiwa) diberikan. */
  readonly connections?: number;
  readonly population?: number;
  readonly routeLengthM: number;
  readonly staticHeadM: number;
  /** Baku `cluster`. */
  readonly kind?: NetworkKind;
  readonly personsPerConnection?: number;
  readonly litresPerPersonPerDay?: number;
  readonly peakFactor?: number;
  readonly residualPressureBar?: number;
  readonly material?: PressurizedInput['material'];
}

export interface NetworkResult extends PressurizedResult {
  readonly kind: NetworkKind;
  readonly connections: number;
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
}

export class NetworkInputError extends Error {
  constructor(detail: string) {
    super(`masukan jaringan tidak cukup: ${detail}`);
    this.name = 'NetworkInputError';
  }
}

export function computeNetwork(
  input: NetworkInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
  /** Nilai asumsi yang diganti pengguna, per ID registry — menggantikan nilai baku. */
  overrides: AssumptionOverrides = {},
): NetworkResult {
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
      explanation: rule.explain(parsed, output, locale),
    });
    return output;
  }

  const kind: NetworkKind = input.kind ?? 'cluster';
  const spam = kind === 'water_supply';
  const personsPerConnection =
    input.personsPerConnection ??
    (spam ? use('SPAM_PERSONS_PER_CONNECTION_5') : use('PERSONS_PER_UNIT_4'));
  const connections =
    input.connections ??
    (input.population === undefined
      ? undefined
      : run(ENG_408, { population: input.population, personsPerConnection }).connections);
  if (connections === undefined) {
    throw new NetworkInputError('butuh jumlah sambungan rumah atau jiwa yang dilayani');
  }
  const demand = run(ENG_405, {
    connections,
    personsPerConnection,
    litresPerPersonPerDay:
      input.litresPerPersonPerDay ?? (spam ? use('SPAM_DEMAND_LPCD_100') : use('DEMAND_LPCD_150')),
    peakFactor:
      input.peakFactor ?? (spam ? use('SPAM_PEAK_HOUR_FACTOR_1_75') : use('PEAK_HOUR_FACTOR_2')),
  });

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
    overrides,
  );

  return {
    ...pressurized,
    kind,
    connections,
    averageFlowLs: demand.averageFlowLs,
    peakFlowLs: demand.peakFlowLs,
    traces: [...traces, ...pressurized.traces],
    appliedAssumptionIds: [...new Set([...applied, ...pressurized.appliedAssumptionIds])],
  };
}
