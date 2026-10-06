/**
 * Tabel ukuran nominal per keluarga pipa (docs/MATCHER_V2_PROPOSAL.md §3).
 *
 * PVC Pralon dijual dalam inci; HDPE/MDPE dalam milimeter (diameter luar, OD) — dan `63 mm` bukan
 * `2"`. Engine karena itu memilih ukuran dari tabel sesuai keluarga, dan label yang keluar
 * (`1½"` atau `63 mm`) adalah label `PipeSize` kanonik yang langsung dicocokkan ke katalog.
 *
 * Diameter dalam di sini **pendekatan**, bukan tabel produk: inci dari ENG-102 (menunggu validasi),
 * mm dari OD − 2 × tebal SDR 17 (PE100 PN 10) — asumsi `HDPE_SDR17_PN10` di registry.
 */

import { assumption } from './assumptions.js';

export type SizeTableId = 'pvc_inch' | 'hdpe_mm';

export interface NominalSize {
  readonly size: string;
  readonly innerMm: number;
}

/** Diameter dalam nominal (mm) per ukuran inci — pendekatan umum, bukan tabel produk. */
export const PVC_INCH_SIZES: readonly NominalSize[] = [
  { size: '1/2"', innerMm: 15 },
  { size: '3/4"', innerMm: 20 },
  { size: '1"', innerMm: 25 },
  { size: '1¼"', innerMm: 32 },
  { size: '1½"', innerMm: 40 },
  { size: '2"', innerMm: 50 },
  { size: '2½"', innerMm: 65 },
  { size: '3"', innerMm: 80 },
  { size: '4"', innerMm: 100 },
  { size: '6"', innerMm: 150 },
];

/** OD HDPE seri ISO 4427 yang ada di katalog Pralon (20–400 mm). */
const HDPE_OUTER_DIAMETERS_MM = [
  20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400,
] as const;

const SDR = assumption('HDPE_SDR17_PN10').value as number;

/** HDPE: label `<OD> mm`; diameter dalam = OD − 2 × (OD / SDR), dibulatkan 0,1 mm. */
export const HDPE_MM_SIZES: readonly NominalSize[] = HDPE_OUTER_DIAMETERS_MM.map((od) => ({
  size: `${od} mm`,
  innerMm: Math.round((od - (2 * od) / SDR) * 10) / 10,
}));

export function sizeTable(id: SizeTableId): readonly NominalSize[] {
  return id === 'hdpe_mm' ? HDPE_MM_SIZES : PVC_INCH_SIZES;
}

/** Tabel untuk sebuah keluarga/bahan: HDPE dan MDPE dalam mm, selain itu inci. */
export function sizeTableFor(familyOrMaterial: string): SizeTableId {
  return /hdpe|mdpe|\bpe\b/i.test(familyOrMaterial) ? 'hdpe_mm' : 'pvc_inch';
}
