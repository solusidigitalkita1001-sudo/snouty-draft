/**
 * Hasil engine kolam/tambak (Kelompok G) + trace → apa yang dilihat pengguna di layar solusi.
 * Kembaran `irrigation-view.ts` untuk kasus teknis `fish_pond`; invarian T-1 sama: setiap
 * baris membawa `traceIds`, "DASAR PERHITUNGAN" dari `explanation` aturan. **Fungsi murni.**
 */
import { applyAssumption, type PondInput, type PondResult } from '@snouty/engineering';
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

/** Parameter universal kasus `fish_pond` → masukan engine; yang kosong dibiarkan untuk asumsi engine. */
export function pondInputFrom(state: RequirementState): PondInput | null {
  if (state.useCase?.kind !== 'technical' || state.useCase.caseId !== 'fish_pond') return null;
  const p = state.useCase.parameters;
  const lengthM = numberOf(p['pond_length']);
  const widthM = numberOf(p['pond_width']);
  if (lengthM === undefined || widthM === undefined) return null;
  const depthM = numberOf(p['pond_depth']);
  const ponds = numberOf(p['number_of_ponds']);
  const fillTimeHours = numberOf(p['fill_time_hours']);
  const routeLengthM = numberOf(p['route_length']);
  return {
    lengthM,
    widthM,
    ...(depthM !== undefined ? { depthM } : {}),
    ...(ponds !== undefined ? { ponds: Math.max(1, Math.round(ponds)) } : {}),
    ...(fillTimeHours !== undefined ? { fillTimeHours } : {}),
    ...(routeLengthM !== undefined ? { routeLengthM } : {}),
  };
}

const id = (n: number) => String(n).replace('.', ',');

export function pondHighlights(result: PondResult, productCount: number): readonly KeyValue[] {
  return [
    { label: 'Volume air', value: `${id(result.volumeM3)} m³` },
    { label: 'Debit pengisian', value: `${id(result.designFlowLs)} l/s` },
    { label: 'Pipa masuk', value: `${result.inletFamily} ${result.inletSize}` },
    { label: 'Pipa kuras', value: `${result.drainFamily} ${result.drainSize}` },
    { label: 'Produk Pralon', value: `${productCount} item` },
  ];
}

/** `stats` bangunan tetap diisi demi pembaca lama (laporan, riwayat). */
export function pondLegacyStats(result: PondResult, productCount: number): RecommendationStats {
  return {
    outletCount: result.ponds,
    mainSize: result.inletSize,
    branchCount: result.ponds,
    fixtureConnectionSize: result.drainSize,
    productCount,
  };
}

export function pondSystemLinesFrom(
  result: PondResult,
  traces: readonly IdentifiedTrace[],
): readonly SystemLine[] {
  const inlet = traceIdsFor(traces, 'ENG-301', 'ENG-302', 'ENG-102');
  const drain = traceIdsFor(traces, 'ENG-301', 'ENG-303');
  return [
    {
      name: `Pipa masuk ${result.inletFamily}`,
      path: 'Sumber air / pompa → kolam',
      size: result.inletSize,
      reason: `${explanationFor(traces, 'ENG-302')} ${explanationFor(traces, 'ENG-102')}`.trim(),
      provenance: provenanceFor(traces, inlet),
      traceIds: inlet,
      role: 'main',
    },
    {
      name: `Pipa kuras ${result.drainFamily}`,
      path: 'Dasar kolam → saluran buang',
      size: result.drainSize,
      reason: explanationFor(traces, 'ENG-303'),
      provenance: provenanceFor(traces, drain),
      traceIds: drain,
      role: 'branch',
    },
  ];
}

export function pondBomItemsFrom(
  result: PondResult,
  traces: readonly IdentifiedTrace[],
): readonly BomItem[] {
  const bomTraces = traceIdsFor(traces, 'ENG-304');
  const basis = explanationFor(traces, 'ENG-304');
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

/** Asumsi: aturan menunggu validasi (pertama dan terbesar) + asumsi registry yang dipakai engine. */
export function pondAssumptionsFrom(
  result: PondResult,
  traces: readonly IdentifiedTrace[],
): readonly Assumption[] {
  const pending = [
    ...new Set(traces.filter((t) => t.provenance !== 'VERIFIED').map((t) => t.ruleId)),
  ].join(', ');
  const fieldFor = (parameter: string): string =>
    parameter === 'route_length'
      ? 'route_length'
      : parameter === 'fill_time_hours'
        ? 'fill_time_hours'
        : parameter === 'pond_depth'
          ? 'pond_depth'
          : 'pond_length';
  return [
    {
      text: `Rumus kolam (${pending}) adalah kriteria umum yang belum divalidasi tim teknis Pralon — hasilnya perkiraan awal, bukan desain final.`,
      fieldPath: 'pond_length',
      ruleId: 'ENG-301',
    },
    ...result.appliedAssumptionIds.map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: a.description,
        fieldPath: fieldFor(a.parameter),
        ruleId: 'ENG-301',
        assumptionId: a.id,
      };
    }),
  ];
}

/** Prosa deterministik — setiap angka dari hasil hitungan (REC-1). */
export function pondProse(result: PondResult): { headline: string; body: string } {
  const ponds = result.ponds > 1 ? `${result.ponds} kolam` : 'kolam';
  return {
    headline: `Pipa masuk ${result.inletFamily} ${result.inletSize} dan pipa kuras ${result.drainFamily} ${result.drainSize} untuk ${ponds} ${id(result.areaM2)} m²`,
    body: `Volume air ${id(result.volumeM3)} m³ terisi dalam waktu yang diasumsikan dengan debit ${id(result.designFlowLs)} l/s (${id(result.flowM3h)} m³/jam) lewat pipa masuk ${result.inletSize} kelas AW (bertekanan dari pompa/sumber). Pengurasan memakai pipa tegak ${result.drainSize} kelas D di dasar kolam: ${id(result.drainFlowLs)} l/s secara gravitasi. Daftar material dan produk Pralon di tab berikutnya; perkiraan awal, bukan desain final.`,
  };
}
