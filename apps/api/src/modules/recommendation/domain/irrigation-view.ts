/**
 * Hasil engine irigasi + trace → apa yang dilihat pengguna di layar 06 (OQ-47). Kembaran
 * `solution-view.ts` untuk guna irigasi; invarian T-1 sama: setiap baris membawa `traceIds`,
 * "DASAR PERHITUNGAN" dari `explanation` aturan, bukan prosa. **Fungsi murni.**
 */
import type {
  Assumption,
  BomItem,
  IrrigationStats,
  Provenance,
  RecommendationStats,
  SystemLine,
} from '@snouty/shared-types';
import type { IrrigationResult } from '@snouty/engineering';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import { bomItemName, bomUnitLabel, type IdentifiedTrace } from './solution-view.js';

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

export function irrigationStatsFrom(
  result: IrrigationResult,
  areaHa: number,
  productCount: number,
): IrrigationStats {
  return {
    areaHa,
    designFlowLs: result.designFlowLs,
    mainSize: result.mainSize,
    pumpRequired: result.pumpRequired,
    productCount,
  };
}

/** `stats` bangunan tetap diisi demi pembaca lama (laporan, riwayat): nol titik air. */
export function legacyStatsFrom(
  result: IrrigationResult,
  productCount: number,
): RecommendationStats {
  return {
    outletCount: 0,
    mainSize: result.mainSize,
    branchCount: Math.max(1, result.bom.find((l) => l.item === 'Tee')?.quantity ?? 1),
    fixtureConnectionSize: result.distributionSize,
    productCount,
  };
}

export function irrigationSystemLinesFrom(
  result: IrrigationResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const mainTraces = traceIdsFor(traces, 'ENG-101', 'ENG-102', 'ENG-104');
  const distributionTraces = traceIdsFor(traces, 'ENG-102', 'ENG-105');
  const pressureTraces = traceIdsFor(traces, 'ENG-103');
  return [
    {
      name: en ? `Main line ${result.mainFamily}` : `Jalur utama ${result.mainFamily}`,
      path: en ? 'Water source → field' : 'Sumber air → lahan',
      size: result.mainSize,
      // TODO(P15-04b): trace explanations EN
      reason: `${explanationFor(traces, 'ENG-101')} ${explanationFor(traces, 'ENG-102')}`.trim(),
      provenance: provenanceFor(traces, mainTraces),
      traceIds: mainTraces,
      role: 'main',
    },
    {
      name: en
        ? `Field distribution ${result.distributionFamily}`
        : `Distribusi di lahan ${result.distributionFamily}`,
      path: en ? 'Header → laterals' : 'Header → lateral',
      size: result.distributionSize,
      // TODO(P15-04b): trace explanations EN
      reason: explanationFor(traces, 'ENG-105'),
      provenance: provenanceFor(traces, distributionTraces),
      traceIds: distributionTraces,
      role: 'branch',
    },
    {
      name: result.pumpRequired
        ? en
          ? 'Pump + pressure class'
          : 'Pompa + kelas tekanan'
        : en
          ? 'Gravity flow'
          : 'Aliran gravitasi',
      path: en ? 'Source → main line' : 'Sumber → jalur utama',
      size: `${en ? 'class' : 'kelas'} ${result.pressureClass}`,
      // TODO(P15-04b): trace explanations EN
      reason: explanationFor(traces, 'ENG-103'),
      provenance: provenanceFor(traces, pressureTraces),
      traceIds: pressureTraces,
      role: 'fitting',
    },
  ];
}

export function irrigationBomItemsFrom(
  result: IrrigationResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const bomTraces = traceIdsFor(traces, 'ENG-105');
  // TODO(P15-04b): trace explanations EN
  const basis = explanationFor(traces, 'ENG-105');
  const provenance = provenanceFor(traces, bomTraces);
  return result.bom.map((line) => ({
    item: bomItemName(line.item, locale),
    size: line.size,
    quantity: line.quantity,
    unit: bomUnitLabel(line.unit, locale),
    basis,
    provenance,
    traceIds: bomTraces,
  }));
}

/** Seluruh aturan irigasi menunggu validasi — itu asumsi pertama dan terbesar. */
export function irrigationAssumptionsFrom(
  traces: readonly IdentifiedTrace[],
  inputAssumptions: readonly Assumption[],
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
  const pending = traces
    .filter((t) => t.provenance !== 'VERIFIED')
    .map((t) => t.ruleId)
    .join(', ');
  return [
    {
      text:
        locale === 'en'
          ? `The irrigation formulas (${pending}) are general criteria not yet validated by the Pralon technical team — the result is a preliminary estimate, not a final design.`
          : `Rumus irigasi (${pending}) adalah kriteria umum yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final.`,
      fieldPath: 'irrigation.method',
      ruleId: 'ENG-101',
    },
    ...inputAssumptions,
  ];
}

/** Prosa deterministik — setiap angka dari hasil hitungan, jadi selalu lulus REC-1. */
export function irrigationProse(
  stats: IrrigationStats,
  result: IrrigationResult,
  locale: Locale = DEFAULT_LOCALE,
): {
  headline: string;
  body: string;
} {
  if (locale === 'en') {
    return {
      headline: `Preliminary irrigation estimate for ${stats.areaHa} ha: main line ${stats.mainSize}`,
      body:
        `Design flow is about ${stats.designFlowLs} litres per second. ` +
        `The main line from the water source uses ${result.mainFamily} in size ${stats.mainSize}; field distribution uses ${result.distributionFamily} with a length of about ${result.distributionMeters} metres. ` +
        (stats.pumpRequired
          ? `This line is pump-pressurised, so the pipe is class ${result.pressureClass}. `
          : `Gravity flow from a higher source; class ${result.pressureClass} pipe is sufficient. `) +
        `${stats.productCount} Pralon products were matched. All figures are marked as assumptions until Pralon's technical team has reviewed them.`,
    };
  }
  return {
    headline: `Perkiraan awal irigasi lahan ${stats.areaHa} ha: jalur utama ${stats.mainSize}`,
    body:
      `Debit rencana sekitar ${stats.designFlowLs} liter per detik. ` +
      `Jalur utama dari sumber air memakai ${result.mainFamily} ukuran ${stats.mainSize}; distribusi di lahan memakai ${result.distributionFamily} dengan panjang sekitar ${result.distributionMeters} meter. ` +
      (stats.pumpRequired
        ? `Jalur ini bertekanan pompa, jadi pipanya kelas ${result.pressureClass}. `
        : `Aliran gravitasi dari sumber yang lebih tinggi, pipa kelas ${result.pressureClass} memadai. `) +
      `Ada ${stats.productCount} produk Pralon yang dicocokkan. Seluruh angka bertanda asumsi sampai diperiksa tim teknis Pralon.`,
  };
}
