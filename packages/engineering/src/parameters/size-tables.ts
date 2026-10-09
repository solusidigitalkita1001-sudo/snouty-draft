/**
 * Tabel ukuran nominal per keluarga pipa (docs/MATCHER_V2_PROPOSAL.md §3).
 *
 * PVC Pralon dijual dalam inci; HDPE/MDPE dalam milimeter (diameter luar, OD) — dan `63 mm` bukan
 * `2"`. Engine karena itu memilih ukuran dari tabel sesuai keluarga, dan label yang keluar
 * (`1½"` atau `63 mm`) adalah label `PipeSize` kanonik yang langsung dicocokkan ke katalog.
 *
 * Diameter dalam = OD − 2 × tebal dinding (Knowledge Master §2). OD PVC adalah angka yang konsisten
 * di banyak sumber (Knowledge Master §7.1); tebal dindingnya belum ada yang resmi (§7.2 —
 * sumbernya bertentangan), jadi tebal diperkirakan dari SDR yang ada di registry asumsi
 * (`PVC_AW_WALL_SDR`, `HDPE_SDR17_PN10`). Ukuran nominal inci tidak pernah dipakai sebagai
 * diameter dalam: 6" berdiameter luar 165 mm, bukan diameter dalam 150 mm (audit C1).
 */

import { assumption } from './assumptions.js';

export type SizeTableId = 'pvc_inch' | 'hdpe_mm';

export interface NominalSize {
  readonly size: string;
  /** Diameter luar dari sumber produk (mm). */
  readonly outerMm: number;
  /** Diameter dalam perkiraan (mm) = OD − 2 × OD / SDR. */
  readonly innerMm: number;
}

/** OD pipa uPVC Pralon per ukuran nominal — Knowledge Master §7.1. */
const PVC_OUTER_DIAMETERS_MM: readonly (readonly [string, number])[] = [
  ['1/2"', 22],
  ['3/4"', 26],
  ['1"', 32],
  ['1¼"', 42],
  ['1½"', 48],
  ['2"', 60],
  ['2½"', 76],
  ['3"', 89],
  ['4"', 114],
  ['6"', 165],
];

/** OD HDPE seri ISO 4427 yang ada di katalog Pralon (20–400 mm). */
const HDPE_OUTER_DIAMETERS_MM = [
  20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400,
] as const;

/** Diameter dalam dari OD dan SDR, dibulatkan 0,1 mm. */
export function innerDiameterMm(outerMm: number, sdr: number): number {
  return Math.round((outerMm - (2 * outerMm) / sdr) * 10) / 10;
}

export function defaultWallSdr(id: SizeTableId): number {
  return assumption(id === 'hdpe_mm' ? 'HDPE_SDR17_PN10' : 'PVC_AW_WALL_SDR').value as number;
}

/** ID asumsi SDR yang dipakai sebuah tabel — dicatat sebagai asumsi terpakai oleh pemanggil. */
export function wallSdrAssumptionId(id: SizeTableId): string {
  return id === 'hdpe_mm' ? 'HDPE_SDR17_PN10' : 'PVC_AW_WALL_SDR';
}

export function sizeTable(
  id: SizeTableId,
  wallSdr: number = defaultWallSdr(id),
): readonly NominalSize[] {
  return id === 'hdpe_mm'
    ? HDPE_OUTER_DIAMETERS_MM.map((od) => ({
        size: `${od} mm`,
        outerMm: od,
        innerMm: innerDiameterMm(od, wallSdr),
      }))
    : PVC_OUTER_DIAMETERS_MM.map(([size, od]) => ({
        size,
        outerMm: od,
        innerMm: innerDiameterMm(od, wallSdr),
      }));
}

export const PVC_INCH_SIZES: readonly NominalSize[] = sizeTable('pvc_inch');

/** 8"–12" (Knowledge Master §7.1) — hanya untuk saluran gravitasi; tabel bertekanan berhenti di 6". */
export const PVC_LARGE_SIZES: readonly NominalSize[] = (
  [
    ['8"', 216],
    ['10"', 267],
    ['12"', 318],
  ] as const
).map(([size, od]) => ({
  size,
  outerMm: od,
  innerMm: innerDiameterMm(od, defaultWallSdr('pvc_inch')),
}));
export const HDPE_MM_SIZES: readonly NominalSize[] = sizeTable('hdpe_mm');

/** Tabel untuk sebuah keluarga/bahan: HDPE dan MDPE dalam mm, selain itu inci. */
export function sizeTableFor(familyOrMaterial: string): SizeTableId {
  return /hdpe|mdpe|\bpe\b/i.test(familyOrMaterial) ? 'hdpe_mm' : 'pvc_inch';
}
