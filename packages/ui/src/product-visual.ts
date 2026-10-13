/**
 * Gambar kartu produk (DD-01 #3, #6; P17-06).
 *
 * Foto asli dari pralon.com hanya untuk keluarga yang fotonya memang foto keluarga itu (AW, VP,
 * Jacking — `data/catalog/images-pralon-com/mapping.csv`, confidence high). Keluarga lain memakai
 * gambar jenis produk SNOUTY sampai foto dari tim Pralon datang (OQ-62). Jenis fitting dibaca dari
 * kategori katalog; kategori yang belum punya gambar jenisnya tidak diberi gambar — lebih baik
 * kosong daripada gambar jenis yang salah.
 */

import type { ProductIllustration } from './illustrations.js';

/** Warna gambar produk: badan, garis, tulisan (nilai CSS — token `--snouty-product-*`). */
export interface ProductColors {
  readonly body: string;
  readonly line: string;
  readonly text: string;
}

/**
 * Berkas foto pralon.com. Web menyajikannya dari `apps/web/public/products`, laporan PDF
 * menyisipkannya dari `apps/api/assets/report/products` — keduanya salinan berkas yang sama,
 * tidak di-hotlink ke pralon.com.
 */
export const PRODUCT_PHOTO_FILES = ['pvc-aw.jpg', 'pvc-vp.webp', 'pipa-jacking.webp'] as const;
export type ProductPhoto = (typeof PRODUCT_PHOTO_FILES)[number];

export type ProductVisual =
  | { readonly kind: 'photo'; readonly file: ProductPhoto }
  | {
      readonly kind: 'drawing';
      readonly name: ProductIllustration;
      readonly colors: ProductColors;
    };

const PHOTO_BY_FAMILY: Readonly<Record<string, ProductPhoto>> = {
  'PVC AW': 'pvc-aw.jpg',
  'PVC VP': 'pvc-vp.webp',
  'PIPA JACKING': 'pipa-jacking.webp',
};

/** Warna benda (pipa putih, pipa/fitting abu) — warna produknya, bukan warna tema. */
const WHITE: ProductColors = {
  body: 'var(--snouty-product-white)',
  line: 'var(--snouty-product-white-line)',
  text: 'var(--snouty-product-white-label)',
};
const GREY: ProductColors = {
  body: 'var(--snouty-product-grey)',
  line: 'var(--snouty-product-grey-line)',
  text: 'var(--snouty-product-grey-label)',
};
const WHITE_PIPE_FAMILIES = new Set(['PVC AW']);

/**
 * Kata kategori katalog Pralon → gambar jenis. Urutan penting: "CLEAN OUT CAP" adalah clean out,
 * "ELBOW REDUCER" adalah elbow. Ini kosakata katalog, bukan pola kalimat pengguna.
 */
const FITTING_BY_CATEGORY: readonly (readonly [RegExp, ProductIllustration])[] = [
  [/CLEAN OUT/, 'cleanout'],
  [/\b(LONG )?TY\b|\bY\b/, 'y'],
  [/TEE/, 'tee'],
  [/ELBOW|BEND/, 'elbow'],
  [/\bCAP\b/, 'cap'],
  [/SOCKET/, 'socket'],
];

export function productVisual(product: {
  readonly family?: string;
  readonly category?: string;
  readonly size?: string;
  readonly kind: 'pipe' | 'fitting';
}): ProductVisual | null {
  const photo = product.family ? PHOTO_BY_FAMILY[product.family] : undefined;
  if (photo) return { kind: 'photo', file: photo };
  if (product.kind === 'pipe') {
    const colors = product.family && WHITE_PIPE_FAMILIES.has(product.family) ? WHITE : GREY;
    return { kind: 'drawing', name: 'pipe', colors };
  }
  const category = product.category?.toUpperCase() ?? '';
  const match = FITTING_BY_CATEGORY.find(([pattern]) => pattern.test(category));
  if (!match) return null;
  // Tee dengan dua ukuran ("1\" × 3/4\"") digambar sebagai tee reduksi.
  const name = match[1] === 'tee' && product.size?.includes('×') ? 'rtee' : match[1];
  return { kind: 'drawing', name, colors: GREY };
}
