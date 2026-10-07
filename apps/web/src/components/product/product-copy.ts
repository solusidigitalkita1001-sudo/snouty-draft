/**
 * Teks drawer produk (layar 10), apa adanya dari prototipe.
 *
 * `loading`, `notFound`, dan `error` tidak ada di desain — prototipe tidak pernah
 * memuat dari jaringan — jadi ditulis minimal dan menunggu desain.
 */
import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

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

export const PRODUCT_COPY_EN: CopyShape<typeof PRODUCT_COPY> = {
  kicker: 'PRODUCT KNOWLEDGE',
  subline: 'Snouty explains this product',
  close: 'Close',
  sizesTitle: 'AVAILABLE SIZES',
  fittingsTitle: 'MATCHING FITTINGS',
  imagePlaceholder: 'product shot',
  documentsTitle: 'TECHNICAL DOCUMENTS',
  openDocument: 'Open technical document',
  sourceLabel: 'Data source',
  back: 'Back to solution',
  specMissing: 'See technical document',
  specLabels: {
    material: 'Material',
    standard: 'Standard',
    rodLength: 'Rod length',
    jointType: 'Joint',
    application: 'Application',
    pressureClass: 'Working pressure',
  },
  loading: 'Loading product…',
  notFound: 'This product is not in the active catalog.',
  error: 'Product details could not be loaded yet. Please try again shortly.',
};

export function productCopy(locale: Locale): CopyShape<typeof PRODUCT_COPY> {
  return pickCopy(locale, PRODUCT_COPY, PRODUCT_COPY_EN);
}

/** "Katalog produk Pralon 2026 · hal. 14" — baris sumber wajib (PRODUCT_KNOWLEDGE.md). */
export function sourceLine(document: string, page: number, locale: Locale = 'id'): string {
  return locale === 'en' ? `${document} · p. ${page}` : `${document} · hal. ${page}`;
}

/** "Sumber: <dokumen> hal. N" untuk nilai yang berasal dari dokumen teknis. */
export function specSourceLine(document: string, page: number, locale: Locale = 'id'): string {
  return locale === 'en' ? `Source: ${document} p. ${page}` : `Sumber: ${document} hal. ${page}`;
}
