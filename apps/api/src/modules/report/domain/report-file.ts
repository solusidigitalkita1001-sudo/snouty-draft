/**
 * Lokasi berkas PDF laporan di penyimpanan. docs/REPORT.md §5, §7.
 *
 * `fileRef` ditulis worker sebagai jalur relatif POSIX (`reports/<id>.pdf`) dan disimpan
 * di database. Fungsi ini satu-satunya tempat ia diubah menjadi jalur absolut — dan satu-
 * satunya tempat yang memastikan hasilnya tetap **di dalam** akar penyimpanan. Nilai dari
 * database tetap diperlakukan sebagai masukan: baris yang diubah tangan tidak boleh bisa
 * membaca `../../.env`.
 */
import { resolve, sep } from 'node:path';

export class ReportFileOutsideStorageError extends Error {
  readonly code = 'NOT_FOUND' as const;

  constructor() {
    super('Berkas laporan tidak ditemukan.');
    this.name = 'ReportFileOutsideStorageError';
  }
}

export function resolveReportFile(storagePath: string, fileRef: string): string {
  const root = resolve(storagePath);
  const absolute = resolve(root, fileRef);
  // Harus BENAR-BENAR di bawah akar: akar itu sendiri bukan berkas, dan `..` menuju luar.
  if (!absolute.startsWith(root + sep)) throw new ReportFileOutsideStorageError();
  return absolute;
}

/** Nama berkas yang dilihat pengguna: nomor laporan, bukan id internal. */
export function reportDownloadName(reportNumber: string): string {
  return `${reportNumber.replace(/[^A-Za-z0-9-]/g, '_')}.pdf`;
}
