/**
 * Hasil engine gravitasi (Kelompok H: drainase, air hujan, gorong-gorong) dan jaringan cluster →
 * layar solusi. Kembaran `pressurized-view.ts`. **Fungsi murni.**
 */
import {
  applyAssumption,
  type GravityInput,
  type GravityResult,
  type NetworkInput,
  type NetworkResult,
  type TrafficLoad,
} from '@snouty/engineering';
import type {
  Assumption,
  BomItem,
  KeyValue,
  Provenance,
  RecommendationStats,
  RequirementState,
  SystemLine,
  TechnicalParameter,
} from '@snouty/shared-types';
import type { IdentifiedTrace } from './solution-view.js';

function traceIdsFor(traces: readonly IdentifiedTrace[], ...ruleIds: string[]): readonly string[] {
  return traces.filter((trace) => ruleIds.includes(trace.ruleId)).map((trace) => trace.id);
}
function explanationFor(traces: readonly IdentifiedTrace[], ruleId: string): string {
  return traces.find((trace) => trace.ruleId === ruleId)?.explanation ?? '';
}
function provenanceFor(traces: readonly IdentifiedTrace[], ids: readonly string[]): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  let worst: Provenance = 'VERIFIED';
  for (const trace of traces) {
    if (!ids.includes(trace.id)) continue;
    if (order.indexOf(trace.provenance) > order.indexOf(worst)) worst = trace.provenance;
  }
  return worst;
}
function numberOf(p: TechnicalParameter | undefined): number | undefined {
  return typeof p?.value === 'number' ? p.value : undefined;
}
const id = (n: number) => String(n).replace('.', ',');

const TRAFFIC: Readonly<Record<string, TrafficLoad>> = {
  'Pejalan kaki / motor': 'light',
  Mobil: 'car',
  'Truk / berat': 'heavy',
};

export interface GravityPlan {
  readonly input: GravityInput;
  /** Panjang pipa untuk BOM: panjang jalur, atau lebar jalan + 2 m untuk gorong-gorong. */
  readonly pipeLengthM: number | null;
}

/** Parameter universal kasus gravitasi → masukan engine; `null` = data inti belum cukup. */
export function gravityPlanFrom(state: RequirementState): GravityPlan | null {
  if (state.useCase?.kind !== 'technical') return null;
  const caseId = state.useCase.caseId;
  const p = state.useCase.parameters;
  const slopePercent = numberOf(p['slope']);
  const designFlowLs = numberOf(p['design_flow']);
  const routeLengthM = numberOf(p['route_length']);
  const opt = <T>(key: string, value: T | undefined): Partial<Record<string, T>> =>
    value === undefined ? {} : { [key]: value };

  if (caseId === 'gravity_drainage') {
    if (designFlowLs === undefined) return null;
    return {
      input: { kind: 'drainage', designFlowLs, ...opt('slopePercent', slopePercent) },
      pipeLengthM: routeLengthM ?? null,
    };
  }
  if (caseId === 'stormwater') {
    const catchmentHa = numberOf(p['catchment_area']) ?? numberOf(p['total_area']);
    const rainfallMmPerHour = numberOf(p['rainfall_intensity']);
    if (catchmentHa === undefined || rainfallMmPerHour === undefined) return null;
    return {
      input: {
        kind: 'stormwater',
        catchmentHa,
        rainfallMmPerHour,
        ...opt('runoffCoefficient', numberOf(p['runoff_coefficient'])),
        ...opt('slopePercent', slopePercent),
      },
      pipeLengthM: routeLengthM ?? null,
    };
  }
  if (caseId === 'culvert') {
    const roadWidthM = numberOf(p['road_width']);
    if (designFlowLs === undefined || roadWidthM === undefined) return null;
    const trafficLabel = p['traffic_load']?.value;
    const trafficLoad = typeof trafficLabel === 'string' ? TRAFFIC[trafficLabel] : undefined;
    return {
      input: {
        kind: 'culvert',
        designFlowLs,
        ...opt('slopePercent', slopePercent),
        ...opt('coverDepthM', numberOf(p['burial_depth'])),
        ...opt('trafficLoad', trafficLoad),
      },
      pipeLengthM: roadWidthM + 2,
    };
  }
  return null;
}

/** Parameter universal kasus cluster → masukan engine jaringan; `null` = data inti belum cukup. */
export function networkInputFrom(state: RequirementState): NetworkInput | null {
  if (state.useCase?.kind !== 'technical' || state.useCase.caseId !== 'residential_cluster')
    return null;
  const p = state.useCase.parameters;
  const connections = numberOf(p['number_of_connections']) ?? numberOf(p['number_of_units']);
  const routeLengthM = numberOf(p['route_length']);
  const staticHeadM = numberOf(p['static_head']);
  if (connections === undefined || routeLengthM === undefined || staticHeadM === undefined)
    return null;
  const residual = numberOf(p['required_pressure']);
  return {
    connections: Math.max(1, Math.round(connections)),
    routeLengthM,
    staticHeadM,
    ...(residual !== undefined ? { residualPressureBar: residual } : {}),
  };
}

const KIND_LABEL: Readonly<Record<GravityResult['kind'], string>> = {
  drainage: 'Saluran gravitasi',
  stormwater: 'Drainase air hujan',
  culvert: 'Gorong-gorong',
};

export function gravityHighlights(
  result: GravityResult,
  productCount: number,
): readonly KeyValue[] {
  const rows: KeyValue[] = [
    { label: 'Debit rencana', value: `${id(result.designFlowLs)} l/s` },
    { label: 'Pipa', value: `PVC D ${result.recommendedSize}` },
    { label: 'Kemiringan', value: `${id(result.slopePercent)} %` },
    {
      label: 'Kapasitas penuh',
      value: `${id(result.fullFlowLs)} l/s (${id(result.utilisationPercent)} % terpakai)`,
    },
  ];
  if (result.structural) {
    rows.push({
      label: 'Timbunan',
      value: result.structural.coverAdequate ? 'Memadai (awal)' : 'Perlu validasi struktural',
    });
  }
  rows.push({ label: 'Produk Pralon', value: `${productCount} item` });
  return rows;
}

export function gravityLegacyStats(
  result: GravityResult,
  productCount: number,
): RecommendationStats {
  return {
    outletCount: 1,
    mainSize: result.recommendedSize,
    branchCount: 1,
    fixtureConnectionSize: result.recommendedSize,
    productCount,
  };
}

export function gravitySystemLinesFrom(
  result: GravityResult,
  traces: readonly IdentifiedTrace[],
): readonly SystemLine[] {
  const main = traceIdsFor(traces, 'ENG-403', 'ENG-402', 'ENG-401');
  const lines: SystemLine[] = [
    {
      name: `${KIND_LABEL[result.kind]} PVC D`,
      path: result.kind === 'culvert' ? 'Hulu → hilir melintasi jalan' : 'Hulu → saluran buang',
      size: result.recommendedSize,
      reason: `${explanationFor(traces, 'ENG-403')} ${explanationFor(traces, 'ENG-402')}`.trim(),
      provenance: provenanceFor(traces, main),
      traceIds: main,
      role: 'main',
    },
  ];
  if (result.structural) {
    const ids = traceIdsFor(traces, 'ENG-404');
    lines.push({
      name: 'Timbunan dan beban jalan',
      path: 'Di atas gorong-gorong',
      size: `${id(result.structural.minimumCoverM)} m min.`,
      reason: result.structural.structuralNote,
      provenance: 'ASSUMED',
      traceIds: ids,
      role: 'fitting',
    });
  }
  return lines;
}

const ROD_METERS = 4;

export function gravityBomItemsFrom(
  result: GravityResult,
  pipeLengthM: number | null,
  traces: readonly IdentifiedTrace[],
): readonly BomItem[] {
  const ids = traceIdsFor(traces, 'ENG-402');
  const provenance = provenanceFor(traces, ids);
  const basis =
    `${explanationFor(traces, 'ENG-402')} ${pipeLengthM === null ? 'Panjang jalur belum disebut — kuantitas pipa menyusul.' : 'Kuantitas fitting: perkiraan tata letak.'}`.trim();
  const row = (
    item: string,
    quantity: number,
    unit: BomItem['unit'],
    size = result.recommendedSize,
  ): BomItem => ({
    item,
    size,
    quantity,
    unit,
    basis,
    provenance,
    traceIds: ids,
  });
  const lines: BomItem[] = [];
  if (pipeLengthM !== null)
    lines.push(row('Pipa PVC D', Math.ceil(pipeLengthM / ROD_METERS), 'batang'));
  if (result.kind === 'culvert') {
    lines.push(row('Kepala gorong-gorong / selubung beton (di luar perpipaan)', 2, 'pcs', '-'));
  } else {
    lines.push(row('Elbow 45°', 2, 'pcs'));
    lines.push(row('Tee / bak kontrol sambungan', 1, 'pcs'));
  }
  lines.push(row('Lem PVC', 1, 'kaleng', '-'));
  return lines;
}

export function gravityAssumptionsFrom(
  result: GravityResult,
  traces: readonly IdentifiedTrace[],
): readonly Assumption[] {
  const pending = [
    ...new Set(traces.filter((t) => t.provenance !== 'VERIFIED').map((t) => t.ruleId)),
  ].join(', ');
  const fieldFor = (parameter: string): string =>
    parameter === 'slope'
      ? 'slope'
      : parameter === 'runoff_coefficient'
        ? 'runoff_coefficient'
        : parameter === 'burial_depth'
          ? 'burial_depth'
          : 'design_flow';
  const rows: Assumption[] = [
    {
      text: `Rumus saluran gravitasi (${pending}) adalah rumus teknik baku yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final.`,
      fieldPath: 'design_flow',
      ruleId: 'ENG-402',
    },
    ...result.appliedAssumptionIds.map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: a.description,
        fieldPath: fieldFor(a.parameter),
        ruleId: 'ENG-402',
        assumptionId: a.id,
      };
    }),
  ];
  if (result.kind === 'culvert') {
    rows.push({
      text: 'Gorong-gorong dihitung hidrauliknya saja; kelas kekakuan pipa, pemadatan, dan selubung beton wajib diperiksa tim teknis (struktur).',
      fieldPath: 'traffic_load',
      ruleId: 'ENG-404',
    });
  }
  return rows;
}

export function gravityProse(result: GravityResult): { headline: string; body: string } {
  const label = KIND_LABEL[result.kind];
  const structural = result.structural
    ? result.structural.coverAdequate
      ? ` Timbunan di atas pipa memenuhi minimum awal ${id(result.structural.minimumCoverM)} m; struktur tetap diperiksa tim teknis.`
      : ` Timbunan di atas pipa belum memenuhi minimum awal ${id(result.structural.minimumCoverM)} m — butuh selubung beton atau pipa kelas kekakuan tinggi, wajib validasi struktural.`
    : '';
  return {
    headline: `${label}: pipa PVC D ${result.recommendedSize} untuk ${id(result.designFlowLs)} l/s pada kemiringan ${id(result.slopePercent)} %`,
    body: `Pada kemiringan ${id(result.slopePercent)} %, pipa ${result.recommendedSize} mengalirkan ${id(result.fullFlowLs)} l/s saat penuh dengan kecepatan ${id(result.fullVelocityMs)} m/s; debit rencana ${id(result.designFlowLs)} l/s memakai ${id(result.utilisationPercent)} % kapasitasnya sehingga masih ada ruang udara.${structural} Perkiraan awal, bukan desain final.`,
  };
}

/** Cluster: highlight tambahan di depan highlight jalur bertekanan. */
export function networkHighlightsPrefix(result: NetworkResult): readonly KeyValue[] {
  return [
    { label: 'Sambungan', value: `${result.connections} unit` },
    {
      label: 'Kebutuhan puncak',
      value: `${id(result.peakFlowLs)} l/s (rata-rata ${id(result.averageFlowLs)} l/s)`,
    },
  ];
}
