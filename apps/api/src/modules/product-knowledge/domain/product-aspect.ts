/**
 * Kosakata tertutup aspek pertanyaan produk. docs/PRODUCT_KNOWLEDGE.md §4.
 *
 * Setiap aspek di sini **wajib** punya jalur data. Itu yang menegakkan aturan
 * pertama konteks ini: bila jawabannya ada di kolom, jangan mencarinya di dokumen.
 * Aspek tanpa jalur data adalah aspek yang cepat atau lambat dijawab LLM dari
 * ingatannya — dan ingatan model bukan katalog Pralon.
 *
 * Karena kosakatanya tertutup, intent router di Fase 4 memetakan pertanyaan bebas
 * ke salah satu nilai di sini, bukan mengarang nama aspek sendiri. Pertanyaan yang
 * tidak memetakan ke mana pun adalah pertanyaan yang belum didukung — jawaban yang
 * benar untuk itu adalah mengakuinya, bukan menebak aspek terdekat.
 */

import { CATALOG_SPEC_KEYS } from '../../product-catalog/domain/catalog-spec-keys.js';

export const PRODUCT_ASPECTS = {
  /** "Ukuran apa saja yang tersedia?" */
  sizes: 'sizes',
  /** "Ada ukuran 3/4 inch?" — butuh ukuran yang ditanyakan. */
  sizeAvailability: 'size_availability',
  /** "Fitting apa yang cocok?" */
  compatibleFittings: 'compatible_fittings',

  // Enam di bawah ini adalah field spesifikasi, dan namanya sengaja SAMA dengan
  // `spec_key` di database. Dua kosakata untuk satu hal akan menuntut tabel
  // pemetaan, dan tabel pemetaan adalah tempat penyimpangan bersembunyi.
  material: CATALOG_SPEC_KEYS.material,
  standard: CATALOG_SPEC_KEYS.standard,
  pressureClass: CATALOG_SPEC_KEYS.pressureClass,
  rodLength: CATALOG_SPEC_KEYS.rodLength,
  jointType: CATALOG_SPEC_KEYS.jointType,
  application: CATALOG_SPEC_KEYS.application,
} as const;

export type ProductAspect = (typeof PRODUCT_ASPECTS)[keyof typeof PRODUCT_ASPECTS];

export const PRODUCT_ASPECT_LIST: readonly ProductAspect[] = Object.values(PRODUCT_ASPECTS);

/**
 * Dari mana aspek ini dijawab.
 *
 * Dinyatakan sebagai data, bukan sebagai rangkaian `if`, supaya "setiap aspek punya
 * jalur data" bisa diperiksa satu tes — bukan dibaca ulang setiap kali ada aspek baru.
 */
export type AspectSource = 'product_sizes' | 'product_compatibility' | 'product_specs';

export const ASPECT_SOURCE: Readonly<Record<ProductAspect, AspectSource>> = {
  [PRODUCT_ASPECTS.sizes]: 'product_sizes',
  [PRODUCT_ASPECTS.sizeAvailability]: 'product_sizes',
  [PRODUCT_ASPECTS.compatibleFittings]: 'product_compatibility',
  [PRODUCT_ASPECTS.material]: 'product_specs',
  [PRODUCT_ASPECTS.standard]: 'product_specs',
  [PRODUCT_ASPECTS.pressureClass]: 'product_specs',
  [PRODUCT_ASPECTS.rodLength]: 'product_specs',
  [PRODUCT_ASPECTS.jointType]: 'product_specs',
  [PRODUCT_ASPECTS.application]: 'product_specs',
};

/** Label Bahasa Indonesia untuk dirangkai LLM menjadi kalimat — bukan untuk mencari data. */
export const ASPECT_LABEL: Readonly<Record<ProductAspect, string>> = {
  [PRODUCT_ASPECTS.sizes]: 'Ukuran tersedia',
  [PRODUCT_ASPECTS.sizeAvailability]: 'Ketersediaan ukuran',
  [PRODUCT_ASPECTS.compatibleFittings]: 'Fitting yang sepadan',
  [PRODUCT_ASPECTS.material]: 'Material',
  [PRODUCT_ASPECTS.standard]: 'Standar',
  [PRODUCT_ASPECTS.pressureClass]: 'Tekanan kerja',
  [PRODUCT_ASPECTS.rodLength]: 'Panjang batang',
  [PRODUCT_ASPECTS.jointType]: 'Sambungan',
  [PRODUCT_ASPECTS.application]: 'Aplikasi',
};

/** Aspek yang tidak berarti tanpa ukuran yang ditanyakan. */
export function requiresSize(aspect: ProductAspect): boolean {
  return aspect === PRODUCT_ASPECTS.sizeAvailability;
}

export function isProductAspect(raw: string): raw is ProductAspect {
  return (PRODUCT_ASPECT_LIST as readonly string[]).includes(raw);
}
