/**
 * Teks pratinjau laporan, apa adanya dari overlay prototipe. Formulir identitas, status PDF,
 * dan pesan hak akses tidak ada di desain — ditulis minimal, menunggu desain (OQ-21).
 */
import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const REPORT_COPY = {
  open: 'Buat laporan',
  title: 'Laporan Rekomendasi & Estimasi Material',
  /** "NO. SNTY-2026-09-0148 · ESTIMASI PERENCANAAN" di prototipe. */
  number: (reportNumber: string) => `NO. ${reportNumber} · ESTIMASI PERENCANAAN`,
  close: 'Tutup',
  estimateTag: 'ESTIMASI',
  /** Kalimat kebijakan — tidak boleh diparafrase (DESIGN_IMPLEMENTATION §10). */
  estimateNote:
    'Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon.',
  summaryTitle: 'RINGKASAN',
  columns: { item: 'MATERIAL', size: 'UKURAN', quantity: 'QTY', subtotal: 'SUBTOTAL' },
  subtotal: 'Subtotal material',
  tax: (percent: number) => `PPN ${percent}%`,
  total: 'Total estimasi',
  footnote:
    'Belum termasuk jasa instalasi, aksesori non-pipa, dan pengiriman. Laporan lengkap 2 halaman berisi rekomendasi sistem, asumsi, dan blok tanda tangan.',
  back: 'Kembali ke solusi',
  email: 'Kirim ke email',
  download: 'Unduh PDF',

  needsDesign: 'BAGIAN SEMENTARA · MENUNGGU DESAIN',
  identity: {
    title: 'Untuk siapa laporan ini?',
    customerName: 'Nama pelanggan',
    projectLocation: 'Lokasi proyek',
    submit: 'Lanjutkan',
    hint: 'Nama dan lokasi dicetak di kop laporan.',
  },
  loading: 'Menyusun laporan…',
  notEntitled:
    'Laporan PDF tersedia untuk akun lanjutan. Hubungi tim Pralon untuk meningkatkan akun Anda.',
  error: 'Laporan belum bisa dibuat. Coba lagi sebentar lagi.',
  pdf: {
    PENDING: 'PDF sedang disiapkan…',
    READY: 'PDF siap diunduh.',
    FAILED: 'PDF gagal dibuat. Pratinjau di layar tetap bisa dipakai.',
  },
  downloading: 'Mengunduh…',
  downloadError: 'PDF belum bisa diunduh. Coba lagi sebentar lagi.',
  emailUnavailable: 'Belum tersedia',
} as const;

export const REPORT_COPY_EN: CopyShape<typeof REPORT_COPY> = {
  open: 'Create report',
  title: 'Recommendation & Material Estimate Report',
  number: (reportNumber: string) => `NO. ${reportNumber} · PLANNING ESTIMATE`,
  close: 'Close',
  estimateTag: 'ESTIMATE',
  estimateNote:
    'A planning estimate, not an official quotation. Final prices follow the Pralon distributor price list.',
  summaryTitle: 'SUMMARY',
  columns: { item: 'MATERIAL', size: 'SIZE', quantity: 'QTY', subtotal: 'SUBTOTAL' },
  subtotal: 'Material subtotal',
  tax: (percent: number) => `VAT ${percent}%`,
  total: 'Estimated total',
  footnote:
    'Excludes installation labor, non-pipe accessories, and delivery. The full 2-page report includes the system recommendation, assumptions, and a signature block.',
  back: 'Back to solution',
  email: 'Send by email',
  download: 'Download PDF',

  needsDesign: 'TEMPORARY SECTION · AWAITING DESIGN',
  identity: {
    title: 'Who is this report for?',
    customerName: 'Customer name',
    projectLocation: 'Project location',
    submit: 'Continue',
    hint: 'The name and location are printed on the report header.',
  },
  loading: 'Preparing the report…',
  notEntitled:
    'PDF reports are available for upgraded accounts. Contact the Pralon team to upgrade your account.',
  error: 'The report could not be created. Please try again shortly.',
  pdf: {
    PENDING: 'Preparing the PDF…',
    READY: 'The PDF is ready to download.',
    FAILED: 'The PDF could not be created. The on-screen preview is still usable.',
  },
  downloading: 'Downloading…',
  downloadError: 'The PDF could not be downloaded. Please try again shortly.',
  emailUnavailable: 'Not available yet',
};

export function reportCopy(locale: Locale): CopyShape<typeof REPORT_COPY> {
  return pickCopy(locale, REPORT_COPY, REPORT_COPY_EN);
}

/** Rupiah tanpa desimal — hanya dirender bila harga aktif (OQ-03). */
export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}
