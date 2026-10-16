/**
 * Orkestrator jaringan distribusi (cluster perumahan, jaringan air minum/SPAM): kebutuhan puncak
 * dari sambungan rumah — atau dari jiwa yang dilayani (ENG-408) — lalu jalur bertekanan
 * (Kelompok F). Satu panggilan, satu trace per aturan. Murni.
 *
 * `kind` memilih cara menghitung kebutuhannya: cluster memakai ENG-405 (150 l/orang/hari,
 * 4 orang/unit, faktor 2); jaringan air minum (P22-05, dilengkapi P22-08) memakai kriteria SPAM
 * ENG-409 — domestik + non-domestik + kebocoran, faktor hari maksimum dan jam puncak — lalu
 * volume reservoir (ENG-410) dan kelas tekanan pipa (ENG-411). Semua asumsinya tercatat dan bisa
 * diganti.
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
import { ENG_405, ENG_408, ENG_409, ENG_410, ENG_411 } from './rules/group-h-gravity.js';
import { round2 } from './units.js';

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

/** Jaringan air minum: rincian kebutuhan, reservoir, dan kelas tekanan (ENG-409/410/411). */
export interface WaterSupplyPlan {
  readonly domesticAverageLs: number;
  readonly averageLs: number;
  readonly maxDayLs: number;
  readonly peakHourLs: number;
  readonly dailyVolumeM3: number;
  readonly reservoirM3: number;
  /** Tekanan kerja maksimum di pipa: statis atau head pompa, mana yang lebih besar. */
  readonly maxPressureBar: number;
  readonly pressureClass: { readonly pn: number | null; readonly sdr: number | null };
}

export interface NetworkResult extends PressurizedResult {
  readonly kind: NetworkKind;
  readonly connections: number;
  readonly averageFlowLs: number;
  readonly peakFlowLs: number;
  /** Hanya `kind: 'water_supply'`. */
  readonly supply: WaterSupplyPlan | null;
}

export class NetworkInputError extends Error {
  constructor(detail: string) {
    super(`masukan jaringan tidak cukup: ${detail}`);
    this.name = 'NetworkInputError';
  }
}

const M_HEAD_PER_BAR = 10.197;

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

  let averageFlowLs: number;
  let peakFlowLs: number;
  let supplyDemand: ReturnType<typeof ENG_409.compute> | null = null;
  if (spam) {
    supplyDemand = run(ENG_409, {
      connections,
      personsPerConnection,
      litresPerPersonPerDay: input.litresPerPersonPerDay ?? use('SPAM_DEMAND_LPCD_100'),
      nonDomesticPercent: use('SPAM_NON_DOMESTIC_15PCT'),
      nrwPercent: use('SPAM_NRW_20PCT'),
      dayPeakFactor: use('SPAM_DAY_PEAK_1_15'),
      hourPeakFactor: input.peakFactor ?? use('SPAM_PEAK_HOUR_FACTOR_1_75'),
    });
    averageFlowLs = supplyDemand.averageLs;
    peakFlowLs = supplyDemand.peakHourLs;
  } else {
    const demand = run(ENG_405, {
      connections,
      personsPerConnection,
      litresPerPersonPerDay: input.litresPerPersonPerDay ?? use('DEMAND_LPCD_150'),
      peakFactor: input.peakFactor ?? use('PEAK_HOUR_FACTOR_2'),
    });
    averageFlowLs = demand.averageFlowLs;
    peakFlowLs = demand.peakFlowLs;
  }

  const residual = input.residualPressureBar ?? use('RESIDUAL_PRESSURE_FIXTURE');
  const pressurized = computePressurized(
    {
      designFlowLs: peakFlowLs,
      routeLengthM: input.routeLengthM,
      staticHeadM: input.staticHeadM,
      residualPressureBar: residual,
      ...(input.material ? { material: input.material } : {}),
    },
    locale,
    overrides,
  );

  let supply: WaterSupplyPlan | null = null;
  if (spam && supplyDemand) {
    const reservoir = run(ENG_410, {
      maxDayLs: supplyDemand.maxDayLs,
      fractionPercent: use('SPAM_RESERVOIR_20PCT'),
    });
    // Tekanan kerja maksimum: pipa gravitasi dari reservoir menanggung tinggi statisnya; pipa
    // dari pompa menanggung head pompa. Keduanya dalam meter kolom air.
    const maxPressureBar = round2(
      Math.max(Math.abs(input.staticHeadM), pressurized.totalDynamicHeadM) / M_HEAD_PER_BAR,
    );
    const cls = run(ENG_411, {
      maxPressureBar,
      marginPercent: use('PRESSURE_CLASS_MARGIN_10PCT'),
    });
    supply = {
      domesticAverageLs: supplyDemand.domesticAverageLs,
      averageLs: supplyDemand.averageLs,
      maxDayLs: supplyDemand.maxDayLs,
      peakHourLs: supplyDemand.peakHourLs,
      dailyVolumeM3: supplyDemand.dailyVolumeM3,
      reservoirM3: reservoir.reservoirM3,
      maxPressureBar,
      pressureClass: { pn: cls.pn, sdr: cls.sdr },
    };
  }

  // Trace kebutuhan dulu, lalu jalur bertekanan, lalu reservoir dan kelas tekanan — urutan hitung.
  const demandTraces = traces.filter((t) => t.ruleId !== 'ENG-410' && t.ruleId !== 'ENG-411');
  const afterTraces = traces.filter((t) => t.ruleId === 'ENG-410' || t.ruleId === 'ENG-411');
  return {
    ...pressurized,
    kind,
    connections,
    averageFlowLs,
    peakFlowLs,
    supply,
    traces: [...demandTraces, ...pressurized.traces, ...afterTraces],
    appliedAssumptionIds: [...new Set([...applied, ...pressurized.appliedAssumptionIds])],
  };
}
