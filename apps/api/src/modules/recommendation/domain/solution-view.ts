/**
 * Menerjemahkan hasil engine + trace menjadi apa yang dilihat pengguna di layar 06.
 * docs/DOMAIN_MODEL.md §7. **Fungsi murni.**
 *
 * Invarian T-1 ditegakkan di sini: setiap `SystemLine` dan `BomItem` membawa
 * `traceIds`, dan kolom "DASAR PERHITUNGAN" (`basis`) diambil dari `explanation`
 * trace — **bukan** dari prosa LLM. Penjelasan dan perhitungan karena itu tidak bisa
 * berbeda: keduanya keluar dari aturan yang sama.
 */

import type {
  Assumption,
  BomItem,
  BomUnit,
  Provenance,
  RecommendationStats,
  SystemLine,
} from '@snouty/shared-types';
import type { CalculationTrace, SolutionResult } from '@snouty/engineering';

/** Trace yang sudah punya id basis data — pemanggil memberi id sebelum memakai ini. */
export interface IdentifiedTrace extends CalculationTrace {
  readonly id: string;
}

function traceIdsFor(traces: readonly IdentifiedTrace[], ...ruleIds: string[]): readonly string[] {
  return traces.filter((trace) => ruleIds.includes(trace.ruleId)).map((trace) => trace.id);
}

function explanationFor(traces: readonly IdentifiedTrace[], ruleId: string): string {
  return traces.find((trace) => trace.ruleId === ruleId)?.explanation ?? '';
}

/** Provenance paling lemah di antara trace yang mendasari sebuah baris. */
function provenanceFor(traces: readonly IdentifiedTrace[], ids: readonly string[]): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  let worst: Provenance = 'VERIFIED';
  for (const trace of traces) {
    if (!ids.includes(trace.id)) continue;
    if (order.indexOf(trace.provenance) > order.indexOf(worst)) worst = trace.provenance;
  }
  return worst;
}

export function statsFrom(solution: SolutionResult, productCount: number): RecommendationStats {
  return {
    outletCount: solution.outletCount,
    mainSize: solution.mainSize,
    branchCount: solution.branchCount,
    fixtureConnectionSize: solution.fixtureConnectionSize,
    productCount,
  };
}

/** Baris tabel "Rekomendasi Sistem" (layar 06). */
export function systemLinesFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
): readonly SystemLine[] {
  const mainTraces = traceIdsFor(traces, 'ENG-001', 'ENG-002');
  const branchTraces = traceIdsFor(traces, 'ENG-003');
  const fixtureTraces = traceIdsFor(traces, 'ENG-005');

  return [
    {
      name: 'Pipa distribusi utama',
      path: 'Sumber → riser',
      size: solution.mainSize,
      reason: explanationFor(traces, 'ENG-002'),
      provenance: provenanceFor(traces, mainTraces),
      traceIds: mainTraces,
      role: 'main',
    },
    {
      name: 'Cabang per lantai',
      path: 'Riser → titik air',
      size: '3/4"',
      reason: explanationFor(traces, 'ENG-003'),
      provenance: provenanceFor(traces, branchTraces),
      traceIds: branchTraces,
      role: 'branch',
    },
    {
      name: 'Sambungan fixture',
      path: 'Cabang → fixture',
      size: solution.fixtureConnectionSize,
      reason: explanationFor(traces, 'ENG-005'),
      provenance: provenanceFor(traces, fixtureTraces),
      traceIds: fixtureTraces,
      role: 'fixture',
    },
  ];
}

/**
 * Baris BOM. `basis` berasal dari trace ENG-009, dan `provenance` mengikuti trace —
 * yang berarti selama dimensi bangunan belum ada, seluruh baris `ESTIMATED` atau lebih
 * lemah, persis seperti tag desain "ESTIMASI · DIMENSI BELUM LENGKAP".
 */
export function bomItemsFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
): readonly BomItem[] {
  const bomTraces = traceIdsFor(traces, 'ENG-009');
  const basis = explanationFor(traces, 'ENG-009');
  const provenance = provenanceFor(traces, bomTraces);

  return solution.bom.map((line) => ({
    item: line.item,
    size: line.size,
    quantity: line.quantity,
    unit: line.unit as BomUnit,
    basis,
    provenance,
    traceIds: bomTraces,
  }));
}

/**
 * Daftar asumsi. `fieldPath` membuat "Perbaiki asumsi ini →" bisa membuka field yang
 * tepat; tanpa itu tombol tersebut hanya bisa melempar pengguna ke awal percakapan.
 */
export function assumptionsFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  requirementAssumptions: readonly Assumption[],
): readonly Assumption[] {
  const fromRules: Assumption[] = [];

  // Tinggi lantai hanya menjadi asumsi bila ENG-004 benar-benar berjalan.
  if (traces.some((trace) => trace.ruleId === 'ENG-004')) {
    fromRules.push({
      text: explanationFor(traces, 'ENG-004'),
      fieldPath: 'building.floorHeightM',
      ruleId: 'ENG-004',
    });
  }

  if (solution.overallProvenance !== 'VERIFIED') {
    fromRules.push({
      text: 'Panjang pipa diestimasi karena dimensi bangunan belum diberikan.',
      fieldPath: 'building.dimensions',
      ruleId: 'ENG-009',
    });
  }

  // Asumsi kebutuhan (dari Context Engine) lebih dulu: itu yang pengguna kenali
  // sebagai jawabannya sendiri, dan yang paling mungkin ingin diperbaiki.
  return [...requirementAssumptions, ...fromRules];
}

/** Semua angka yang sah muncul di prosa — masukan pemeriksa REC-1. */
export function allowedNumbersFrom(
  stats: RecommendationStats,
  bom: readonly BomItem[],
  solution: SolutionResult,
): readonly number[] {
  return [
    stats.outletCount,
    stats.branchCount,
    stats.productCount,
    solution.loadUnits,
    solution.floorHeightM,
    solution.maxOutletsPerBranch,
    solution.variancePercent.min,
    solution.variancePercent.max,
    solution.targetVelocityMs.min,
    solution.targetVelocityMs.max,
    ...solution.floorsPlan.map((floor) => floor.floor),
    ...solution.floorsPlan.map((floor) => floor.elevationM),
    ...bom.map((item) => item.quantity),
  ];
}

/** Semua label ukuran yang sah muncul di prosa. */
export function allowedSizesFrom(
  solution: SolutionResult,
  bom: readonly BomItem[],
): readonly string[] {
  return [
    solution.mainSize,
    solution.fixtureConnectionSize,
    '3/4"',
    ...bom.map((item) => item.size),
  ];
}
