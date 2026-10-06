/**
 * ProductMatcher — memetakan ukuran hasil engine ke produk katalog nyata.
 * docs/DOMAIN_MODEL.md §7 · layar 07 · docs/MATCHER_V2_PROPOSAL.md (v2, 2026-10-06).
 *
 * **Fungsi murni:** ia menerima kandidat yang sudah dibaca pemanggil (per peran, dari repository:
 * keluarga + ukuran bersatuan), bukan repository. Dua alasan: pencocokan bisa diuji tanpa basis
 * data, dan invarian C-2 (kartu produk hanya pernah dari baris `products`) menjadi struktural —
 * matcher tidak punya cara mengarang produk karena ia hanya bisa memilih dari daftar yang diberikan.
 *
 * Tiga `matchState` adalah persis tiga keadaan kartu di layar 07:
 *
 *   - `VERIFIED_SELECTED` — produk ada, ukuran tersedia, dan (bila disyaratkan) kelas tekanannya
 *     VERIFIED sama dengan kelas pipa.
 *   - `SIZE_NEEDS_VALIDATION` — produknya tepat, tetapi ukuran itu tidak terdaftar, ATAU kelas
 *     tekanannya belum terverifikasi (fitting seri "W" Pralon). Bukan kegagalan: pengguna tetap
 *     melihat produknya, dengan catatan.
 *   - `INFORMATION_UNAVAILABLE` — tidak ada produk untuk peran itu di katalog aktif.
 *
 * Kandidat ganda (katalog Pralon: rata-rata 11 SKU per keluarga + ukuran pipa — ujung, warna,
 * panjang batang, merek) dipilih **deterministik dan dijelaskan**: panjang batang yang dipakai BOM
 * (4 m), varian baku (tanpa sufiks merek), lalu SKU terkecil. Sisanya ikut sebagai `alternatives`.
 */

import {
  PipeSize,
  specHasValue,
  type Product,
  type SelectedProduct,
  type SystemRole,
} from '@snouty/shared-types';

export interface RoleRequirement {
  readonly role: SystemRole;
  /** Ukuran yang diminta engine, label kanonik `PipeSize` (`1"`, `63 mm`). */
  readonly size: string;
  /**
   * Keluarga produk yang sesuai peran ini, urut prioritas — yang pertama punya kandidat menang.
   * Fitting Pralon: `['FITTING PVC', 'PVC AW']` (keluarga fitting sendiri, lalu fallback keluarga
   * pipa + kategori FITTING untuk katalog yang tidak memisahkannya).
   */
  readonly families: readonly string[];
  /** Penyaring tambahan atas `category` (tanpa membedakan huruf besar-kecil), mis. `FITTING`. */
  readonly categoryIncludes?: string;
  /**
   * Kelas tekanan pipa yang harus ditemani fitting ini (AW/D/C). Fitting dengan kelas VERIFIED
   * berbeda ditolak; kelas `UNAVAILABLE` hanya diterima sebagai `SIZE_NEEDS_VALIDATION` — seri "W"
   * Pralon belum terverifikasi dan tidak boleh ditebak AW (docs/MATCHER_V2_PROPOSAL.md §2).
   */
  readonly pressureClass?: string;
}

export interface MatchResult {
  readonly products: readonly SelectedProduct[];
  /** Peran yang tidak terlayani katalog — dipakai pemanggil untuk menurunkan provenance. */
  readonly unmatchedRoles: readonly SystemRole[];
}

const MAX_ALTERNATIVES = 10;

/** Pemetaan keluarga pipa → keluarga fitting Pralon (3 baris; dikonfirmasi bersama kamus OQ-48). */
const FITTING_FAMILY_FOR: Readonly<Record<string, string>> = {
  'PVC AW': 'FITTING PVC',
  'PVC D': 'FITTING PVC',
  'PVC C': 'FITTING PVC',
  'PVC VP': 'FITTING PVC',
  'PVC VU': 'FITTING PVC',
  HDPE: 'FITTING HDPE',
  MDPE: 'FITTING HDPE',
};

/** Kelas tekanan yang dibawa nama keluarga pipa PVC; HDPE memakai PN (belum terverifikasi). */
const PRESSURE_CLASS_OF: Readonly<Record<string, string>> = {
  'PVC AW': 'AW',
  'PVC D': 'D',
  'PVC C': 'C',
};

/** Peran pipa: satu keluarga, kategori fitting dikecualikan. */
export function pipeRequirement(role: SystemRole, size: string, family: string): RoleRequirement {
  return { role, size, families: [family] };
}

/** Peran fitting: keluarga fitting Pralon dulu, lalu fallback keluarga pipa + kategori FITTING. */
export function fittingRequirement(size: string, pipeFamily: string): RoleRequirement {
  const dedicated = FITTING_FAMILY_FOR[pipeFamily];
  const pressureClass = PRESSURE_CLASS_OF[pipeFamily];
  return {
    role: 'fitting',
    size,
    families: dedicated ? [dedicated, pipeFamily] : [pipeFamily],
    categoryIncludes: 'FITTING',
    ...(pressureClass ? { pressureClass } : {}),
  };
}

/**
 * Mencocokkan setiap peran dengan satu produk. Produk dipilih dari `candidates`, yang harus
 * berasal dari katalog versi yang sedang dibekukan rekomendasi ini — pemanggil mengambilnya per
 * peran dari repository (keluarga + ukuran); matcher tetap menyaring ulang supaya hasilnya benar
 * apa pun yang dikirim.
 */
export function matchProducts(
  requirements: readonly RoleRequirement[],
  candidates: readonly Product[],
): MatchResult {
  const products: SelectedProduct[] = [];
  const unmatchedRoles: SystemRole[] = [];

  for (const requirement of requirements) {
    const pool = poolFor(requirement, candidates);
    if (pool.length === 0) {
      unmatchedRoles.push(requirement.role);
      continue;
    }

    const wanted = PipeSize.parse(requirement.size);
    const withSize = pool.filter((product) =>
      product.sizes.some((label) => sameSize(label, wanted, requirement.size)),
    );
    const classed = requirement.pressureClass
      ? splitByPressureClass(withSize, requirement.pressureClass)
      : { verified: withSize, unverified: [] as Product[] };

    if (classed.verified.length > 0) {
      const pick = selectCandidate(classed.verified);
      products.push({
        productId: pick.chosen.id,
        size: requirement.size,
        role: requirement.role,
        matchState: 'VERIFIED_SELECTED',
        reason: `${pick.chosen.name} tersedia dalam ukuran ${requirement.size}${pick.why}.`,
        ...(pick.alternatives.length > 0 ? { alternatives: pick.alternatives } : {}),
      });
      continue;
    }

    if (classed.unverified.length > 0) {
      const pick = selectCandidate(classed.unverified);
      products.push({
        productId: pick.chosen.id,
        size: requirement.size,
        role: requirement.role,
        matchState: 'SIZE_NEEDS_VALIDATION',
        reason: `${pick.chosen.name} ada dalam ukuran ${requirement.size}, tetapi kelas tekanannya belum terverifikasi untuk pipa kelas ${requirement.pressureClass}; perlu dikonfirmasi.`,
        ...(pick.alternatives.length > 0 ? { alternatives: pick.alternatives } : {}),
      });
      continue;
    }

    // Ukurannya ada, tetapi semua kandidat berkelas VERIFIED yang BERBEDA (fitting D untuk pipa
    // AW): tidak ada yang boleh dipasangkan — peran ini kosong, bukan "perlu dikonfirmasi".
    if (requirement.pressureClass && withSize.length > 0) {
      unmatchedRoles.push(requirement.role);
      continue;
    }

    // Produknya tepat, ukurannya belum terdaftar — tampilkan dengan catatan, jangan
    // sembunyikan. Menyembunyikan produk yang benar karena satu kolom ukuran kosong
    // akan membuat pengguna menyimpulkan Pralon tidak punya produknya.
    const fallback = selectCandidate(pool).chosen;
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

/** Kandidat sebuah peran: keluarga pertama (urut prioritas) yang punya produk aktif yang cocok. */
function poolFor(requirement: RoleRequirement, candidates: readonly Product[]): Product[] {
  const wanted = requirement.categoryIncludes?.toLowerCase();
  for (const family of requirement.families) {
    const pool = candidates.filter(
      (product) =>
        product.family === family &&
        product.status === 'active' &&
        (wanted === undefined
          ? !product.category.toLowerCase().includes('fitting')
          : product.category.toLowerCase().includes(wanted)),
    );
    if (pool.length > 0) return pool;
  }
  return [];
}

function sameSize(label: string, wanted: PipeSize | null, rawWanted: string): boolean {
  if (wanted === null) return label === rawWanted;
  const parsed = PipeSize.parse(label);
  return parsed !== null && parsed.equals(wanted);
}

function splitByPressureClass(
  products: readonly Product[],
  pressureClass: string,
): { verified: Product[]; unverified: Product[] } {
  const verified: Product[] = [];
  const unverified: Product[] = [];
  for (const product of products) {
    const spec = product.pressureClass;
    if (!specHasValue(spec)) {
      unverified.push(product);
      continue;
    }
    if (spec.value.trim().toUpperCase() === pressureClass.toUpperCase()) verified.push(product);
    // Kelas VERIFIED yang berbeda (fitting D untuk pipa AW) dibuang diam-diam: itu bukan kandidat.
  }
  return { verified, unverified };
}

interface Selection {
  readonly chosen: Product;
  readonly why: string;
  readonly alternatives: readonly { readonly productId: string; readonly name: string }[];
}

/** Urutan prioritas panjang batang: yang dipakai BOM (4 m) dulu — kuantitas BOM mengikutinya. */
const ROD_LENGTH_RANK: readonly string[] = ['4 m', '5.8 m', '6 m'];

/**
 * Pemilihan deterministik dari kandidat ganda; kriterianya teknis dan dicatat di `why`:
 *   1. panjang batang yang dipakai BOM (4 m → 5,8 m → 6 m → lainnya);
 *   2. varian baku: nama tanpa sufiks merek/varian (lebih pendek) — warna dan merek bukan kriteria
 *      teknis, jadi tidak pernah dipilih "karena warna";
 *   3. SKU terkecil — supaya hasilnya sama di setiap jalankan.
 */
export function selectCandidate(products: readonly Product[]): Selection {
  const ranked = [...products].sort((a, b) => {
    const rod = rodRank(a) - rodRank(b);
    if (rod !== 0) return rod;
    const name = a.name.length - b.name.length;
    if (name !== 0) return name;
    return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0;
  });
  const chosen = ranked[0]!;
  const alternatives = ranked.slice(1, 1 + MAX_ALTERNATIVES).map((product) => ({
    productId: product.id,
    name: product.name,
  }));
  if (ranked.length === 1) return { chosen, why: '', alternatives };

  const criteria: string[] = [];
  const rod = specHasValue(chosen.rodLength) ? chosen.rodLength.value : null;
  if (rod !== null && ROD_LENGTH_RANK.includes(normaliseRod(rod))) {
    criteria.push(`batang ${rod} sesuai perhitungan material`);
  }
  criteria.push('varian baku');
  return {
    chosen,
    why: ` — dipilih dari ${ranked.length} varian (${criteria.join(', ')}); ${ranked.length - 1} alternatif lain`,
    alternatives,
  };
}

function rodRank(product: Product): number {
  if (!specHasValue(product.rodLength)) return ROD_LENGTH_RANK.length + 1;
  const index = ROD_LENGTH_RANK.indexOf(normaliseRod(product.rodLength.value));
  return index === -1 ? ROD_LENGTH_RANK.length : index;
}

function normaliseRod(value: string): string {
  return value.trim().toLowerCase().replace(',', '.').replace(/\s+/g, ' ');
}

/**
 * Peran yang perlu dicocokkan dari hasil engine bangunan. `fitting` memakai keluarga fitting
 * Pralon (lalu fallback keluarga pipa + kategori FITTING) — fitting bukan pipa, dan peran tee
 * tidak boleh terisi pipa.
 */
export function requirementsFrom(input: {
  readonly mainSize: string;
  readonly branchSize: string;
  readonly fixtureSize: string;
  readonly pipeFamily: string;
}): readonly RoleRequirement[] {
  return [
    pipeRequirement('main', input.mainSize, input.pipeFamily),
    pipeRequirement('riser', input.mainSize, input.pipeFamily),
    pipeRequirement('branch', input.branchSize, input.pipeFamily),
    pipeRequirement('fixture', input.fixtureSize, input.pipeFamily),
    fittingRequirement(input.branchSize, input.pipeFamily),
  ];
}
