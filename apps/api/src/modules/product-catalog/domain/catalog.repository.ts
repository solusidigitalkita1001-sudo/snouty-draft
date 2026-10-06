/**
 * Port repository katalog — dideklarasikan di `domain`, diimplementasikan di
 * `infrastructure` (docs/ARCHITECTURE.md §5). Arah panah dependensi karena itu
 * tetap masuk ke dalam meskipun alirannya keluar ke MySQL.
 *
 * Semua pembacaan terikat pada satu `catalogVersionId`. Itu bukan kenyamanan
 * pemanggil, melainkan syarat agar laporan lama tetap terbaca sama: rekomendasi
 * membekukan versi katalognya, dan pembacaan tanpa versi akan diam-diam
 * mencampur dua katalog.
 */

import type {
  CatalogVersion,
  CompatibleFitting,
  PipeSize,
  Product,
  ProductDocument,
  ProductStatus,
} from '@snouty/shared-types';

/** Token DI, karena yang di-inject adalah interface dan bukan kelas. */
export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

/** Sesuai kontrak `GET /products?family=&category=&size=&q=&cursor=` (docs/API_CONTRACTS.md §4). */
export interface ProductListQuery {
  readonly catalogVersionId: string;
  readonly family?: string;
  readonly category?: string;
  /** Hanya produk yang ukuran ini tersedia. Perbandingan atas nilai numerik, bukan atas label. */
  readonly size?: PipeSize;
  /** Pencarian bebas pada nama dan SKU. */
  readonly q?: string;
  /** `category` memuat teks ini (tanpa membedakan huruf) — mis. `FITTING` untuk peran fitting. */
  readonly categoryIncludes?: string;
  readonly status?: ProductStatus;
  /** SKU terakhir dari halaman sebelumnya. */
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ProductListPage {
  readonly items: readonly Product[];
  /**
   * SKU yang harus dikirim sebagai `cursor` berikutnya, atau `null` bila habis.
   *
   * Tidak ada `total`: menghitungnya berarti satu query tambahan di setiap
   * permintaan daftar, padahal UI hanya butuh tahu apakah masih ada lanjutannya.
   */
  readonly nextCursor: string | null;
}

export interface CatalogRepository {
  /** Versi yang dirender "KATALOG PRALON · v2.4". `null` bila katalog belum pernah dipromosikan. */
  findActiveVersion(): Promise<CatalogVersion | null>;

  findVersionById(catalogVersionId: string): Promise<CatalogVersion | null>;

  /**
   * Seluruh versi, terbaru lebih dulu — sumber layar pratinjau dan promosi.
   *
   * Tanpa paginasi, dan itu memang cukup: versi katalog terbit beberapa kali
   * setahun, bukan beberapa kali sehari. Batas atas tetap ada supaya satu query
   * tidak bisa tumbuh tanpa batas kalau suatu hari asumsi itu salah.
   */
  listVersions(limit?: number): Promise<readonly CatalogVersion[]>;

  listProducts(query: ProductListQuery): Promise<ProductListPage>;

  findProductById(catalogVersionId: string, productId: string): Promise<Product | null>;

  /** Daftar "FITTING YANG SEPADAN" — dibaca dari tabel kompatibilitas, tidak ditebak dari kesamaan ukuran. */
  findCompatibleFittings(productId: string): Promise<readonly CompatibleFitting[]>;

  /**
   * Dokumen teknis milik produk ini, untuk tombol "Buka dokumen teknis".
   *
   * Ada di port **baca** katalog, bukan di modul `product-knowledge`, karena
   * `product_documents` adalah tabel konteks katalog. Modul lain membacanya lewat
   * sini supaya tidak ada dua jalur ke satu tabel yang bisa menyimpang.
   */
  findProductDocuments(productId: string): Promise<readonly ProductDocument[]>;
}
