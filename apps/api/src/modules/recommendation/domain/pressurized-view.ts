/**
 * Hasil engine hidraulik bertekanan (Kelompok F) + trace → layar solusi, untuk kasus teknis
 * `pump_transfer` dan `well_distribution`. Kembaran `pond-view.ts`; invarian T-1 sama.
 * **Fungsi murni.**
 */
import {
  HDPE_FROM_METERS,
  applyAssumption,
  assumptionDescription,
  type PipeMaterial,
  type PressurizedInput,
  type PressurizedResult,
} from '@snouty/engineering';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
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
      // Bahan ikut ke engine juga saat dipilih dari panjang jalur: HDPE memakai tabel ukuran mm.
      ...(material ? { material } : family === 'HDPE' ? { material: 'HDPE' as const } : {}),
      ...(typeof pumpRequired === 'boolean' ? { pumpRequired } : {}),
    },
    family,
    extraAssumptionIds: extra,
  };
}

const idNum = (n: number) => String(n).replace('.', ',');
/** Indonesia: koma desimal (tak berubah); Inggris: titik desimal tanpa pemisah ribuan. */
const id = (n: number, locale: Locale = DEFAULT_LOCALE): string =>
  locale === 'en'
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })
    : idNum(n);

export function pressurizedHighlights(
  result: PressurizedResult,
  family: string,
  productCount: number,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  const en = locale === 'en';
  const pump = result.pumpDuty
    ? `${id(result.pumpDuty.flowM3h, locale)} ${en ? 'm³/h' : 'm³/jam'} @ ${id(result.pumpDuty.headM, locale)} m`
    : en
      ? 'Gravity, no pump'
      : 'Gravitasi, tanpa pompa';
  return [
    { label: en ? 'Main pipe' : 'Pipa utama', value: `${family} ${result.recommendedSize}` },
    { label: en ? 'Velocity' : 'Kecepatan', value: `${id(result.velocityMs, locale)} m/s` },
    {
      label: en ? 'Friction loss' : 'Kerugian gesek',
      value: `${id(result.frictionLossM, locale)} m`,
    },
    { label: en ? 'Total head' : 'Head total', value: `${id(result.totalDynamicHeadM, locale)} m` },
    { label: en ? 'Pump duty point' : 'Titik kerja pompa', value: pump },
    { label: en ? 'Pralon products' : 'Produk Pralon', value: `${productCount} item` },
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
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const main = traceIdsFor(traces, 'ENG-205', 'ENG-201', 'ENG-202');
  const head = traceIdsFor(traces, 'ENG-203', 'ENG-204', 'ENG-206');
  const lines: SystemLine[] = [
    {
      name: en ? `${family} main pipe` : `Pipa utama ${family}`,
      path: en ? 'Source → destination' : 'Sumber → tujuan',
      size: result.recommendedSize,
      reason: explanationFor(traces, 'ENG-205'),
      provenance: provenanceFor(traces, main),
      traceIds: main,
      role: 'main',
    },
    {
      name: result.pumpDuty
        ? en
          ? 'Pump (duty point)'
          : 'Pompa (titik kerja)'
        : en
          ? 'Gravity flow'
          : 'Aliran gravitasi',
      path: en ? 'Source → main pipe' : 'Sumber → pipa utama',
      size: result.pumpDuty
        ? `${id(result.pumpDuty.flowM3h, locale)} ${en ? 'm³/h' : 'm³/jam'} @ ${id(result.pumpDuty.headM, locale)} m`
        : `${id(result.totalDynamicHeadM, locale)} m head`,
      reason: `${explanationFor(traces, 'ENG-204')} ${explanationFor(traces, 'ENG-206')}`.trim(),
      provenance: provenanceFor(traces, head),
      traceIds: head,
      role: 'fitting',
    },
  ];
  if (result.alternativeSize) {
    const alt = result.candidates.find((c) => c.size === result.alternativeSize)!;
    lines.push({
      name: en ? `${family} alternative` : `Alternatif ${family}`,
      path: en ? 'Source → destination' : 'Sumber → tujuan',
      size: alt.size,
      reason: en
        ? `One size up: velocity ${id(alt.velocityMs, locale)} m/s, friction loss ${id(alt.frictionLossM, locale)} m, total head ${id(alt.totalDynamicHeadM, locale)} m — smaller pump, higher pipe cost.`
        : `Satu ukuran di atasnya: kecepatan ${id(alt.velocityMs)} m/s, kerugian gesek ${id(alt.frictionLossM)} m, head total ${id(alt.totalDynamicHeadM)} m — pompa lebih kecil, biaya pipa lebih tinggi.`,
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
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const en = locale === 'en';
  const ids = traceIdsFor(traces, 'ENG-205');
  const basis = en
    ? `${explanationFor(traces, 'ENG-205')} Fitting quantities: layout estimate (4 bends, valves at both ends, one check valve when pumped).`
    : `${explanationFor(traces, 'ENG-205')} Kuantitas fitting: perkiraan tata letak (4 belokan, katup di kedua ujung, satu katup searah bila dipompa).`;
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
      ? row(en ? 'HDPE pipe' : 'Pipa HDPE', Math.ceil(routeLengthM), 'meter')
      : row(
          en ? `${family} pipe` : `Pipa ${family}`,
          Math.ceil(routeLengthM / ROD_METERS),
          'batang',
        ),
    row('Elbow 90°', 4, 'pcs'),
    row(en ? 'Valve / stop cock' : 'Katup / stop kran', 2, 'pcs'),
  ];
  if (result.pumpDuty) {
    lines.push(row(en ? 'Check valve' : 'Katup searah (check valve)', 1, 'pcs'));
    lines.push(row(en ? 'Threaded socket / pump adaptor' : 'Sok drat / adaptor pompa', 2, 'pcs'));
  }
  if (family !== 'HDPE')
    lines.push({ ...row(en ? 'PVC solvent cement' : 'Lem PVC', 1, 'kaleng'), size: '-' });
  return lines;
}

export function pressurizedAssumptionsFrom(
  result: PressurizedResult,
  extraAssumptionIds: readonly string[],
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
  const en = locale === 'en';
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
      text: en
        ? `The hydraulic formulas (${pending}) are standard engineering formulas not yet validated by the Pralon technical team — the result is an initial estimate, not a final design; the pump is selected from the manufacturer's curve, not from these figures alone.`
        : `Rumus hidraulik (${pending}) adalah rumus teknik baku yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final; pompa dipilih dari kurva pabrikan, bukan dari angka ini saja.`,
      fieldPath: 'design_flow',
      ruleId: 'ENG-205',
    },
    ...[...result.appliedAssumptionIds, ...extraAssumptionIds].map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: assumptionDescription(aid, locale),
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
  locale: Locale = DEFAULT_LOCALE,
): { headline: string; body: string } {
  if (locale === 'en') return pressurizedProseEn(result, family, input);
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

function pressurizedProseEn(
  result: PressurizedResult,
  family: string,
  input: PressurizedInput,
): { headline: string; body: string } {
  const l: Locale = 'en';
  const pump = result.pumpDuty
    ? ` and a ${id(result.pumpDuty.flowM3h, l)} m³/h pump at ${id(result.pumpDuty.headM, l)} m head`
    : '';
  const alt = result.alternativeSize
    ? ` The alternative is ${result.alternativeSize}: lower losses, a lighter pump, a more expensive pipe.`
    : '';
  const pumpBody = result.pumpDuty
    ? ` The pump must deliver ${id(result.pumpDuty.flowM3h, l)} m³/h at that head (hydraulic power ${id(result.pumpDuty.hydraulicPowerKw, l)} kW, indicative shaft power ±${id(result.pumpDuty.indicativeShaftPowerKw, l)} kW).`
    : '';
  return {
    headline: `${family} ${result.recommendedSize} pipe${pump} for ${id(input.designFlowLs, l)} l/s over ${id(input.routeLengthM, l)} m`,
    body: `At ${id(input.designFlowLs, l)} l/s, the ${result.recommendedSize} pipe carries water at ${id(result.velocityMs, l)} m/s with a friction loss of ${id(result.frictionLossM, l)} m over ${id(input.routeLengthM, l)} m. Adding the static head of ${id(Math.max(0, input.staticHeadM), l)} m, fitting losses of ${id(result.minorLossM, l)} m and the residual pressure at the outlet, the total head to overcome is ${id(result.totalDynamicHeadM, l)} m.${pumpBody}${alt} Initial estimate, not a final design.`,
  };
}
