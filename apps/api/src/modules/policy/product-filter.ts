/**
 * Policy 2 — anti-halusinasi pada perakitan respons. SPEC §5 · invarian C-2.
 * **Fungsi murni, tanpa I/O.**
 *
 * Ini **lapisan ketiga** dari lima pertahanan prompt injection, dan yang menentukan
 * (docs/SECURITY.md): daftar produk apa pun yang akan ditampilkan disaring terhadap
 * id yang benar-benar ada di katalog. Lapisan lain — pembatas prompt, union kartu
 * tertutup, validasi keluaran — bisa ditembus prompt yang cukup kreatif; yang ini
 * tidak, karena ia tidak membaca teks sama sekali.
 *
 * Pemanggil menyediakan himpunan id katalog (hasil `SELECT`, bukan tebakan). Fungsi
 * ini sengaja tidak melakukan query sendiri: `policy` wajib leaf.
 */

import type { ProductCardDto } from '@snouty/shared-types';

export interface FilterResult {
  readonly allowed: readonly ProductCardDto[];
  /** SKU yang dibuang — dicatat pemanggil sebagai sinyal, bukan dibuang diam-diam. */
  readonly rejectedSkus: readonly string[];
}

/**
 * Menyaring kartu produk terhadap katalog. Kartu yang `productId`-nya tidak ada di
 * `catalogProductIds` dibuang — tak peduli seberapa meyakinkan isinya.
 */
export function filterToCatalog(
  cards: readonly ProductCardDto[],
  catalogProductIds: ReadonlySet<string>,
): FilterResult {
  const allowed: ProductCardDto[] = [];
  const rejectedSkus: string[] = [];

  for (const card of cards) {
    if (catalogProductIds.has(card.productId)) allowed.push(card);
    else rejectedSkus.push(card.sku);
  }

  return { allowed, rejectedSkus };
}

/**
 * Apakah sebuah nilai spesifikasi boleh ditampilkan. Kolom katalog yang kosong
 * dirender "Lihat dokumen teknis" **tanpa nilai** — tidak diisi, tidak diperkirakan,
 * dan tidak ditambal hasil pencarian dokumen (docs/PRODUCT_KNOWLEDGE.md).
 *
 * Asumsi berlaku untuk **kebutuhan pengguna**, bukan untuk **fakta produk**: Pralon
 * tahu spesifikasi pipanya, dan kalau belum ada di sistem itu kekurangan data, bukan
 * sesuatu yang boleh ditebak.
 */
export function productSpecProvenance(value: string | null): 'VERIFIED' | 'UNAVAILABLE' {
  return value === null || value.trim() === '' ? 'UNAVAILABLE' : 'VERIFIED';
}
