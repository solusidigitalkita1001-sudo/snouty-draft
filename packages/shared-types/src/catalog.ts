/**
 * Tipe domain katalog produk. docs/DOMAIN_MODEL.md §5 · docs/PRODUCT_KNOWLEDGE.md §2.
 *
 * Satu keputusan membentuk seluruh berkas ini: **field spesifikasi yang kosong
 * bukan `null` yang dihilangkan dari respons, melainkan nilai eksplisit
 * bertanda `UNAVAILABLE`.** UI perlu membedakan "Pralon belum memberi datanya"
 * dari "field ini tidak berlaku" — yang pertama dirender sebagai
 * "Lihat dokumen teknis", yang kedua tidak dirender sama sekali.
 */

export type CatalogVersionStatus = 'draft' | 'active' | 'archived';
/**
 * Asal data sebuah versi katalog.
 *
 *   - `pralon`: hasil impor dokumen Pralon — satu-satunya yang boleh mendasari pernyataan
 *     "Pralon punya / tidak punya produk X".
 *   - `sample`: katalog contoh pengembangan (`seed:sample`, SKU `DEV-*`). Boleh menghidupkan
 *     layar di development; **tidak pernah** menjadi versi aktif di produksi, dan tidak pernah
 *     dipakai sebagai dasar klaim ketersediaan produk Pralon.
 */
export type CatalogVersionKind = 'pralon' | 'sample';
export type ProductStatus = 'active' | 'discontinued';
export type PressureClass = 'AW' | 'D';
export type FittingKind = 'tee' | 'elbow' | 'reducer' | 'socket';

export interface CatalogVersion {
  readonly id: string;
  /** Tampil di UI sebagai "KATALOG PRALON · v2.4". */
  readonly label: string;
  /** mis. "Katalog produk Pralon 2026" — wajib, karena UI menjanjikan data ini bisa dicek. */
  readonly sourceDocument: string;
  readonly kind: CatalogVersionKind;
  readonly status: CatalogVersionStatus;
  readonly effectiveFrom: string;
  readonly importedBy: string;
}

/**
 * Spesifikasi yang punya nilai, beserta asal-usulnya.
 *
 * `sourceDocument` dan `sourcePage` diisi **hanya** saat nilainya berasal dari
 * dokumen teknis, bukan dari kolom katalog. Keduanya datang sepasang: UI merender
 * "Sumber: <dokumen> hal. N", jadi sitasi setengah tidak bisa dirender sama sekali.
 */
export interface VerifiedSpecValue {
  readonly provenance: 'VERIFIED';
  readonly value: string;
  readonly sourceDocument?: string;
  readonly sourcePage?: number;
}

/** Spesifikasi yang belum ada datanya. Dirender "Lihat dokumen teknis", tanpa nilai. */
export interface UnavailableSpecValue {
  readonly provenance: 'UNAVAILABLE';
  readonly value: null;
}

/**
 * Nilai spesifikasi beserta asal-usulnya — **union terdiskriminasi, bukan satu
 * interface dengan dua field bebas.**
 *
 * Bentuk ini yang membuat dua invarian menjadi galat kompilasi alih-alih sesuatu
 * yang harus diingat:
 *
 *   - **C-1**: tidak ada jalur yang menghasilkan fakta produk bertanda `ASSUMED`
 *     atau `ESTIMATED`. Asumsi berlaku untuk kebutuhan pengguna (tinggi lantai,
 *     sumber air), bukan untuk spesifikasi pipa. Pralon tahu tekanan kerja
 *     produknya; kalau datanya belum ada, itu kekurangan data — bukan sesuatu
 *     yang boleh diperkirakan.
 *   - **P-2**: `UNAVAILABLE` tidak pernah membawa nilai. Sebelumnya
 *     `{ value: 'mungkin 10 bar', provenance: 'UNAVAILABLE' }` adalah objek yang
 *     sah menurut tipe dan hanya dicegah oleh kode yang kebetulan membuangnya.
 *     Sekarang ia tidak bisa ditulis.
 *
 * Konstruktornya ada di `product-catalog/domain/spec-value.ts`; di sana setiap
 * jalur yang menghasilkan nilai spesifikasi berkumpul dan bisa diuji sekali.
 */
export type SpecValue = VerifiedSpecValue | UnavailableSpecValue;

/**
 * Satu-satunya cara yang benar untuk bertanya "boleh dirender nilainya?".
 *
 * Membandingkan `spec.value !== null` juga bekerja, tetapi penjaga ini yang
 * menyempitkan tipenya sehingga `sourceDocument` dan `sourcePage` bisa dibaca —
 * dan itu memaksa pemanggil memeriksa provenance lebih dulu, bukan sesudahnya.
 */
export function specHasValue(spec: SpecValue): spec is VerifiedSpecValue {
  return spec.provenance === 'VERIFIED';
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

/**
 * Dokumen teknis yang bisa dibuka dari drawer produk ("Buka dokumen teknis").
 *
 * Dipakai untuk **menawarkan** dokumen, bukan untuk mengisi nilai spesifikasi yang
 * kosong. Membaca dokumen untuk menambal kolom kosong adalah cara halus untuk
 * berhalusinasi (docs/PRODUCT_KNOWLEDGE.md §4).
 */
export interface ProductDocument {
  readonly title: string;
  readonly url: string;
  readonly page: number | null;
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
  /**
   * `null` bila impor ditolak: versi draft hanya dibuat ketika jumlah galatnya
   * nol, sehingga tidak ada versi setengah terisi yang bisa dipromosikan
   * (usulan default OQ-38).
   */
  readonly catalogVersionId: string | null;
  readonly rowsAccepted: number;
  readonly rowsRejected: number;
  readonly issues: readonly CatalogImportIssue[];
}
