/**
 * Gambar kartu produk (DD-01 #3, #6; P17-06).
 *
 * Foto asli dari pralon.com hanya untuk keluarga yang fotonya memang foto keluarga itu (AW, VP,
 * Jacking — `data/catalog/images-pralon-com/mapping.csv`, confidence high). Keluarga lain memakai
 * gambar jenis produk SNOUTY sampai foto dari tim Pralon datang (OQ-62). Jenis fitting dibaca dari
 * kategori katalog; kategori yang belum punya gambar jenisnya tidak diberi gambar — lebih baik
 * kosong daripada gambar jenis yang salah.
 */

import type { ProductIllustration } from '@snouty/ui/illustrations';
import type { ProductColors } from '../illustration/illustration';

export type ProductVisual =
  | { readonly kind: 'photo'; readonly src: string }
  | {
      readonly kind: 'drawing';
      readonly name: ProductIllustration;
      readonly colors: ProductColors;
    };

/** Foto pralon.com, disimpan di server SNOUTY (`public/products`), tidak di-hotlink. */
const PHOTO_BY_FAMILY: Readonly<Record<string, string>> = {
  'PVC AW': '/products/pvc-aw.jpg',
  'PVC VP': '/products/pvc-vp.webp',
  'PIPA JACKING': '/products/pipa-jacking.webp',
};

/** Warna benda (pipa putih, pipa/fitting abu) — warna produknya, bukan warna tema. */
const WHITE: ProductColors = { body: '#f4f6f6', line: '#8e999c', text: '#6b7376' };
const GREY: ProductColors = { body: '#a9b1b4', line: '#7c868a', text: '#ffffff' };
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
  if (photo) return { kind: 'photo', src: photo };
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
