/**
 * Satu-satunya tempat nilai spesifikasi produk dibuat. Invarian **C-1** hidup di sini.
 *
 * Sebelum berkas ini, provenance disusun di tiga tempat terpisah — validator impor,
 * mapper pembacaan, dan constraint database — masing-masing dengan salinan aturan
 * yang sama. Tiga salinan dari satu aturan bukan tiga lapis pertahanan, melainkan
 * tiga kesempatan untuk menyimpang; dan menyimpangnya akan terlihat sebagai
 * spesifikasi yang terbaca `VERIFIED` di satu jalur dan `UNAVAILABLE` di jalur lain.
 *
 * Yang dipegang berkas ini, dan tidak bisa ditembus pemanggil:
 *
 *   - Kolom katalog kosong — termasuk yang hanya berisi spasi — menjadi
 *     `UNAVAILABLE`, bukan string kosong yang mengaku terverifikasi.
 *   - Nilai dari dokumen teknis **wajib** membawa dokumen dan nomor halaman.
 *     Tanpa sitasi lengkap ia diturunkan menjadi `UNAVAILABLE`, bukan ditampilkan
 *     tanpa sumber: "jawaban berbasis dokumen tanpa sitasi" ada di daftar hal yang
 *     tidak boleh terjadi (docs/PRODUCT_KNOWLEDGE.md §8).
 *   - Tidak ada satu pun fungsi di sini yang bisa menghasilkan `ASSUMED` atau
 *     `ESTIMATED`. Itu juga dijamin tipe `SpecValue`, tetapi disebut di sini karena
 *     ini tempat orang akan mencari jalannya.
 *
 * Arahnya selalu konservatif: ragu → `UNAVAILABLE`. Kolom kosong akan ditanyakan
 * ke tim teknis; kolom yang salah terisi akan dipakai menghitung.
 */

import type { SpecValue } from '@snouty/shared-types';

/**
 * Satu instance beku untuk setiap spesifikasi yang tidak tersedia.
 *
 * Dibekukan bukan demi penghematan: ia dibagi ke ratusan produk sekaligus, dan
 * satu pemanggil yang menulisi `.value` akan mengubah arti seluruh katalog.
 */
const UNAVAILABLE: SpecValue = Object.freeze({ provenance: 'UNAVAILABLE', value: null });

export function unavailableSpec(): SpecValue {
  return UNAVAILABLE;
}

/**
 * Nilai yang datang dari kolom katalog.
 *
 * Tidak membawa sitasi, dan itu benar: sitasi dokumen dipakai untuk nilai yang
 * memang datang dari dokumen. Menempelkan nama katalog ke setiap kolom akan
 * membuat sitasi berhenti berarti apa pun.
 */
export function specFromCatalogColumn(raw: string | null | undefined): SpecValue {
  const value = raw?.trim() ?? '';
  return value === '' ? UNAVAILABLE : { provenance: 'VERIFIED', value };
}

/**
 * Nilai yang datang dari dokumen teknis, beserta sitasinya.
 *
 * Sitasi yang tidak lengkap menurunkan nilainya menjadi `UNAVAILABLE` alih-alih
 * menolak dengan galat. Alasannya praktis: jalur retrieval menghasilkan ratusan
 * potongan, dan satu potongan tanpa halaman tidak boleh menjatuhkan seluruh
 * jawaban — ia hanya tidak boleh ikut ditampilkan sebagai fakta.
 */
export function specFromTechnicalDocument(
  raw: string | null | undefined,
  sourceDocument: string | null | undefined,
  sourcePage: number | null | undefined,
): SpecValue {
  const value = raw?.trim() ?? '';
  const document = sourceDocument?.trim() ?? '';

  if (value === '' || document === '') return UNAVAILABLE;
  if (!Number.isInteger(sourcePage) || sourcePage === null || sourcePage === undefined) {
    return UNAVAILABLE;
  }
  if (sourcePage <= 0) return UNAVAILABLE;

  return { provenance: 'VERIFIED', value, sourceDocument: document, sourcePage };
}

/** Satu baris `product_specs` apa adanya dari database. */
export interface StoredSpecRow {
  readonly specValue: string | null;
  readonly provenance: string;
  readonly sourceDocument: string | null;
  readonly sourcePage: number | null;
}

/**
 * Pemetaan baris tersimpan → nilai domain.
 *
 * Baris yang **tidak ada** dan baris yang ada tetapi bertanda `UNAVAILABLE`
 * menghasilkan hal yang sama, dan itu disengaja: UI hanya perlu tahu "tidak ada
 * datanya". Yang tidak boleh sama adalah baris yang hilang karena field-nya tidak
 * berlaku — itu urusan pemanggil, yang memang hanya menanyakan keenam field yang
 * dikenal katalog.
 *
 * `provenance` apa pun selain `VERIFIED` diturunkan menjadi `UNAVAILABLE`, bukan
 * dilempar sebagai galat. CHECK di database sudah membatasi nilainya; kalau suatu
 * hari ada baris yang lolos, tidak merendernya jauh lebih baik daripada merender
 * fakta produk yang asal-usulnya tidak dikenali.
 */
export function specFromStoredRow(row: StoredSpecRow | undefined): SpecValue {
  if (row === undefined || row.provenance !== 'VERIFIED') return UNAVAILABLE;

  // Kehadiran salah satu kolom sitasi berarti nilainya mengaku berasal dari
  // dokumen; maka sitasinya harus lengkap, atau nilainya tidak ditampilkan.
  const claimsDocument = row.sourceDocument !== null || row.sourcePage !== null;
  return claimsDocument
    ? specFromTechnicalDocument(row.specValue, row.sourceDocument, row.sourcePage)
    : specFromCatalogColumn(row.specValue);
}
