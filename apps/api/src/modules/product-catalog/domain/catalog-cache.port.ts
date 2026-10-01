/**
 * Port cache katalog. docs/PRODUCT_KNOWLEDGE.md §7 · docs/PERFORMANCE.md §5.
 *
 * Katalog berubah jarang dan dibaca sangat sering — rasio yang ideal untuk cache.
 * Karena itu invalidasinya dipicu **peristiwa promosi versi**, bukan sekadar
 * menunggu TTL habis: katalog baru harus langsung terlihat, bukan terlihat
 * sebagian selama satu jam.
 */

export const CATALOG_CACHE = Symbol('CATALOG_CACHE');

/** Awalan kunci cache produk. Disimpan sebagai konstanta karena invalidasi memindainya. */
export const CATALOG_PRODUCT_KEY_PREFIX = 'snouty:cache:product:';
export const CATALOG_ACTIVE_VERSION_KEY = 'snouty:cache:catalog:active';

export function catalogProductKey(productId: string): string {
  return `${CATALOG_PRODUCT_KEY_PREFIX}${productId}`;
}

/** TTL cache katalog: 1 jam (docs/PRODUCT_KNOWLEDGE.md §7). */
export const CATALOG_CACHE_TTL_SECONDS = 3600;

export interface CatalogCache {
  /** `null` berarti belum ada di cache — bukan berarti datanya tidak ada. */
  read<T>(key: string): Promise<T | null>;

  write(key: string, value: unknown): Promise<void>;

  /**
   * Membuang seluruh entri katalog dan mengembalikan jumlah kunci yang terhapus.
   *
   * Jumlahnya dikembalikan bukan demi kelengkapan: promosi versi adalah aksi yang
   * mengubah apa yang dilihat semua pengguna, dan angka itu yang membuat log serta
   * tesnya bisa menyatakan invalidasinya benar-benar terjadi.
   */
  invalidateAll(): Promise<number>;
}
