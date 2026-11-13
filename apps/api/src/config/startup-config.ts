/**
 * Konfigurasi yang harus sudah benar SEBELUM permintaan pertama (smoke test 13 Nov 2026,
 * temuan 11). Di produksi, API yang jalan tanpa `STORAGE_PATH` menandai laporan READY lalu
 * menjawab 503 saat diunduh: pengguna melihat laporan selesai yang tidak bisa diambil. Lebih baik
 * berhenti di detik pertama dengan sebabnya daripada menolak unduhan satu per satu.
 *
 * Di luar produksi ini hanya peringatan: pengembangan dan tes memang sering jalan tanpa
 * penyimpanan berkas, dan di sana laporan tidak pernah ditandai READY (`ReportService.markReady`).
 */
import type { Env } from './env.js';

export function configProblems(env: Env): readonly string[] {
  const problems: string[] = [];
  if (env.STORAGE_PATH === undefined) {
    problems.push(
      'STORAGE_PATH belum diisi: berkas PDF laporan tidak punya tempat, jadi unduhan laporan ' +
        'menjawab 503 walau laporannya tampil selesai',
    );
  }
  return problems;
}
