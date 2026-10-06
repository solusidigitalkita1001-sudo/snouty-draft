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
    fixtureConnectionSize: result.mainSize,
    productCount,
  };
}

export function irrigationSystemLinesFrom(
  result: IrrigationResult,
  traces: readonly IdentifiedTrace[],
): readonly SystemLine[] {
  const mainTraces = traceIdsFor(traces, 'ENG-101', 'ENG-102', 'ENG-104');
  const distributionTraces = traceIdsFor(traces, 'ENG-102', 'ENG-105');
  const pressureTraces = traceIdsFor(traces, 'ENG-103');
  return [
    {
      name: `Jalur utama ${result.mainFamily}`,
      path: 'Sumber air → lahan',
      size: result.mainSize,
      reason: `${explanationFor(traces, 'ENG-101')} ${explanationFor(traces, 'ENG-102')}`.trim(),
      provenance: provenanceFor(traces, mainTraces),
      traceIds: mainTraces,
      role: 'main',
    },
    {
      name: `Distribusi di lahan ${result.distributionFamily}`,
      path: 'Header → lateral',
      size: result.mainSize,
      reason: explanationFor(traces, 'ENG-105'),
      provenance: provenanceFor(traces, distributionTraces),
      traceIds: distributionTraces,
      role: 'branch',
    },
    {
      name: result.pumpRequired ? 'Pompa + kelas tekanan' : 'Aliran gravitasi',
      path: 'Sumber → jalur utama',
      size: `kelas ${result.pressureClass}`,
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
): readonly BomItem[] {
  const bomTraces = traceIdsFor(traces, 'ENG-105');
  const basis = explanationFor(traces, 'ENG-105');
  const provenance = provenanceFor(traces, bomTraces);
  return result.bom.map((line) => ({
    item: line.item,
    size: line.size,
    quantity: line.quantity,
    unit: line.unit,
    basis,
    provenance,
    traceIds: bomTraces,
  }));
}

/** Seluruh aturan irigasi menunggu validasi — itu asumsi pertama dan terbesar. */
export function irrigationAssumptionsFrom(
  traces: readonly IdentifiedTrace[],
  inputAssumptions: readonly Assumption[],
): readonly Assumption[] {
  const pending = traces
    .filter((t) => t.provenance !== 'VERIFIED')
    .map((t) => t.ruleId)
    .join(', ');
  return [
    {
      text: `Rumus irigasi (${pending}) adalah kriteria umum yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final.`,
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
): {
  headline: string;
  body: string;
} {
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
