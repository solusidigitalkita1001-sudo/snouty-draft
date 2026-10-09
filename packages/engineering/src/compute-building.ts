/**
 * Orkestrator air bersih gedung bertingkat (Kelompok I + F). Murni, tanpa I/O.
 *
 * Sistem yang dihitung adalah susunan baku gedung tinggi: tangki bawah → pompa transfer → tangki
 * atap → riser distribusi turun per zona, dengan katup penurun tekanan di zona bawah dan booster
 * di lantai teratas. Urutannya:
 *   1. penghuni (diberikan, atau dari luas lantai — ENG-501);
 *   2. kebutuhan harian, jam puncak, menit puncak (ENG-502);
 *   3. tinggi gedung, zona tekanan, lantai booster (ENG-503);
 *   4. pipa transfer + titik kerja pompa pada debit jam puncak (Kelompok F);
 *   5. riser distribusi pada debit menit puncak, dibagi beberapa riser bila satu riser PVC
 *      terbesar tidak memenuhi kriteria kecepatan/kerugian (ENG-504 + Kelompok F).
 */

import { assumption } from './parameters/assumptions.js';
import {
  computePressurized,
  type PipeMaterial,
  type PressurizedResult,
} from './compute-pressurized.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import type { RuleVersion } from './rule.js';
import {
  ENG_501,
  ENG_502,
  ENG_503,
  ENG_504,
  type BuildingDemandResult,
  type ZoningResult,
} from './rules/group-i-building.js';

/** Riser terbanyak yang dicoba sebelum menyerah pada satu ukuran yang belum memenuhi kriteria. */
const MAX_RISERS = 12;

export interface BuildingWaterInput {
  readonly floors: number;
  /** Diberikan pengguna; kosong → dari `floorAreaM2` (ENG-501). */
  readonly occupants?: number;
  readonly floorAreaM2?: number;
  readonly floorHeightM?: number;
  readonly litresPerPersonPerDay?: number;
  readonly residualPressureBar?: number;
  /** Jalur datar tambahan untuk transfer (tangki bawah ke kaki riser); kosong → hanya tinggi gedung. */
  readonly horizontalRunM?: number;
  readonly material?: PipeMaterial;
}

export interface BuildingWaterResult {
  readonly occupants: number;
  readonly occupantsEstimated: boolean;
  readonly demand: BuildingDemandResult;
  readonly zoning: ZoningResult;
  /** Pipa transfer tangki bawah → tangki atap, dengan titik kerja pompanya. */
  readonly transfer: PressurizedResult;
  readonly transferMaterial: PipeMaterial;
  readonly risers: number;
  readonly riserMaterial: PipeMaterial;
  /** Satu riser distribusi (debit per riser). */
  readonly riser: PressurizedResult;
  readonly appliedAssumptionIds: readonly string[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

/** Masukan tidak cukup untuk menghitung penghuni — pemanggil harus menanyakannya. */
export class BuildingOccupancyUnknownError extends Error {
  constructor() {
    super('jumlah penghuni atau luas lantai dibutuhkan');
    this.name = 'BuildingOccupancyUnknownError';
  }
}

export function computeBuildingWater(
  input: BuildingWaterInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
): BuildingWaterResult {
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
      explanation: rule.explain(parsed, output, locale),
    });
    return output;
  }

  let occupants = input.occupants;
  const occupantsEstimated = occupants === undefined;
  if (occupants === undefined) {
    if (input.floorAreaM2 === undefined) throw new BuildingOccupancyUnknownError();
    occupants = run(ENG_501, {
      floorAreaM2: input.floorAreaM2,
      floors: input.floors,
      areaPerPersonM2: use('OCCUPANT_AREA_10M2'),
    }).occupants;
  }

  const demand = run(ENG_502, {
    occupants,
    litresPerPersonPerDay: input.litresPerPersonPerDay ?? use('DEMAND_LPCD_150'),
    usageHours: use('USAGE_HOURS_10'),
    peakHourFactor: use('PEAK_HOUR_FACTOR_2'),
    peakMinuteFactor: use('PEAK_MINUTE_FACTOR_3'),
  });

  const floorHeightM = input.floorHeightM ?? use('FLOOR_HEIGHT_3_5M');
  const residualBar = input.residualPressureBar ?? use('RESIDUAL_PRESSURE_FIXTURE');
  const zoning = run(ENG_503, {
    floors: input.floors,
    floorHeightM,
    maxZoneBar: use('ZONE_MAX_STATIC_4BAR'),
    residualBar,
  });

  if (input.horizontalRunM === undefined) applied.push('TRANSFER_ROUTE_VERTICAL');
  const height = zoning.buildingHeightM;
  const { result: transfer, material: transferMaterial } = sized(
    {
      designFlowLs: demand.peakHourLs,
      routeLengthM: height + (input.horizontalRunM ?? 0),
      staticHeadM: height,
      pumpRequired: true,
    },
    input.material,
    locale,
  );

  // Riser turun dari tangki atap: gravitasi, tekanan sisa di lantai terbawah zona.
  let risers = 1;
  let riser = riserOf(
    {
      designFlowLs: demand.peakMinuteLs,
      routeLengthM: height,
      staticHeadM: -height,
      residualPressureBar: residualBar,
      pumpRequired: false,
    },
    input.material,
    locale,
  );
  while (!riser.allCriteriaMet && risers < MAX_RISERS) {
    risers += 1;
    riser = riserOf(
      {
        designFlowLs: demand.peakMinuteLs / risers,
        routeLengthM: height,
        staticHeadM: -height,
        residualPressureBar: residualBar,
        pumpRequired: false,
      },
      input.material,
      locale,
    );
  }
  run(ENG_504, { peakFlowLs: demand.peakMinuteLs, risers });

  const allTraces = [
    ...traces.slice(0, -1),
    ...transfer.traces,
    traces[traces.length - 1]!,
    ...riser.traces,
  ];
  const overallProvenance: Provenance = allTraces.every((t) => t.provenance === 'VERIFIED')
    ? 'VERIFIED'
    : 'ASSUMED';
  return {
    occupants,
    occupantsEstimated,
    demand,
    zoning,
    transfer,
    transferMaterial,
    risers,
    riserMaterial: input.material ?? 'PVC',
    riser,
    appliedAssumptionIds: [
      ...new Set([...applied, ...transfer.appliedAssumptionIds, ...riser.appliedAssumptionIds]),
    ],
    traces: allTraces,
    overallProvenance,
  };
}

/**
 * Sizing jalur transfer; bila PVC tidak punya ukuran yang memenuhi kriteria, HDPE
 * (tabel mm sampai 400) dicoba. Riser tidak (`riserOf`): riser dibagi, bukan diganti bahannya.
 */
function sized(
  line: Parameters<typeof computePressurized>[0],
  material: PipeMaterial | undefined,
  locale: EngineeringLocale,
): { readonly result: PressurizedResult; readonly material: PipeMaterial } {
  const first = computePressurized({ ...line, material: material ?? 'PVC' }, locale);
  if (first.allCriteriaMet || material !== undefined) {
    return { result: first, material: material ?? 'PVC' };
  }
  const hdpe = computePressurized({ ...line, material: 'HDPE' }, locale);
  return hdpe.allCriteriaMet
    ? { result: hdpe, material: 'HDPE' }
    : { result: first, material: 'PVC' };
}

function riserOf(
  line: Parameters<typeof computePressurized>[0],
  material: PipeMaterial | undefined,
  locale: EngineeringLocale,
): PressurizedResult {
  return computePressurized({ ...line, material: material ?? 'PVC' }, locale);
}
