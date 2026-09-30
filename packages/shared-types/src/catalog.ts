/**
 * Tipe domain katalog produk. docs/DOMAIN_MODEL.md §5 · docs/PRODUCT_KNOWLEDGE.md §2.
 *
 * Satu keputusan membentuk seluruh berkas ini: **field spesifikasi yang kosong
 * bukan `null` yang dihilangkan dari respons, melainkan nilai eksplisit
 * bertanda `UNAVAILABLE`.** UI perlu membedakan "Pralon belum memberi datanya"
 * dari "field ini tidak berlaku" — yang pertama dirender sebagai
 * "Lihat dokumen teknis", yang kedua tidak dirender sama sekali.
 */

import type { Provenance } from './provenance.js';

export type CatalogVersionStatus = 'draft' | 'active' | 'archived';
export type ProductStatus = 'active' | 'discontinued';
export type PressureClass = 'AW' | 'D';
export type FittingKind = 'tee' | 'elbow' | 'reducer' | 'socket';

export interface CatalogVersion {
  readonly id: string;
  /** Tampil di UI sebagai "KATALOG PRALON · v2.4". */
  readonly label: string;
  /** mis. "Katalog produk Pralon 2026" — wajib, karena UI menjanjikan data ini bisa dicek. */
  readonly sourceDocument: string;
  readonly status: CatalogVersionStatus;
  readonly effectiveFrom: string;
  readonly importedBy: string;
}

/**
 * Nilai spesifikasi beserta asal-usulnya.
 *
 * Perhatikan bahwa `provenance` di sini hanya pernah `VERIFIED` atau
 * `UNAVAILABLE`. Tidak ada jalur yang menghasilkan fakta produk bertanda
 * `ASSUMED` — asumsi berlaku untuk kebutuhan pengguna, bukan untuk spesifikasi
 * pipa. Pralon tahu tekanan kerja produknya; kalau datanya belum ada di sistem,
 * itu kekurangan data, bukan sesuatu yang boleh diperkirakan.
 */
export interface SpecValue {
  readonly value: string | null;
  readonly provenance: Extract<Provenance, 'VERIFIED' | 'UNAVAILABLE'>;
  /** Diisi saat nilainya berasal dari dokumen teknis, bukan kolom katalog. */
  readonly sourceDocument?: string;
  readonly sourcePage?: number;
}

export interface Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  /** mis. "PVC AW" — keluarga produk, dipakai matcher untuk menyaring per peran. */
  readonly family: string;
  /** mis. "PIPA AIR BERSIH · SNI" — teks caption di kartu produk. */
  readonly category: string;
  readonly description: string;
  readonly status: ProductStatus;

  /** Ukuran kanonik yang tersedia, sudah terurut menaik. */
  readonly sizes: readonly string[];

  readonly material: SpecValue;
  readonly standard: SpecValue;
  /** "Tekanan kerja" — pada Pralon PVC AW di desain, nilainya memang UNAVAILABLE. */
  readonly pressureClass: SpecValue;
  /** "Panjang batang". */
  readonly rodLength: SpecValue;
  /** "Sambungan". */
  readonly jointType: SpecValue;
  readonly application: SpecValue;

  /** Wajib: dirender sebagai "Katalog produk Pralon 2026 · hal. 14". */
  readonly sourceDocument: string;
  readonly sourcePage: number;
  readonly catalogVersionId: string;

  /** Kosong berarti placeholder bergaris — tidak pernah foto produk lain. */
  readonly imageUrl: string | null;
}

/** Fitting yang sepadan, dari tabel kompatibilitas — bukan ditebak dari kesamaan ukuran. */
export interface CompatibleFitting {
  readonly productId: string;
  readonly name: string;
  readonly kind: FittingKind;
}

/** Tiga keadaan kartu produk pada layar 07. */
export type ProductMatchState =
  'VERIFIED_SELECTED' | 'SIZE_NEEDS_VALIDATION' | 'INFORMATION_UNAVAILABLE';

/** Satu baris galat impor. Semua baris dilaporkan sekaligus, bukan satu per satu. */
export interface CatalogImportIssue {
  readonly rowNumber: number;
  readonly column: string;
  readonly message: string;
}

export interface CatalogImportResult {
  readonly catalogVersionId: string;
  readonly rowsAccepted: number;
  readonly rowsRejected: number;
  readonly issues: readonly CatalogImportIssue[];
}
