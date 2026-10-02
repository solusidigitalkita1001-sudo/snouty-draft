/**
 * Format nomor laporan. docs/REPORT.md §3. **Fungsi murni.**
 *
 * `SNTY-YYYY-MM-NNNN`, mis. `SNTY-2026-09-0148`. Urutannya per bulan, dan urutan baru
 * dimulai setiap bulan — itu keputusan desain yang membuat nomor bisa dibaca manusia
 * ("laporan ke-148 bulan September") alih-alih menjadi penghitung tunggal yang terus
 * membesar.
 */

export function formatReportNumber(yearMonth: string, sequence: number): string {
  return `SNTY-${yearMonth}-${String(sequence).padStart(4, '0')}`;
}

/** `YYYY-MM` dari sebuah tanggal ISO. Disuntikkan, bukan dibaca dari jam. */
export function yearMonthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}
