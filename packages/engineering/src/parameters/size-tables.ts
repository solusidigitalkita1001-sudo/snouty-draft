/**
 * Tabel ukuran nominal per keluarga pipa (docs/MATCHER_V2_PROPOSAL.md §3).
 *
 * PVC Pralon dijual dalam inci; HDPE/MDPE dalam milimeter (diameter luar, OD) — dan `63 mm` bukan
 * `2"`. Engine karena itu memilih ukuran dari tabel sesuai keluarga, dan label yang keluar
 * (`1½"` atau `63 mm`) adalah label `PipeSize` kanonik yang langsung dicocokkan ke katalog.
 *
 * Diameter dalam = OD − 2 × tebal dinding, dari standar resmi Pralon: PVC kelas AW dari PROD/STD-04
 * Rev. 11 (`pralon-upvc-walls.ts`, menutup OQ-64 — dulu SDR 26,5 perkiraan), HDPE PE100 per OD dan
 * SDR dari PROD/STD/014 (`pe100-walls.ts`; SDR-nya sendiri, `HDPE_SDR17_PN10`, tetap asumsi
 * kelas). Ukuran nominal inci tidak pernah dipakai sebagai diameter dalam: 6" berdiameter luar
 * 165 mm, bukan diameter dalam 150 mm (audit C1).
 */

import { assumption } from './assumptions.js';
import { PE100_WALLS_MM } from './pe100-walls.js';
import { PRALON_UPVC_WALLS_MM } from './pralon-upvc-walls.js';

export type SizeTableId = 'pvc_inch' | 'hdpe_mm';

export interface NominalSize {
  readonly size: string;
  /** Diameter luar dari sumber produk (mm). */
  readonly outerMm: number;
  /** Diameter dalam rata-rata (mm) dari tebal dinding resmi. */
  readonly innerMm: number;
}

/** Ukuran PVC bertekanan yang dipakai engine (½"–6"; 5" tidak ada di katalog rumah). */
const PVC_PRESSURE_SIZES = ['1/2"', '3/4"', '1"', '1¼"', '1½"', '2"', '2½"', '3"', '4"', '6"'];
/** 8"–12" — hanya untuk saluran gravitasi; tabel bertekanan berhenti di 6". */
const PVC_GRAVITY_EXTRA_SIZES = ['8"', '10"', '12"'];

/** OD HDPE seri ISO 4427 yang ada di katalog Pralon (20–400 mm). */
const HDPE_OUTER_DIAMETERS_MM = [
  20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400,
] as const;

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Diameter dalam dari OD dan SDR, dibulatkan 0,1 mm. */
export function innerDiameterMm(outerMm: number, sdr: number): number {
  return round1(outerMm - (2 * outerMm) / sdr);
}

/**
 * Diameter dalam PE100 dari tabel resmi: OD − 2 × tebal rata-rata (nominal + ½ toleransi atas) —
 * diameter dalam rata-rata yang lazim dipakai hitungan hidrolik. `null` bila Pralon tidak
 * memproduksi OD itu di SDR tersebut.
 */
export function pe100InnerDiameterMm(outerMm: number, sdr: number): number | null {
  const wall = PE100_WALLS_MM[outerMm]?.[String(sdr)];
  if (wall === undefined) return null;
  const [nominal, tolerance] = wall;
  return round1(outerMm - 2 * (nominal + tolerance / 2));
}

/**
 * Pipa PRALON kelas AW: OD rata-rata (nominal + ½ toleransi, seperti dokumen menghitung berat)
 * dikurangi dua kali tebal rata-rata. ½" AW: 22,1 − 2 × 1,6 = 18,9 mm.
 */
export function pralonAwSize(size: string): NominalSize {
  const row = PRALON_UPVC_WALLS_MM.find((r) => r.size === size);
  if (!row?.AW) throw new Error(`Ukuran ${size} tidak ada di tabel PRALON AW (PROD/STD-04)`);
  const [wall, tolerance] = row.AW;
  return {
    size,
    outerMm: row.outerMm,
    innerMm: round1(row.outerMm + row.outerToleranceMm / 2 - 2 * (wall + tolerance / 2)),
  };
}

export function defaultWallSdr(id: SizeTableId): number | undefined {
  return id === 'hdpe_mm' ? (assumption('HDPE_SDR17_PN10').value as number) : undefined;
}

/**
 * ID asumsi SDR yang dipakai sebuah tabel — dicatat sebagai asumsi terpakai oleh pemanggil. PVC
 * tidak punya lagi: tebal dindingnya resmi (PROD/STD-04).
 */
export function wallSdrAssumptionId(id: SizeTableId): string | null {
  return id === 'hdpe_mm' ? 'HDPE_SDR17_PN10' : null;
}

/** `wallSdr` hanya berlaku untuk HDPE; PVC memakai tebal resmi kelas AW. */
export function sizeTable(
  id: SizeTableId,
  wallSdr: number | undefined = defaultWallSdr(id),
): readonly NominalSize[] {
  if (id === 'pvc_inch') return PVC_INCH_SIZES;
  const sdr = wallSdr ?? (assumption('HDPE_SDR17_PN10').value as number);
  return HDPE_OUTER_DIAMETERS_MM.map((od) => ({
    size: `${od} mm`,
    outerMm: od,
    // OD yang tidak diproduksi di SDR ini tetap dari rumus SDR (asumsi kelas yang sama).
    innerMm: pe100InnerDiameterMm(od, sdr) ?? innerDiameterMm(od, sdr),
  }));
}

export const PVC_INCH_SIZES: readonly NominalSize[] = PVC_PRESSURE_SIZES.map(pralonAwSize);

/** 8"–12" kelas AW — saluran gravitasi. */
export const PVC_LARGE_SIZES: readonly NominalSize[] = PVC_GRAVITY_EXTRA_SIZES.map(pralonAwSize);
export const HDPE_MM_SIZES: readonly NominalSize[] = sizeTable('hdpe_mm');

/** Tabel untuk sebuah keluarga/bahan: HDPE dan MDPE dalam mm, selain itu inci. */
export function sizeTableFor(familyOrMaterial: string): SizeTableId {
  return /hdpe|mdpe|\bpe\b/i.test(familyOrMaterial) ? 'hdpe_mm' : 'pvc_inch';
}

/**
 * Pipa PRALON kelas `pipeClass` dibuat dalam ukuran nominal `size` (PROD/STD-04). Di dokumen itu
 * AW, D, dan C berukuran sama punya OD yang sama, jadi fitting sambungan lem ukuran itu pas di
 * pipa kelas mana pun yang dibuat di ukuran tersebut — dipakai matcher untuk fitting yang kelasnya
 * kosong di katalog (seri Ts, W, DV).
 */
export function pralonPipeMadeIn(size: string, pipeClass: string): boolean {
  const row = PRALON_UPVC_WALLS_MM.find((r) => r.size === size);
  if (row === undefined) return false;
  const key = pipeClass.toUpperCase();
  return (key === 'AW' || key === 'D' || key === 'C') && row[key] !== null;
}
