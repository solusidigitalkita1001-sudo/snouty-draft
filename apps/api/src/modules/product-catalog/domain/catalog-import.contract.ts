/**
 * Kontrak impor katalog — sengaja bebas format.
 *
 * Sumber katalog Pralon yang sebenarnya belum ditentukan (OQ-07). Itu bukan
 * alasan menunda impornya: yang dibekukan di sini adalah bentuk **setelah**
 * parsing, bukan bentuk berkasnya. Menambahkan Excel, CSV, atau ekspor ERP nanti
 * berarti menambah satu adapter yang menghasilkan `CatalogImportSource` — bukan
 * merombak validasi, job, maupun layar back-office.
 *
 * Validasinya ada di `catalog-import.validator.ts` dan murni: tanpa I/O, tanpa
 * database, tanpa framework. Itu yang membuat seluruh aturan di
 * docs/PRODUCT_KNOWLEDGE.md §3 bisa diuji dengan tes unit yang cepat.
 */

import type {
  CatalogImportIssue,
  FittingKind,
  PipeSize,
  ProductStatus,
  SpecValue,
} from '@snouty/shared-types';
import type { CatalogSpecKey } from './catalog-spec-keys.js';

/**
 * Satu baris mentah dari sumber mana pun.
 *
 * `values` boleh berisi string tunggal **atau** daftar string: adapter tabular
 * mengirim satu sel bertanda pemisah (`"3/4; 1"`), adapter ERP mengirim daftar
 * apa adanya. Keduanya sah, sehingga bentuk berkas tidak merembes ke validator.
 *
 * `rowNumber` adalah nomor baris di sumber aslinya — pada berkas tabular baris 1
 * biasanya header, jadi data mulai dari 2. Nomor ini hanya dipakai untuk
 * melaporkan galat ke manusia; ia tidak pernah ikut menentukan identitas baris.
 */
export interface RawCatalogRow {
  readonly rowNumber: number;
  readonly values: Readonly<Record<string, string | readonly string[]>>;
}

/** Hasil satu adapter: metadata versi + daftar kolom + baris mentah. */
export interface CatalogImportSource {
  /** Label versi yang akan dibuat, mis. `v2.4`. Dipilih `catalog_admin` saat unggah. */
  readonly label: string;
  /**
   * Dokumen asal baku untuk seluruh baris, mis. "Katalog produk Pralon 2026".
   * Satu baris boleh menimpanya lewat kolom `source_document`, supaya satu impor
   * bisa menggabungkan katalog pipa dan katalog fitting.
   */
  readonly sourceDocument: string;
  /**
   * Kolom yang benar-benar ada di sumber. Dipisahkan dari `rows` supaya kolom
   * wajib yang hilang dilaporkan **sekali**, bukan sekali untuk setiap baris.
   */
  readonly columns: readonly string[];
  readonly rows: readonly RawCatalogRow[];
}

/**
 * Port adapter format. Implementasinya **belum ada**: formatnya menunggu OQ-07.
 * Deklarasinya tetap di sini supaya job dan layar back-office bisa dibangun
 * terhadap kontrak ini, bukan terhadap satu format tertentu.
 */
export interface CatalogImportAdapter {
  /** mis. `xlsx`, `csv`. */
  readonly format: string;
  supports(filename: string, mimeType: string): boolean;
  read(input: {
    readonly label: string;
    readonly sourceDocument: string;
    readonly bytes: Uint8Array;
  }): Promise<CatalogImportSource>;
}

/** Nama kolom kanonik. Adapter memetakan judul kolomnya sendiri ke nama-nama ini. */
export const CATALOG_IMPORT_COLUMNS = {
  required: ['sku', 'name', 'family', 'category', 'source_page'] as const,
  optional: [
    'source_document',
    'description',
    'status',
    'image_url',
    'sizes',
    'compatible_skus',
    'material',
    'standard',
    'pressure_class',
    'rod_length',
    'joint_type',
    'application',
  ] as const,
} as const;

/** Pemisah nilai jamak dalam satu sel; baris baru juga diterima. */
export const CATALOG_IMPORT_MULTI_VALUE_SEPARATOR = ';';

/** Rujukan fitting sepadan, masih berupa SKU karena id belum terbit saat validasi. */
export interface CatalogCompatibilityRef {
  readonly sku: string;
  readonly kind: FittingKind;
}

/** Baris yang lolos seluruh aturan. Baris bergalat tidak pernah muncul di sini. */
export interface ValidatedCatalogRow {
  readonly rowNumber: number;
  /**
   * Sidik jari baris **mentah**, kunci idempotensi job `catalog.ingest`
   * (`catalogVersionId + rowHash`, docs/INFRASTRUCTURE.md §6).
   *
   * Dihitung dari sel apa adanya dan bukan dari hasil validasi, supaya
   * memperbaiki logika validasi tidak membuat seluruh katalog terlihat berubah.
   * Nomor baris sengaja tidak ikut: menyusun ulang berkas bukan perubahan data.
   */
  readonly rowHash: string;

  readonly sku: string;
  readonly name: string;
  readonly family: string;
  readonly category: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly sourceDocument: string;
  readonly sourcePage: number;
  readonly imageUrl: string | null;

  /** Kanonik, terurut menaik, tanpa duplikat. */
  readonly sizes: readonly PipeSize[];
  /** Keenam kunci selalu ada; yang kosong bertanda `UNAVAILABLE`. */
  readonly specs: Readonly<Record<CatalogSpecKey, SpecValue>>;
  readonly compatibleSkus: readonly CatalogCompatibilityRef[];
}

export interface CatalogImportValidation {
  readonly rows: readonly ValidatedCatalogRow[];
  /**
   * Seluruh galat dari seluruh baris, dalam satu laporan.
   *
   * `rowNumber: 0` berarti galat berlaku untuk **seluruh berkas** — kolom wajib
   * yang hilang, label versi yang kosong — bukan untuk satu baris tertentu.
   */
  readonly issues: readonly CatalogImportIssue[];
}
