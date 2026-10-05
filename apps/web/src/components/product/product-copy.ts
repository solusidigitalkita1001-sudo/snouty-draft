/**
 * Teks drawer produk (layar 10), apa adanya dari prototipe.
 *
 * `loading`, `notFound`, dan `error` tidak ada di desain — prototipe tidak pernah
 * memuat dari jaringan — jadi ditulis minimal dan menunggu desain.
 */
export const PRODUCT_COPY = {
  kicker: 'PENGETAHUAN PRODUK',
  subline: 'Snouty menjelaskan produk ini',
  close: 'Tutup',
  sizesTitle: 'UKURAN TERSEDIA',
  fittingsTitle: 'FITTING YANG SEPADAN',
  imagePlaceholder: 'product shot',
  /**
   * Bagian dokumen teknis tidak ada di prototipe — yang ada hanya janji
   * "Buka dokumen teknis" di docs/PRODUCT_KNOWLEDGE.md §4. Dibangun minimal (OQ-21).
   */
  documentsTitle: 'DOKUMEN TEKNIS',
  documentsNeedsDesign: 'BAGIAN SEMENTARA · MENUNGGU DESAIN',
  openDocument: 'Buka dokumen teknis',
  sourceLabel: 'Sumber data',
  back: 'Kembali ke solusi',
  specMissing: 'Lihat dokumen teknis',
  specLabels: {
    material: 'Material',
    standard: 'Standar',
    rodLength: 'Panjang batang',
    jointType: 'Sambungan',
    application: 'Aplikasi',
    pressureClass: 'Tekanan kerja',
  },
  loading: 'Memuat produk…',
  notFound: 'Produk ini tidak ada di katalog aktif.',
  error: 'Detail produk belum bisa dimuat. Coba lagi sebentar lagi.',
} as const;

/** "Katalog produk Pralon 2026 · hal. 14" — baris sumber wajib (PRODUCT_KNOWLEDGE.md). */
export function sourceLine(document: string, page: number): string {
  return `${document} · hal. ${page}`;
}

/** "Sumber: <dokumen> hal. N" untuk nilai yang berasal dari dokumen teknis. */
export function specSourceLine(document: string, page: number): string {
  return `Sumber: ${document} hal. ${page}`;
}
