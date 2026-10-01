/**
 * Enam field spesifikasi yang dikenal katalog, dan nama `spec_key`-nya di database.
 *
 * Satu definisi dipakai dua arah: validator impor memakainya untuk memutuskan
 * kolom mana yang menjadi spesifikasi, dan mapper pembacaan memakainya untuk
 * memutuskan field mana yang harus ada di `Product`. Dua daftar terpisah pasti
 * menyimpang — dan menyimpangnya akan terlihat sebagai spesifikasi yang ikut
 * terimpor tetapi tidak pernah terbaca.
 *
 * docs/PRODUCT_KNOWLEDGE.md §2.
 */

export const CATALOG_SPEC_KEYS = {
  material: 'material',
  standard: 'standard',
  /** "Tekanan kerja" — pada Pralon PVC AW di desain, nilainya memang UNAVAILABLE. */
  pressureClass: 'pressure_class',
  /** "Panjang batang". */
  rodLength: 'rod_length',
  /** "Sambungan". */
  jointType: 'joint_type',
  application: 'application',
} as const;

export type CatalogSpecKey = (typeof CATALOG_SPEC_KEYS)[keyof typeof CATALOG_SPEC_KEYS];

export const CATALOG_SPEC_KEY_LIST: readonly CatalogSpecKey[] = Object.values(CATALOG_SPEC_KEYS);
