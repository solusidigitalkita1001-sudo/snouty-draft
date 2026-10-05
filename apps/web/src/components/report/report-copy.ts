/**
 * Teks pratinjau laporan, apa adanya dari overlay prototipe. Formulir identitas, status PDF,
 * dan pesan hak akses tidak ada di desain — ditulis minimal, menunggu desain (OQ-21).
 */
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
    READY: 'PDF siap — tautan unduhan menyusul bersama rute unduh (REPORT.md §7).',
    FAILED: 'PDF gagal dibuat. Pratinjau di layar tetap bisa dipakai.',
  },
  emailUnavailable: 'Belum tersedia',
} as const;

/** Rupiah tanpa desimal — hanya dirender bila harga aktif (OQ-03). */
export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}
