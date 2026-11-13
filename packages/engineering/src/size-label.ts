/**
 * Ukuran untuk DILIHAT pengguna (smoke test 13 Nov 2026, temuan 12): inci saja membuat pembeli
 * berdiri di toko menebak pipa mana yang dimaksud, karena pipa di rak bertanda milimeter. Jadi
 * label inci membawa diameter luarnya: `1" (Ø32 mm)`.
 *
 * Data yang tersimpan tidak berubah — ini lapisan tampilan. Ukuran yang tidak ada di tabel tetap
 * tampil apa adanya: milimeter karangan lebih buruk daripada tidak ada milimeter.
 */
import { outerDiameterMmOf } from './compute-renovation.js';

export function sizeWithMm(label: string | null | undefined): string {
  const text = (label ?? '').trim();
  if (text === '') return label ?? '';
  // Label HDPE sudah dalam milimeter; tidak perlu diulang.
  if (/mm/i.test(text)) return text;
  const outerMm = outerDiameterMmOf(text);
  return outerMm === null ? text : `${text} (Ø${outerMm} mm)`;
}
