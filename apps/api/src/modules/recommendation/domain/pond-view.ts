/**
 * Hasil engine kolam/tambak (Kelompok G) + trace → apa yang dilihat pengguna di layar solusi.
 * Kembaran `irrigation-view.ts` untuk kasus teknis `fish_pond`; invarian T-1 sama: setiap
 * baris membawa `traceIds`, "DASAR PERHITUNGAN" dari `explanation` aturan. **Fungsi murni.**
 */
import {
  applyAssumption,
  assumptionDescription,
  type PondInput,
  type PondResult,
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

const idNum = (n: number) => String(n).replace('.', ',');
/** Indonesia: koma desimal (tak berubah); Inggris: titik desimal tanpa pemisah ribuan. */
const id = (n: number, locale: Locale = DEFAULT_LOCALE): string =>
  locale === 'en'
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })
    : idNum(n);

export function pondHighlights(
  result: PondResult,
  productCount: number,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  const en = locale === 'en';
  return [
    { label: en ? 'Water volume' : 'Volume air', value: `${id(result.volumeM3, locale)} m³` },
    {
      label: en ? 'Filling flow' : 'Debit pengisian',
      value: `${id(result.designFlowLs, locale)} l/s`,
    },
    {
      label: en ? 'Inlet pipe' : 'Pipa masuk',
      value: `${result.inletFamily} ${result.inletSize}`,
    },
    {
      label: en ? 'Drain pipe' : 'Pipa kuras',
      value: `${result.drainFamily} ${result.drainSize}`,
    },
    { label: en ? 'Pralon products' : 'Produk Pralon', value: `${productCount} item` },
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
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const inlet = traceIdsFor(traces, 'ENG-301', 'ENG-302', 'ENG-102');
  const drain = traceIdsFor(traces, 'ENG-301', 'ENG-303');
  return [
    {
      name: en ? `${result.inletFamily} inlet pipe` : `Pipa masuk ${result.inletFamily}`,
      path: en ? 'Water source / pump → pond' : 'Sumber air / pompa → kolam',
      size: result.inletSize,
      reason: `${explanationFor(traces, 'ENG-302')} ${explanationFor(traces, 'ENG-102')}`.trim(),
      provenance: provenanceFor(traces, inlet),
      traceIds: inlet,
      role: 'main',
    },
    {
      name: en ? `${result.drainFamily} drain pipe` : `Pipa kuras ${result.drainFamily}`,
      path: en ? 'Pond bottom → discharge channel' : 'Dasar kolam → saluran buang',
      size: result.drainSize,
      reason: explanationFor(traces, 'ENG-303'),
      provenance: provenanceFor(traces, drain),
      traceIds: drain,
      role: 'branch',
    },
  ];
}

/** Nama baris BOM dari engine (Indonesia) → padanan Inggris; yang tak dikenal dipakai apa adanya. */
const BOM_ITEM_EN: Readonly<Record<string, string>> = {
  'Pipa PVC AW': 'PVC AW pipe',
  'Pipa PVC D': 'PVC D pipe',
  'Elbow 90°': 'Elbow 90°',
  Tee: 'Tee',
  'Katup / stop kran': 'Valve / stop cock',
  'Sok drat / water mur (pipa tegak kuras)': 'Threaded socket / bulkhead fitting (drain standpipe)',
  'Lem PVC': 'PVC solvent cement',
};

export function pondBomItemsFrom(
  result: PondResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const bomTraces = traceIdsFor(traces, 'ENG-304');
  const basis = explanationFor(traces, 'ENG-304');
  const provenance = provenanceFor(traces, bomTraces);
  return result.bom.map((line) => ({
    item: locale === 'en' ? (BOM_ITEM_EN[line.item] ?? line.item) : line.item,
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
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
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
      text:
        locale === 'en'
          ? 'How it is worked out: length × width × water depth gives the pond volume; dividing it by the filling time gives the inlet flow, and by the draining time the drain flow — each pipe is the size that carries its flow at a safe speed. This is an initial estimate not yet checked by the Pralon technical team, not a working drawing.'
          : 'Cara hitungnya: panjang × lebar × kedalaman air memberi volume kolam; dibagi lama pengisian menjadi debit pipa masuk, dibagi lama pengurasan menjadi debit pipa kuras — tiap pipa dipilih ukuran yang mengalirkan debitnya dengan kecepatan aman. Ini perkiraan awal yang belum diperiksa tim teknis Pralon, bukan gambar kerja.',
      // Penjelasan cara hitung, bukan asumsi yang bisa diubah — tanpa tombol Perbaiki.
      fieldPath: '',
      ruleId: 'ENG-301',
    },
    ...result.appliedAssumptionIds.map((aid) => {
      const a = applyAssumption(aid);
      return {
        text: assumptionDescription(aid, locale),
        fieldPath: fieldFor(a.parameter),
        ruleId: 'ENG-301',
        assumptionId: a.id,
      };
    }),
  ];
}

/** Prosa deterministik — setiap angka dari hasil hitungan (REC-1). */
export function pondProse(
  result: PondResult,
  locale: Locale = DEFAULT_LOCALE,
): { headline: string; body: string } {
  if (locale === 'en') {
    const l: Locale = 'en';
    const ponds = result.ponds > 1 ? `${result.ponds} ponds` : 'a pond';
    return {
      headline: `${result.inletFamily} ${result.inletSize} inlet pipe and ${result.drainFamily} ${result.drainSize} drain pipe for ${ponds} of ${id(result.areaM2, l)} m²`,
      body: `The ${id(result.volumeM3, l)} m³ of water fills within the assumed time at ${id(result.designFlowLs, l)} l/s (${id(result.flowM3h, l)} m³/h) through the ${result.inletSize} class AW inlet pipe (pressurised from the pump/source). Draining uses a ${result.drainSize} class D standpipe at the pond bottom: ${id(result.drainFlowLs, l)} l/s by gravity. The materials list and Pralon products are in the next tab; initial estimate, not a final design.`,
    };
  }
  const ponds = result.ponds > 1 ? `${result.ponds} kolam` : 'kolam';
  return {
    headline: `Pipa masuk ${result.inletFamily} ${result.inletSize} dan pipa kuras ${result.drainFamily} ${result.drainSize} untuk ${ponds} ${id(result.areaM2)} m²`,
    body: `Volume air ${id(result.volumeM3)} m³ terisi dalam waktu yang diasumsikan dengan debit ${id(result.designFlowLs)} l/s (${id(result.flowM3h)} m³/jam) lewat pipa masuk ${result.inletSize} kelas AW (bertekanan dari pompa/sumber). Pengurasan memakai pipa tegak ${result.drainSize} kelas D di dasar kolam: ${id(result.drainFlowLs)} l/s secara gravitasi. Daftar material dan produk Pralon di tab berikutnya; perkiraan awal, bukan desain final.`,
  };
}
