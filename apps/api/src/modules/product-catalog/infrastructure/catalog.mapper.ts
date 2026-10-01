/**
 * Pemetaan baris MySQL → tipe domain katalog.
 *
 * Dipisahkan dari repository karena di sinilah keputusan yang paling mudah
 * dilanggar hidup: **spesifikasi yang tidak punya baris tetap menjadi nilai
 * eksplisit `UNAVAILABLE`, bukan field yang hilang.** UI membedakan "Pralon
 * belum memberi datanya" (dirender "Lihat dokumen teknis") dari "field tidak
 * berlaku" (tidak dirender). Menghapus field berarti menghapus perbedaan itu.
 *
 * docs/PRODUCT_KNOWLEDGE.md §2 · docs/API_CONTRACTS.md §4 · invarian C-1.
 */

import type {
  CatalogVersion,
  CatalogVersionStatus,
  CompatibleFitting,
  FittingKind,
  Product,
  ProductStatus,
  SpecValue,
} from '@snouty/shared-types';

export interface ProductRow {
  readonly id: string;
  readonly catalogVersionId: string;
  readonly sku: string;
  readonly name: string;
  readonly family: string;
  readonly category: string;
  readonly description: string | null;
  readonly status: string;
  readonly sourceDocument: string;
  readonly sourcePage: number;
  readonly imageUrl: string | null;
}

export interface SizeRow {
  readonly productId: string;
  readonly sizeLabel: string;
}

export interface SpecRow {
  readonly productId: string;
  readonly specKey: string;
  readonly specValue: string | null;
  readonly provenance: string;
  readonly sourceDocument: string | null;
  readonly sourcePage: number | null;
}

export interface CatalogVersionRow {
  readonly id: string;
  readonly label: string;
  readonly sourceDocument: string;
  readonly status: string;
  readonly effectiveFrom: Date;
  readonly importedBy: string;
}

export interface CompatibilityRow {
  readonly compatibleProductId: string;
  readonly name: string;
  readonly kind: string;
}

/** Nama kolom `spec_key` untuk tiap field spesifikasi pada `Product`. */
const SPEC_KEYS = {
  material: 'material',
  standard: 'standard',
  pressureClass: 'pressure_class',
  rodLength: 'rod_length',
  jointType: 'joint_type',
  application: 'application',
} as const;

export const SPEC_COLUMN_KEYS: readonly string[] = Object.values(SPEC_KEYS);

const UNAVAILABLE: SpecValue = Object.freeze({ value: null, provenance: 'UNAVAILABLE' });

/**
 * Nilai spesifikasi beserta asal-usulnya.
 *
 * Perhatikan arah kehati-hatiannya: apa pun yang tidak jelas-jelas `VERIFIED`
 * dikembalikan sebagai `UNAVAILABLE` **tanpa nilai**. Baris yang menyimpan teks
 * tetapi bertanda `UNAVAILABLE` karena itu tidak pernah terbaca sebagai fakta
 * produk — lebih baik UI menampilkan "Lihat dokumen teknis" daripada menampilkan
 * nilai yang tidak bisa dipertanggungjawabkan.
 */
function toSpecValue(row: SpecRow | undefined): SpecValue {
  if (row === undefined || row.specValue === null || row.provenance !== 'VERIFIED') {
    return UNAVAILABLE;
  }
  return {
    value: row.specValue,
    provenance: 'VERIFIED',
    ...(row.sourceDocument !== null ? { sourceDocument: row.sourceDocument } : {}),
    ...(row.sourcePage !== null ? { sourcePage: row.sourcePage } : {}),
  };
}

/**
 * CHECK di database sudah membatasi nilainya. Kalau nilai lain sampai di sini,
 * constraint-nya hilang — itu kabar yang harus terdengar, bukan dibulatkan
 * menjadi 'active'.
 */
function toProductStatus(raw: string): ProductStatus {
  if (raw === 'active' || raw === 'discontinued') return raw;
  throw new Error(`status produk tidak dikenal di database: ${raw}`);
}

function toVersionStatus(raw: string): CatalogVersionStatus {
  if (raw === 'draft' || raw === 'active' || raw === 'archived') return raw;
  throw new Error(`status versi katalog tidak dikenal di database: ${raw}`);
}

function toFittingKind(raw: string): FittingKind {
  if (raw === 'tee' || raw === 'elbow' || raw === 'reducer' || raw === 'socket') return raw;
  throw new Error(`jenis fitting tidak dikenal di database: ${raw}`);
}

/** Mengelompokkan baris anak per `productId` sekali jalan, supaya pemetaan tetap O(n). */
export function groupByProductId<T extends { readonly productId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.productId);
    if (bucket === undefined) grouped.set(row.productId, [row]);
    else bucket.push(row);
  }
  return grouped;
}

export function toProduct(
  row: ProductRow,
  sizes: readonly SizeRow[],
  specs: readonly SpecRow[],
): Product {
  const byKey = new Map(specs.map((spec) => [spec.specKey, spec]));
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    family: row.family,
    category: row.category,
    description: row.description ?? '',
    status: toProductStatus(row.status),
    // Urutan sudah ditentukan oleh `ORDER BY size_inches_x1000` di query:
    // mengurutkan ulang di sini atas label akan menaruh `1¼"` sebelum `1"`.
    sizes: sizes.map((size) => size.sizeLabel),
    material: toSpecValue(byKey.get(SPEC_KEYS.material)),
    standard: toSpecValue(byKey.get(SPEC_KEYS.standard)),
    pressureClass: toSpecValue(byKey.get(SPEC_KEYS.pressureClass)),
    rodLength: toSpecValue(byKey.get(SPEC_KEYS.rodLength)),
    jointType: toSpecValue(byKey.get(SPEC_KEYS.jointType)),
    application: toSpecValue(byKey.get(SPEC_KEYS.application)),
    sourceDocument: row.sourceDocument,
    sourcePage: row.sourcePage,
    catalogVersionId: row.catalogVersionId,
    imageUrl: row.imageUrl,
  };
}

export function toProducts(
  rows: readonly ProductRow[],
  sizeRows: readonly SizeRow[],
  specRows: readonly SpecRow[],
): Product[] {
  const sizes = groupByProductId(sizeRows);
  const specs = groupByProductId(specRows);
  return rows.map((row) => toProduct(row, sizes.get(row.id) ?? [], specs.get(row.id) ?? []));
}

export function toCatalogVersion(row: CatalogVersionRow): CatalogVersion {
  return {
    id: row.id,
    label: row.label,
    sourceDocument: row.sourceDocument,
    status: toVersionStatus(row.status),
    // ISO-8601 UTC; konversi zona waktu adalah urusan lapisan tampilan.
    effectiveFrom: row.effectiveFrom.toISOString(),
    importedBy: row.importedBy,
  };
}

export function toCompatibleFitting(row: CompatibilityRow): CompatibleFitting {
  return {
    productId: row.compatibleProductId,
    name: row.name,
    kind: toFittingKind(row.kind),
  };
}
