/**
 * Pilihan dudukan toren untuk layar dan laporan (P22-04): dari hasil ENG-711 di `SolutionResult`,
 * ditambah ukuran pipa utama dan cabang supaya pertanyaan "toren setinggi apa, pipanya berapa
 * inci" terjawab di satu tempat. Tidak ada angka yang dibuat di sini.
 */
import type { SolutionResult } from '@snouty/engineering';
import type { TankStandView } from '@snouty/shared-types';

export function tankStandViewFrom(solution: SolutionResult): TankStandView | null {
  const stand = solution.supply.tankStand;
  // Ambang minimum adalah masukan ENG-711, bukan keluarannya — dibaca dari trace yang sama.
  const minimumBar = minimumBarFrom(solution);
  if (stand === null || minimumBar === null) return null;
  return {
    options: stand.options.map((o) => ({
      kind: o.kind,
      supportHeightM: o.supportHeightM,
      waterLevelM: o.waterLevelM,
      residualBar: o.residualBar,
      meetsMinimum: o.meetsMinimum,
      comfortable: o.comfortable,
    })),
    recommendedIndex: stand.recommendedIndex,
    comfortableIndex: stand.comfortableIndex,
    minimumBar,
    comfortBar: stand.comfortBar,
    mainSize: solution.mainSize,
    branchSizes: [...new Set(solution.branchGroups.map((g) => g.size))],
  };
}

function minimumBarFrom(solution: SolutionResult): number | null {
  const trace = solution.traces.find((t) => t.ruleId === 'ENG-711');
  const inputs = trace?.inputs as { minimumBar?: unknown } | undefined;
  return typeof inputs?.minimumBar === 'number' ? inputs.minimumBar : null;
}
