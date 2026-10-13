/**
 * Pemeriksaan keseimbangan hasil hitung (laporan SNTY-2026-10-0015): jumlah per lantai dan per
 * cabang wajib sama dengan totalnya. Bila tidak, hasilnya tidak boleh dipakai — engine melempar
 * galat ini dan rekomendasi maupun laporannya tidak dibuat.
 */

export class EngineConsistencyError extends Error {
  constructor(
    readonly check: string,
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`hasil hitung tidak seimbang (${check}): total ${expected}, jumlah bagian ${actual}`);
    this.name = 'EngineConsistencyError';
  }
}

/** Selisih pembulatan satu desimal per bagian tidak dianggap ketidakseimbangan. */
export function assertBalanced(check: string, expected: number, parts: readonly number[]): void {
  const actual = parts.reduce((sum, n) => sum + n, 0);
  const tolerance = 0.05 * Math.max(1, parts.length);
  if (Math.abs(actual - expected) > tolerance) {
    throw new EngineConsistencyError(check, expected, Math.round(actual * 100) / 100);
  }
}
