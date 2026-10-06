/**
 * Hasil engine hidraulik bertekanan (Kelompok F) + trace → layar solusi, untuk kasus teknis
 * `pump_transfer` dan `well_distribution`. Kembaran `pond-view.ts`; invarian T-1 sama.
 * **Fungsi murni.**
 */
import {
  HDPE_FROM_METERS,
  applyAssumption,
  type PipeMaterial,
  type PressurizedInput,
  type PressurizedResult,
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

const MATERIAL: Readonly<Record<string, PipeMaterial>> = {
  'PVC (uPVC)': 'PVC',
  HDPE: 'HDPE',
  PPR: 'PPR',
  Galvanis: 'Galvanis',
};

export interface PressurizedPlan {
  readonly input: PressurizedInput;
  /** Keluarga produk untuk pipa utama. */
  readonly family: 'PVC AW' | 'HDPE' | 'PPR' | 'Galvanis';
  /** Asumsi registry yang dipakai di luar engine (pemilihan bahan). */
  readonly extraAssumptionIds: readonly string[];
}

/**
 * Parameter universal kasus bertekanan → masukan engine. Sumur: tinggi statis = kedalaman sumur +
 * tinggi tandon bila tidak disebut langsung. `null` = data inti belum cukup.
 */
export function pressurizedPlanFrom(state: RequirementState): PressurizedPlan | null {
  if (state.useCase?.kind !== 'technical') return null;
  const caseId = state.useCase.caseId;
  if (caseId !== 'pump_transfer' && caseId !== 'well_distribution') return null;
  const p = state.useCase.parameters;

  const designFlowLs = numberOf(p['design_flow']);
  const routeLengthM = numberOf(p['route_length']);
  let staticHeadM = numberOf(p['static_head']);
  if (staticHeadM === undefined && caseId === 'well_distribution') {
    const well = numberOf(p['well_depth']);
    if (well !== undefined) staticHeadM = well + (numberOf(p['tank_elevation']) ?? 0);
  }
  if (designFlowLs === undefined || routeLengthM === undefined || staticHeadM === undefined) {
    return null;
  }

  const materialLabel = p['material']?.value;
  const material = typeof materialLabel === 'string' ? MATERIAL[materialLabel] : undefined;
  const extra: string[] = [];
  let family: PressurizedPlan['family'];
  if (material) {
    family = material === 'PVC' ? 'PVC AW' : material;
  } else if (routeLengthM >= HDPE_FROM_METERS) {
    family = 'HDPE';
    extra.push('HDPE_MAIN_FROM_200M');
  } else {
    family = 'PVC AW';
  }

  const requiredPressureBar = numberOf(p['required_pressure']);
  const pumpRequired = p['pump_required']?.value;
  return {
    input: {
      designFlowLs,
      routeLengthM,
      staticHeadM,
      ...(requiredPressureBar !== undefined ? { residualPressureBar: requiredPressureBar } : {}),
      ...(material ? { material } : {}),
      ...(typeof pumpRequired === 'boolean' ? { pumpRequired } : {}),
    },
    family,
    extraAssumptionIds: extra,
  };
}

const id = (n: number) => String(n).replace('.', ',');

export function pressurizedHighlights(
  result: PressurizedResult,
  family: string,
  productCount: number,
): readonly KeyValue[] {
  const pump = result.pumpDuty
    ? `${id(result.pumpDuty.flowM3h)} m³/jam @ ${id(result.pumpDuty.headM)} m`
    : 'Gravitasi, tanpa pompa';
  return [
    { label: 'Pipa utama', value: `${family} ${result.recommendedSize}` },
    { label: 'Kecepatan', value: `${id(result.velocityMs)} m/s` },
    { label: 'Kerugian gesek', value: `${id(result.frictionLossM)} m` },
    { label: 'Head total', value: `${id(result.totalDynamicHeadM)} m` },
    { label: 'Titik kerja pompa', value: pump },
    { label: 'Produk Pralon', value: `${productCount} item` },
  ];
}

export function pressurizedLegacyStats(
  result: PressurizedResult,
  productCount: number,
): RecommendationStats {
  return {
    outletCount: 1,
    mainSize: result.recommendedSize,
    branchCount: 1,
    fixtureConnectionSize: result.alternativeSize ?? result.recommendedSize,
    productCount,
  };
}

export function pressurizedSystemLinesFrom(
  result: PressurizedResult,
  family: string,
  traces: readonly IdentifiedTrace[],
): readonly SystemLine[] {
  const main = traceIdsFor(traces, 'ENG-205', 'ENG-201', 'ENG-202');
  const head = traceIdsFor(traces, 'ENG-203', 'ENG-204', 'ENG-206');
  const lines: SystemLine[] = [
    {
      name: `Pipa utama ${family}`,
      path: 'Sumber → tujuan',
      size: result.recommendedSize,
      reason: explanationFor(traces, 'ENG-205'),
      provenance: provenanceFor(traces, main),
      traceIds: main,
      role: 'main',
    },
    {
      name: result.pumpDuty ? 'Pompa (titik kerja)' : 'Aliran gravitasi',
      path: 'Sumber → pipa utama',
      size: result.pumpDuty
        ? `${id(result.pumpDuty.flowM3h)} m³/jam @ ${id(result.pumpDuty.headM)} m`
        : `${id(result.totalDynamicHeadM)} m head`,
      reason: `${explanationFor(traces, 'ENG-204')} ${explanationFor(traces, 'ENG-206')}`.trim(),
      provenance: provenanceFor(traces, head),
      traceIds: head,
      role: 'fitting',
    },
  ];
  if (result.alternativeSize) {
    const alt = result.candidates.find((c) => c.size === result.alternativeSize)!;
    lines.push({
      name: `Alternatif ${family}`,
      path: 'Sumber → tujuan',
      size: alt.size,
      reason: `Satu ukuran di atasnya: kecepatan ${id(alt.velocityMs)} m/s, kerugian gesek ${id(alt.frictionLossM)} m, head total ${id(alt.totalDynamicHeadM)} m — pompa lebih kecil, biaya pipa lebih tinggi.`,
      provenance: provenanceFor(traces, main),
      traceIds: main,
      role: 'branch',
    });
  }
  return lines;
}

const ROD_METERS = 4;

/** BOM tata letak sederhana: pipa utama, elbow, katup, fitting pompa. */
export function pressurizedBomItemsFrom(
  result: PressurizedResult,
  family: string,
  routeLengthM: number,
  traces: readonly IdentifiedTrace[],
): readonly BomItem[] {
  const ids = traceIdsFor(traces, 'ENG-205');
  const basis = `${explanationFor(traces, 'ENG-205')} Kuantitas fitting: perkiraan tata letak (4 belokan, katup di kedua ujung, satu katup searah bila dipompa).`;
  const provenance = provenanceFor(traces, ids);
  const size = result.recommendedSize;
  const row = (item: string, quantity: number, unit: BomItem['unit']): BomItem => ({
    item,
    size,
    quantity,
    unit,
    basis,
    provenance,
    traceIds: ids,
  });
  const lines: BomItem[] = [
    family === 'HDPE'
      ? row('Pipa HDPE', Math.ceil(routeLengthM), 'meter')
      : row(`Pipa ${family}`, Math.ceil(routeLengthM / ROD_METERS), 'batang'),
    row('Elbow 90°', 4, 'pcs'),
    row('Katup / stop kran', 2, 'pcs'),
  ];
  if (result.pumpDuty) {
    lines.push(row('Katup searah (check valve)', 1, 'pcs'));
    lines.push(row('Sok drat / adaptor pompa', 2, 'pcs'));
  }
  if (family !== 'HDPE') lines.push({ ...row('Lem PVC', 1, 'kaleng'), size: '-' });
  return lines;
}

export function pressurizedAssumptionsFrom(
  result: PressurizedResult,
  extraAssumptionIds: readonly string[],
  traces: readonly IdentifiedTrace[],
): readonly Assumption[] {
  const pending = [
    ...new Set(traces.filter((t) => t.provenance !== 'VERIFIED').map((t) => t.ruleId)),
  ].join(', ');
  const fieldFor = (parameter: string): string =>
    parameter === 'required_pressure'
      ? 'required_pressure'
      : parameter === 'material'
        ? 'material'
        : parameter === 'pump_power'
          ? 'pump_required'
          : 'design_flow';
  return [
    {
      text: `Rumus hidraulik (${pending}) adalah rumus teknik baku yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final; pompa dipilih dari kurva pabrikan, bukan dari angka ini saja.`,
      fieldPath: 'design_flow',
      ruleId: 'ENG-205',
    },
    ...[...result.appliedAssumptionIds, ...extraAssumptionIds].map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: a.description,
        fieldPath: fieldFor(a.parameter),
        ruleId: 'ENG-205',
        assumptionId: a.id,
      };
    }),
  ];
}

/** Prosa deterministik — setiap angka dari hasil hitungan (REC-1). */
export function pressurizedProse(
  result: PressurizedResult,
  family: string,
  input: PressurizedInput,
): { headline: string; body: string } {
  const pump = result.pumpDuty
    ? ` dan pompa ${id(result.pumpDuty.flowM3h)} m³/jam pada head ${id(result.pumpDuty.headM)} m`
    : '';
  const alt = result.alternativeSize
    ? ` Alternatifnya ${result.alternativeSize}: kerugian lebih kecil, pompa lebih ringan, pipa lebih mahal.`
    : '';
  return {
    headline: `Pipa ${family} ${result.recommendedSize}${pump} untuk ${id(input.designFlowLs)} l/s sejauh ${id(input.routeLengthM)} m`,
    body: `Pada ${id(input.designFlowLs)} l/s, pipa ${result.recommendedSize} mengalirkan air ${id(result.velocityMs)} m/s dengan kerugian gesek ${id(result.frictionLossM)} m sepanjang ${id(input.routeLengthM)} m. Ditambah beda tinggi ${id(Math.max(0, input.staticHeadM))} m, kerugian fitting ${id(result.minorLossM)} m, dan tekanan sisa di ujung, head total yang harus diatasi ${id(result.totalDynamicHeadM)} m.${result.pumpDuty ? ` Pompanya harus mampu ${id(result.pumpDuty.flowM3h)} m³/jam pada head itu (daya hidraulik ${id(result.pumpDuty.hydraulicPowerKw)} kW, daya poros indikatif ±${id(result.pumpDuty.indicativeShaftPowerKw)} kW).` : ''}${alt} Perkiraan awal, bukan desain final.`,
  };
}
