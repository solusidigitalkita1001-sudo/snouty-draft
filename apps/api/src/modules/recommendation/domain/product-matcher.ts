/**
 * ProductMatcher — memetakan ukuran hasil engine ke produk katalog nyata.
 * docs/DOMAIN_MODEL.md §7 · layar 07.
 *
 * **Fungsi murni:** ia menerima produk yang sudah dibaca pemanggil, bukan repository.
 * Dua alasan: pencocokan bisa diuji tanpa basis data, dan invarian C-2 (kartu produk
 * hanya pernah dari baris `products`) menjadi struktural — matcher tidak punya cara
 * mengarang produk karena ia hanya bisa memilih dari daftar yang diberikan.
 *
 * Tiga `matchState` adalah persis tiga keadaan kartu di layar 07:
 *
 *   - `VERIFIED_SELECTED` — produk ada dan ukuran yang dibutuhkan tersedia.
 *   - `SIZE_NEEDS_VALIDATION` — produknya tepat, tetapi ukuran itu tidak terdaftar.
 *     Ini **bukan** kegagalan: pengguna tetap melihat produknya, dengan catatan bahwa
 *     ukurannya perlu dikonfirmasi — jauh lebih berguna daripada menyembunyikannya.
 *   - `INFORMATION_UNAVAILABLE` — tidak ada produk untuk peran itu di katalog aktif.
 */

import type { Product, SelectedProduct, SystemRole } from '@snouty/shared-types';

export interface RoleRequirement {
  readonly role: SystemRole;
  /** Ukuran yang diminta engine, label kanonik (mis. `1"`). */
  readonly size: string;
  /** Keluarga produk yang sesuai peran ini (mis. `PVC AW`). */
  readonly family: string;
  /**
   * Penyaring tambahan atas `category` (tanpa membedakan huruf besar-kecil), mis. `FITTING`:
   * fitting Pralon hidup di keluarga yang sama dengan pipanya (PVC AW) dan dibedakan lewat
   * kategori — menyamakan keduanya membuat matcher memilih pipa untuk peran tee (OQ-48).
   */
  readonly categoryIncludes?: string;
}

export interface MatchResult {
  readonly products: readonly SelectedProduct[];
  /** Peran yang tidak terlayani katalog — dipakai pemanggil untuk menurunkan provenance. */
  readonly unmatchedRoles: readonly SystemRole[];
}

/**
 * Mencocokkan setiap peran dengan satu produk. Produk dipilih dari `candidates`, yang
 * harus berasal dari katalog versi yang sedang dibekukan rekomendasi ini.
 */
export function matchProducts(
  requirements: readonly RoleRequirement[],
  candidates: readonly Product[],
): MatchResult {
  const products: SelectedProduct[] = [];
  const unmatchedRoles: SystemRole[] = [];

  for (const requirement of requirements) {
    const wanted = requirement.categoryIncludes?.toLowerCase();
    const family = candidates.filter(
      (product) =>
        product.family === requirement.family &&
        product.status === 'active' &&
        (wanted === undefined
          ? !product.category.toLowerCase().includes('fitting')
          : product.category.toLowerCase().includes(wanted)),
    );

    if (family.length === 0) {
      unmatchedRoles.push(requirement.role);
      continue;
    }

    const exact = family.find((product) => product.sizes.includes(requirement.size));

    if (exact) {
      products.push({
        productId: exact.id,
        size: requirement.size,
        role: requirement.role,
        matchState: 'VERIFIED_SELECTED',
        reason: `${exact.name} tersedia dalam ukuran ${requirement.size}.`,
      });
      continue;
    }

    // Produknya tepat, ukurannya belum terdaftar — tampilkan dengan catatan, jangan
    // sembunyikan. Menyembunyikan produk yang benar karena satu kolom ukuran kosong
    // akan membuat pengguna menyimpulkan Pralon tidak punya produknya.
    const fallback = family[0]!;
    products.push({
      productId: fallback.id,
      size: requirement.size,
      role: requirement.role,
      matchState: 'SIZE_NEEDS_VALIDATION',
      reason: `Ukuran ${requirement.size} belum tercatat untuk ${fallback.name}; perlu dikonfirmasi.`,
    });
  }

  return { products, unmatchedRoles };
}

/**
 * Peran yang perlu dicocokkan dari hasil engine. `fitting` dibedakan lewat kategori
 * (`FITTING`) di keluarga yang sama — fitting bukan pipa, dan peran tee tidak boleh
 * terisi pipa.
 */
export function requirementsFrom(input: {
  readonly mainSize: string;
  readonly branchSize: string;
  readonly fixtureSize: string;
  readonly pipeFamily: string;
}): readonly RoleRequirement[] {
  return [
    { role: 'main', size: input.mainSize, family: input.pipeFamily },
    { role: 'riser', size: input.mainSize, family: input.pipeFamily },
    { role: 'branch', size: input.branchSize, family: input.pipeFamily },
    { role: 'fixture', size: input.fixtureSize, family: input.pipeFamily },
    fittingRequirement(input.branchSize, input.pipeFamily),
  ];
}

/** Peran fitting: keluarga pipa yang sama, kategori memuat "FITTING". */
export function fittingRequirement(size: string, pipeFamily: string): RoleRequirement {
  return { role: 'fitting', size, family: pipeFamily, categoryIncludes: 'FITTING' };
}
