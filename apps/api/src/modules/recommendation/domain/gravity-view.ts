/**
 * Hasil engine gravitasi (Kelompok H: drainase, air hujan, gorong-gorong) dan jaringan cluster →
 * layar solusi. Kembaran `pressurized-view.ts`. **Fungsi murni.**
 */
import {
  applyAssumption,
  assumptionDescription,
  type GravityInput,
  type GravityResult,
  type NetworkInput,
  type NetworkResult,
  type TrafficLoad,
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
const idNum = (n: number) => String(n).replace('.', ',');
/** Indonesia: koma desimal (tak berubah); Inggris: titik desimal tanpa pemisah ribuan. */
const id = (n: number, locale: Locale = DEFAULT_LOCALE): string =>
  locale === 'en'
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })
    : idNum(n);

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

const KIND_LABEL: Readonly<Record<Locale, Record<GravityResult['kind'], string>>> = {
  id: {
    drainage: 'Saluran gravitasi',
    stormwater: 'Drainase air hujan',
    culvert: 'Gorong-gorong',
  },
  en: {
    drainage: 'Gravity drain',
    stormwater: 'Stormwater drainage',
    culvert: 'Culvert',
  },
};

export function gravityHighlights(
  result: GravityResult,
  productCount: number,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  const en = locale === 'en';
  const rows: KeyValue[] = [
    {
      label: en ? 'Design flow' : 'Debit rencana',
      value: `${id(result.designFlowLs, locale)} l/s`,
    },
    { label: en ? 'Pipe' : 'Pipa', value: `PVC D ${result.recommendedSize}` },
    { label: en ? 'Slope' : 'Kemiringan', value: `${id(result.slopePercent, locale)} %` },
    {
      label: en ? 'Full-flow capacity' : 'Kapasitas penuh',
      value: en
        ? `${id(result.fullFlowLs, locale)} l/s (${id(result.utilisationPercent, locale)} % used)`
        : `${id(result.fullFlowLs)} l/s (${id(result.utilisationPercent)} % terpakai)`,
    },
  ];
  if (result.structural) {
    rows.push({
      label: en ? 'Cover' : 'Timbunan',
      value: result.structural.coverAdequate
        ? en
          ? 'Adequate (initial)'
          : 'Memadai (awal)'
        : en
          ? 'Needs structural validation'
          : 'Perlu validasi struktural',
    });
  }
  rows.push({ label: en ? 'Pralon products' : 'Produk Pralon', value: `${productCount} item` });
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
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const main = traceIdsFor(traces, 'ENG-403', 'ENG-402', 'ENG-401');
  const lines: SystemLine[] = [
    {
      name: `${KIND_LABEL[locale][result.kind]} PVC D`,
      path:
        result.kind === 'culvert'
          ? en
            ? 'Upstream → downstream across the road'
            : 'Hulu → hilir melintasi jalan'
          : en
            ? 'Upstream → discharge channel'
            : 'Hulu → saluran buang',
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
      name: en ? 'Cover and road load' : 'Timbunan dan beban jalan',
      path: en ? 'Above the culvert' : 'Di atas gorong-gorong',
      size: `${id(result.structural.minimumCoverM, locale)} m min.`,
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
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const en = locale === 'en';
  const ids = traceIdsFor(traces, 'ENG-402');
  const provenance = provenanceFor(traces, ids);
  const note =
    pipeLengthM === null
      ? en
        ? 'Route length not stated yet — pipe quantity to follow.'
        : 'Panjang jalur belum disebut — kuantitas pipa menyusul.'
      : en
        ? 'Fitting quantities: layout estimate.'
        : 'Kuantitas fitting: perkiraan tata letak.';
  const basis = `${explanationFor(traces, 'ENG-402')} ${note}`.trim();
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
    lines.push(
      row(en ? 'PVC D pipe' : 'Pipa PVC D', Math.ceil(pipeLengthM / ROD_METERS), 'batang'),
    );
  if (result.kind === 'culvert') {
    lines.push(
      row(
        en
          ? 'Culvert headwall / concrete encasement (outside the piping)'
          : 'Kepala gorong-gorong / selubung beton (di luar perpipaan)',
        2,
        'pcs',
        '-',
      ),
    );
  } else {
    lines.push(row('Elbow 45°', 2, 'pcs'));
    lines.push(row(en ? 'Tee / junction inspection box' : 'Tee / bak kontrol sambungan', 1, 'pcs'));
  }
  lines.push(row(en ? 'PVC solvent cement' : 'Lem PVC', 1, 'kaleng', '-'));
  return lines;
}

export function gravityAssumptionsFrom(
  result: GravityResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
  const en = locale === 'en';
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
      text: en
        ? `The gravity drain formulas (${pending}) are standard engineering formulas not yet validated by the Pralon technical team — the result is an initial estimate, not a final design.`
        : `Rumus saluran gravitasi (${pending}) adalah rumus teknik baku yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final.`,
      fieldPath: 'design_flow',
      ruleId: 'ENG-402',
    },
    ...result.appliedAssumptionIds.map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: assumptionDescription(aid, locale),
        fieldPath: fieldFor(a.parameter),
        ruleId: 'ENG-402',
        assumptionId: a.id,
      };
    }),
  ];
  if (result.kind === 'culvert') {
    rows.push({
      text: en
        ? 'The culvert is sized hydraulically only; pipe stiffness class, compaction and concrete encasement must be checked by the technical team (structural).'
        : 'Gorong-gorong dihitung hidrauliknya saja; kelas kekakuan pipa, pemadatan, dan selubung beton wajib diperiksa tim teknis (struktur).',
      fieldPath: 'traffic_load',
      ruleId: 'ENG-404',
    });
  }
  return rows;
}

export function gravityProse(
  result: GravityResult,
  locale: Locale = DEFAULT_LOCALE,
): { headline: string; body: string } {
  if (locale === 'en') return gravityProseEn(result);
  const label = KIND_LABEL.id[result.kind];
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
export function networkHighlightsPrefix(
  result: NetworkResult,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  if (locale === 'en') {
    return [
      { label: 'Connections', value: `${result.connections} units` },
      {
        label: 'Peak demand',
        value: `${id(result.peakFlowLs, locale)} l/s (average ${id(result.averageFlowLs, locale)} l/s)`,
      },
    ];
  }
  return [
    { label: 'Sambungan', value: `${result.connections} unit` },
    {
      label: 'Kebutuhan puncak',
      value: `${id(result.peakFlowLs)} l/s (rata-rata ${id(result.averageFlowLs)} l/s)`,
    },
  ];
}

function gravityProseEn(result: GravityResult): { headline: string; body: string } {
  const l: Locale = 'en';
  const label = KIND_LABEL.en[result.kind];
  const structural = result.structural
    ? result.structural.coverAdequate
      ? ` Cover above the pipe meets the initial minimum of ${id(result.structural.minimumCoverM, l)} m; the technical team still checks the structure.`
      : ` Cover above the pipe is below the initial minimum of ${id(result.structural.minimumCoverM, l)} m — a concrete encasement or a high-stiffness pipe class is needed, structural validation is required.`
    : '';
  return {
    headline: `${label}: PVC D ${result.recommendedSize} pipe for ${id(result.designFlowLs, l)} l/s at a slope of ${id(result.slopePercent, l)} %`,
    body: `At a slope of ${id(result.slopePercent, l)} %, the ${result.recommendedSize} pipe carries ${id(result.fullFlowLs, l)} l/s when full at a velocity of ${id(result.fullVelocityMs, l)} m/s; the design flow of ${id(result.designFlowLs, l)} l/s uses ${id(result.utilisationPercent, l)} % of its capacity, so there is still air space.${structural} Initial estimate, not a final design.`,
  };
}
