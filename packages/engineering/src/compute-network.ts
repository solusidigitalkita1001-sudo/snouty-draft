/**
 * Orkestrator jaringan distribusi (cluster perumahan, jaringan air minum/SPAM): kebutuhan puncak
 * dari sambungan rumah — atau dari jiwa yang dilayani (ENG-408) — lalu jalur bertekanan
 * (Kelompok F). Satu panggilan, satu trace per aturan. Murni.
 *
 * Cluster (`kind: 'cluster'`): ENG-405 lalu satu pipa (tidak berubah).
 *
 * Jaringan air minum (`kind: 'water_supply'`, audit PDAM 2026-10-16):
 *   1. kebutuhan ENG-409 (domestik + non-domestik + kebocoran; hari maks, jam puncak);
 *   2. topologi ENG-414 — pipa induk + N cabang seragam; tanpa N: satu pipa bertanda asumsi;
 *   3. ukuran per segmen (Kelompok F): induk pada debit puncak, cabang pada debitnya sendiri;
 *   4. head jalur kritis ENG-415 (statis + kehilangan induk + cabang + tekanan sisa);
 *   5. mode sistem ENG-416 — gravitasi / suplai langsung PDAM / booster / pompa — lalu titik kerja
 *      pompa (ENG-206) hanya sebesar kekurangannya;
 *   6. reservoir ENG-410; kelas tekanan ENG-411 v2 dari tekanan kerja maksimum + surja (pompa).
 * Semua asumsi tercatat dan bisa diganti; tidak ada yang final sebelum divalidasi.
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
import { ENG_206, type PumpDutyResult } from './rules/group-f-pressurized.js';
import {
  ENG_405,
  ENG_408,
  ENG_409,
  ENG_410,
  ENG_411,
  ENG_414,
  ENG_415,
  ENG_416,
  type SupplyMode,
} from './rules/group-h-gravity.js';
import { barToHeadM, round2 } from './units.js';

export type NetworkKind = 'cluster' | 'water_supply';

export interface NetworkInput {
  /** Sambungan rumah; boleh kosong bila `population` (jiwa) diberikan. */
  readonly connections?: number;
  readonly population?: number;
  readonly routeLengthM: number;
  readonly staticHeadM: number;
  /** Baku `cluster`. */
  readonly kind?: NetworkKind;
  /** Jaringan air minum: jumlah cabang (0/kosong = tidak diketahui). */
  readonly branches?: number;
  /** Jaringan air minum: tekanan tersedia di sumber (PDAM) dalam bar; kosong = reservoir/sumur. */
  readonly sourcePressureBar?: number;
  readonly personsPerConnection?: number;
  readonly litresPerPersonPerDay?: number;
  readonly peakFactor?: number;
  readonly residualPressureBar?: number;
  readonly material?: PressurizedInput['material'];
}

export interface NetworkSegment {
  readonly flowLs: number;
  readonly lengthM: number;
  readonly size: string;
  readonly innerDiameterMm: number;
  readonly velocityMs: number;
  readonly frictionLossM: number;
  readonly minorLossM: number;
  /** Jumlah segmen sejenis (cabang: N); induk selalu 1. */
  readonly count: number;
}

/** Jaringan air minum: rincian kebutuhan, topologi, jalur kritis, mode, reservoir, kelas tekanan. */
export interface WaterSupplyPlan {
  readonly domesticAverageLs: number;
  readonly averageLs: number;
  readonly maxDayLs: number;
  readonly peakHourLs: number;
  readonly dailyVolumeM3: number;
  readonly reservoirM3: number;
  readonly topology: {
    readonly assumed: boolean;
    readonly branches: number;
    readonly connectionsPerBranch: number | null;
    readonly trunk: NetworkSegment;
    readonly branch: NetworkSegment | null;
  };
  readonly criticalPath: {
    readonly lossM: number;
    readonly residualM: number;
    readonly requiredHeadM: number;
  };
  readonly mode: {
    readonly kind: SupplyMode;
    readonly availableHeadM: number;
    readonly pumpHeadM: number;
    readonly residualAtCriticalBar: number;
  };
  /** Tekanan kerja maksimum di pipa (statis, sumber, atau head pompa). */
  readonly maxPressureBar: number;
  /** Tunjangan surja (hanya mode berpompa), dari laju gelombang × kecepatan. */
  readonly surgeBar: number;
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
const G = 9.81;

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
      hasRealDimensions: false,
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
  const residual = input.residualPressureBar ?? use('RESIDUAL_PRESSURE_FIXTURE');
  const material = input.material ? { material: input.material } : {};

  if (!spam) {
    const demand = run(ENG_405, {
      connections,
      personsPerConnection,
      litresPerPersonPerDay: input.litresPerPersonPerDay ?? use('DEMAND_LPCD_150'),
      peakFactor: input.peakFactor ?? use('PEAK_HOUR_FACTOR_2'),
    });
    const pressurized = computePressurized(
      {
        designFlowLs: demand.peakFlowLs,
        routeLengthM: input.routeLengthM,
        staticHeadM: input.staticHeadM,
        residualPressureBar: residual,
        ...material,
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
      supply: null,
      traces: [...traces, ...pressurized.traces],
      appliedAssumptionIds: [...new Set([...applied, ...pressurized.appliedAssumptionIds])],
    };
  }

  // 1 · kebutuhan
  const demand = run(ENG_409, {
    connections,
    personsPerConnection,
    litresPerPersonPerDay: input.litresPerPersonPerDay ?? use('SPAM_DEMAND_LPCD_100'),
    nonDomesticPercent: use('SPAM_NON_DOMESTIC_15PCT'),
    nrwPercent: use('SPAM_NRW_20PCT'),
    dayPeakFactor: use('SPAM_DAY_PEAK_1_15'),
    hourPeakFactor: input.peakFactor ?? use('SPAM_PEAK_HOUR_FACTOR_1_75'),
  });

  // 2 · topologi
  const topology = run(ENG_414, {
    connections,
    branches: Math.max(0, Math.round(input.branches ?? 0)),
    peakFlowLs: demand.peakHourLs,
    trunkLengthM: input.routeLengthM,
    branchLengthRatio: use('SPAM_BRANCH_LENGTH_RATIO_50PCT') / 100,
  });

  // 3 · ukuran per segmen — induk menanggung beda tinggi dan tekanan sisa (untuk pemilihan
  // ukurannya), cabang disaring kecepatan dan gradien pada debitnya sendiri.
  const trunk = computePressurized(
    {
      designFlowLs: topology.trunkFlowLs,
      routeLengthM: input.routeLengthM,
      staticHeadM: input.staticHeadM,
      residualPressureBar: residual,
      pumpRequired: false,
      ...material,
    },
    locale,
    overrides,
  );
  const branchRun =
    topology.branchFlowLs !== null && topology.branchLengthM !== null
      ? computePressurized(
          {
            designFlowLs: topology.branchFlowLs,
            routeLengthM: topology.branchLengthM,
            staticHeadM: 0,
            residualPressureBar: residual,
            pumpRequired: false,
            ...material,
          },
          locale,
          overrides,
        )
      : null;
  const segment = (r: PressurizedResult, flowLs: number, lengthM: number, count: number) => ({
    flowLs,
    lengthM,
    size: r.recommendedSize,
    innerDiameterMm: r.innerDiameterMm,
    velocityMs: r.velocityMs,
    frictionLossM: r.frictionLossM,
    minorLossM: r.minorLossM,
    count,
  });
  const trunkSegment = segment(trunk, topology.trunkFlowLs, input.routeLengthM, 1);
  const branchSegment =
    branchRun && topology.branchFlowLs !== null && topology.branchLengthM !== null
      ? segment(branchRun, topology.branchFlowLs, topology.branchLengthM, topology.branches)
      : null;

  // 4 · jalur kritis
  const critical = run(ENG_415, {
    staticHeadM: input.staticHeadM,
    trunkLossM: round2(trunk.frictionLossM + trunk.minorLossM),
    branchLossM: branchRun ? round2(branchRun.frictionLossM + branchRun.minorLossM) : 0,
    residualBar: residual,
  });

  // 5 · mode sistem dan pompa
  const sourceHeadM =
    input.sourcePressureBar === undefined ? null : round2(barToHeadM(input.sourcePressureBar));
  const mode = run(ENG_416, {
    requiredHeadM: critical.requiredHeadM,
    residualM: critical.residualM,
    sourceHeadM,
  });
  let pumpDuty: PumpDutyResult | null = null;
  if (mode.pumpHeadM > 0) {
    pumpDuty = run(ENG_206, {
      designFlowLs: demand.peakHourLs,
      totalDynamicHeadM: mode.pumpHeadM,
      efficiency: use('PUMP_EFFICIENCY_INDICATIVE'),
    });
  }

  // 6 · reservoir dan kelas tekanan
  const reservoir = run(ENG_410, {
    maxDayLs: demand.maxDayLs,
    fractionPercent: use('SPAM_RESERVOIR_20PCT'),
  });
  // Tekanan kerja maksimum di pipa: statis (reservoir di atas), tekanan sumber (PDAM), atau head
  // pompa ditambah tekanan sumber (booster memompa dari tekanan yang sudah ada).
  const maxHeadM = Math.max(
    Math.abs(input.staticHeadM),
    (sourceHeadM ?? 0) + mode.pumpHeadM,
    mode.availableHeadM,
  );
  const maxPressureBar = round2(maxHeadM / M_HEAD_PER_BAR);
  // Surja (Joukowsky sederhana) hanya bila ada pompa yang bisa berhenti mendadak.
  const waveSpeed =
    input.material === 'PVC' ? use('WAVE_SPEED_PVC_400MS') : use('WAVE_SPEED_PE_300MS');
  const surgeBar =
    mode.pumpHeadM > 0 ? round2((waveSpeed * trunk.velocityMs) / G / M_HEAD_PER_BAR) : 0;
  const cls = run(ENG_411, {
    maxPressureBar,
    surgeBar,
    marginPercent: use('PRESSURE_CLASS_MARGIN_10PCT'),
  });

  const supply: WaterSupplyPlan = {
    domesticAverageLs: demand.domesticAverageLs,
    averageLs: demand.averageLs,
    maxDayLs: demand.maxDayLs,
    peakHourLs: demand.peakHourLs,
    dailyVolumeM3: demand.dailyVolumeM3,
    reservoirM3: reservoir.reservoirM3,
    topology: {
      assumed: topology.topologyAssumed,
      branches: topology.branches,
      connectionsPerBranch: topology.connectionsPerBranch,
      trunk: trunkSegment,
      branch: branchSegment,
    },
    criticalPath: {
      lossM: critical.lossM,
      residualM: critical.residualM,
      requiredHeadM: critical.requiredHeadM,
    },
    mode: {
      kind: mode.mode,
      availableHeadM: mode.availableHeadM,
      pumpHeadM: mode.pumpHeadM,
      residualAtCriticalBar: mode.residualAtCriticalBar,
    },
    maxPressureBar,
    surgeBar,
    pressureClass: { pn: cls.pn, sdr: cls.sdr },
  };

  // Urutan trace = urutan hitung: kebutuhan, topologi, induk, cabang, jalur kritis, mode, pompa,
  // reservoir, kelas tekanan.
  const before = traces.filter(
    (t) => t.ruleId === 'ENG-408' || t.ruleId === 'ENG-409' || t.ruleId === 'ENG-414',
  );
  const after = traces.filter((t) => !before.includes(t));
  return {
    ...trunk,
    totalDynamicHeadM: Math.max(0, critical.requiredHeadM),
    pumpDuty,
    alternativeSize: null,
    kind,
    connections,
    averageFlowLs: demand.averageLs,
    peakFlowLs: demand.peakHourLs,
    supply,
    traces: [...before, ...trunk.traces, ...(branchRun ? branchRun.traces : []), ...after],
    appliedAssumptionIds: [
      ...new Set([
        ...applied,
        ...trunk.appliedAssumptionIds,
        ...(branchRun ? branchRun.appliedAssumptionIds : []),
      ]),
    ],
  };
}
