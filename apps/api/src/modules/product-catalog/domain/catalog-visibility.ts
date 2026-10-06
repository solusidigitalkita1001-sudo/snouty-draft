/**
 * Visibilitas katalog — satu tempat yang menjawab "data ini boleh mendasari jawaban ke
 * pengguna?". docs/PRODUCT_KNOWLEDGE.md §4 · OQ-46.
 *
 * Tiga pemeriksaan murni, dipakai `CatalogQueryService` (pagar produksi), pipeline jawaban
 * produk (klaim ketersediaan), dan badge katalog di UI. Dibuat satu modul supaya aturan
 * "katalog contoh bukan katalog Pralon" tidak diulang sebagai `if` di tiga tempat.
 */
import type { CatalogVersion, Product } from '@snouty/shared-types';

/**
 * Hanya versi hasil impor dokumen Pralon yang boleh mendasari pernyataan tentang Pralon —
 * termasuk pernyataan NEGATIF ("HDPE tidak ada di katalog Pralon"). Katalog contoh hanya
 * tahu apa yang disemai pengembang, dan ketiadaan di dalamnya tidak berarti apa-apa.
 */
export function isAuthoritative(version: Pick<CatalogVersion, 'kind'>): boolean {
  return version.kind === 'pralon';
}

/**
 * Versi `sample` boleh aktif hanya di development: di sanalah ia menghidupkan layar.
 * Di `test` pun ditolak — tes yang lulus karena katalog contoh lolos pagar adalah tes
 * yang memberi rasa aman palsu; tes yang memang butuh katalog memakai fixture-nya sendiri.
 */
export function sampleCatalogAllowed(nodeEnv: string): boolean {
  return nodeEnv === 'development';
}

/** Produk yang boleh dijawab "tersedia": aktif di versi aktif. `discontinued` tidak. */
export function isAnswerable(product: Pick<Product, 'status'>): boolean {
  return product.status === 'active';
}
