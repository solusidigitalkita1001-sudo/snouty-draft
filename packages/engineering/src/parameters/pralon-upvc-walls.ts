/**
 * DIBANGKITKAN oleh scripts/gen-pralon-upvc-walls.mjs — jangan disunting tangan.
 *
 * Pipa PRALON uPVC kelas AW, D, C per ukuran nominal: OD nominal + toleransi, dan per kelas
 * [tebal dinding nominal, toleransi] (mm); `null` = ukuran itu tidak ada di kelas tersebut.
 * Sumber: PROD/STD-04 Rev. 11 (data/standards/2026-10-14-prod-std-004/).
 */
export const PRALON_UPVC_SOURCE = 'PROD/STD-04 Rev. 11';

type Wall = readonly [number, number] | null;

export const PRALON_UPVC_WALLS_MM: readonly {
  readonly size: string;
  readonly outerMm: number;
  readonly outerToleranceMm: number;
  readonly AW: Wall;
  readonly D: Wall;
  readonly C: Wall;
}[] = [
  { size: '3/8"', outerMm: 17, outerToleranceMm: 0.2, AW: null, D: null, C: [0.8, 0.2] },
  { size: '1/2"', outerMm: 22, outerToleranceMm: 0.2, AW: [1.5, 0.2], D: null, C: [1, 0.2] },
  { size: '3/4"', outerMm: 26, outerToleranceMm: 0.2, AW: [1.8, 0.2], D: null, C: [1.2, 0.2] },
  { size: '1"', outerMm: 32, outerToleranceMm: 0.2, AW: [2, 0.2], D: null, C: [1.2, 0.2] },
  { size: '1¼"', outerMm: 42, outerToleranceMm: 0.3, AW: [2.3, 0.3], D: [1.2, 0.2], C: null },
  { size: '1½"', outerMm: 48, outerToleranceMm: 0.3, AW: [2.3, 0.3], D: [1.2, 0.2], C: null },
  { size: '2"', outerMm: 60, outerToleranceMm: 0.4, AW: [2.3, 0.3], D: [1.4, 0.2], C: null },
  { size: '2½"', outerMm: 76, outerToleranceMm: 0.5, AW: [2.6, 0.3], D: [1.5, 0.2], C: null },
  { size: '3"', outerMm: 89, outerToleranceMm: 0.5, AW: [3.1, 0.3], D: [1.5, 0.3], C: null },
  { size: '4"', outerMm: 114, outerToleranceMm: 0.6, AW: [4.3, 0.3], D: [2, 0.3], C: null },
  { size: '5"', outerMm: 140, outerToleranceMm: 0.8, AW: [5.4, 0.4], D: [2.4, 0.4], C: null },
  { size: '6"', outerMm: 165, outerToleranceMm: 1, AW: [6.4, 0.4], D: [2.8, 0.4], C: null },
  { size: '8"', outerMm: 216, outerToleranceMm: 1.3, AW: [8.3, 0.5], D: [3.8, 0.4], C: null },
  { size: '10"', outerMm: 267, outerToleranceMm: 1.6, AW: [9.7, 0.6], D: [4.7, 0.5], C: null },
  { size: '12"', outerMm: 318, outerToleranceMm: 1.9, AW: [11.4, 0.8], D: [5.7, 0.5], C: null },
];
