/**
 * "Coba ubah" (DD-01, P17-08): bandingkan hasil sekarang dengan beberapa perubahan yang sering
 * ditanyakan — toren dinaikkan satu lantai, tambah satu kamar mandi, ganti sumber air.
 *
 * Setiap skenario dihitung ulang oleh engine dari kebutuhan yang tersimpan; tidak ada yang
 * disimpan, tidak ada model bahasa. Angka di sini hanya keluaran engine (aturan yang sama dengan
 * rekomendasinya, sehingga provenance-nya juga sama: perkiraan selama aturannya belum disahkan).
 */

import {
  assumption,
  computeSolution,
  type AssumptionOverrides,
  type SolutionInput,
  type SolutionResult,
} from '@snouty/engineering';
import type { ScenarioComparison, ScenarioId, ScenarioMetrics } from '@snouty/shared-types';

function metricsOf(result: SolutionResult): ScenarioMetrics {
  return {
    outletCount: result.outletCount,
    mainSize: result.mainSize,
    velocityMs: result.supply.main.velocityMs,
    branches: result.branchGroups.map((g) => ({ size: g.size, count: g.count })),
    boosterPumpNeeded: result.boosterPumpNeeded,
    residualBar: result.supply.gravityResidualBar,
    tankFill: result.tankFill,
  };
}

/**
 * Skenario untuk masukan bangunan ini. Sumber air yang sudah dipakai tidak ditawarkan lagi;
 * "toren dinaikkan" hanya untuk toren atap. Dudukan toren naik setinggi satu lantai dari nilai
 * yang dipakai sekarang (asumsi baku atau nilai pengguna).
 */
export function compareScenarios(
  input: SolutionInput,
  overrides: AssumptionOverrides,
): ScenarioComparison {
  const base = computeSolution(input, undefined, overrides);
  const scenarios: { id: ScenarioId; metrics: ScenarioMetrics }[] = [];
  const run = (id: ScenarioId, next: SolutionInput, nextOverrides = overrides) => {
    scenarios.push({ id, metrics: metricsOf(computeSolution(next, undefined, nextOverrides)) });
  };

  if (input.waterSource === 'rooftop_tank') {
    const stand = overrides.TANK_STAND_1M ?? Number(assumption('TANK_STAND_1M').value);
    run('tank_raised', input, { ...overrides, TANK_STAND_1M: stand + base.floorHeightM });
  }
  run('add_bathroom', { ...input, bathrooms: input.bathrooms + 1 });
  for (const source of ['municipal', 'ground_tank', 'rooftop_tank'] as const) {
    if (input.waterSource !== source) {
      run(source === 'municipal' ? 'municipal' : source, { ...input, waterSource: source });
    }
  }
  return { base: metricsOf(base), raisedByM: base.floorHeightM, scenarios };
}
