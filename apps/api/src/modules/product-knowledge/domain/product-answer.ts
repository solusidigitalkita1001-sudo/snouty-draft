/**
 * Jawaban pertanyaan produk. docs/PRODUCT_KNOWLEDGE.md §4 dan §6.
 *
 * Union terdiskriminasi, dan **setiap varian membawa provenance** — termasuk yang
 * menyatakan tidak tahu. Itu syarat SPEC §5 Policy 4: tidak ada nilai yang tampil
 * tanpa asal-usulnya. Kalau salah satu varian boleh tanpa provenance, varian itulah
 * yang akan dipakai saat seseorang sedang buru-buru.
 *
 * Perhatikan bahwa tidak ada varian yang membawa angka **dan** menyatakan
 * ketidaktahuan sekaligus. Dua keadaan yang sering dicampur dibedakan tegas di sini:
 *
 *   - `unavailable` — kolomnya kosong, tetapi ada dokumen teknis yang bisa dibuka.
 *     Dirender "Lihat dokumen teknis". Dokumennya **tidak** dibaca untuk mengisi
 *     nilainya: menambal kolom kosong dengan hasil pencarian adalah cara halus
 *     untuk berhalusinasi.
 *   - `insufficientData` — kolomnya kosong dan tidak ada dokumen apa pun. Jawaban
 *     yang benar adalah mengakuinya dan menawarkan tim teknis.
 */

import type { Provenance } from '@snouty/shared-types';
import type { ProductAspect } from './product-aspect.js';

/** Rujukan dokumen yang bisa dibuka pengguna ("Buka dokumen teknis"). */
export interface DocumentReference {
  readonly title: string;
  readonly url: string;
  readonly page: number | null;
}

interface AnswerBase {
  readonly productId: string;
  readonly aspect: ProductAspect;
  readonly provenance: Provenance;
  /** "Katalog produk Pralon 2026 · hal. 14" — janji bahwa jawaban ini bisa dicek. */
  readonly sourceDocument: string;
  readonly sourcePage: number;
}

/** Satu nilai dari kolom katalog, mis. `standard` = "SNI 06-0084-2002". */
export interface ValueAnswer extends AnswerBase {
  readonly kind: 'value';
  readonly provenance: 'VERIFIED';
  readonly value: string;
}

/** Daftar nilai, mis. ukuran tersedia atau fitting sepadan. */
export interface ListAnswer extends AnswerBase {
  readonly kind: 'list';
  readonly provenance: 'VERIFIED';
  readonly items: readonly string[];
}

/**
 * "Ada ukuran 3/4 inch?" — ya atau tidak, dari data.
 *
 * `false` di sini berarti **katalog menyatakan ukuran itu tidak tersedia**, bukan
 * "saya tidak tahu". Keduanya tidak boleh terlihat sama: yang pertama jawaban,
 * yang kedua pengakuan.
 */
export interface AvailabilityAnswer extends AnswerBase {
  readonly kind: 'availability';
  readonly provenance: 'VERIFIED';
  readonly sizeLabel: string;
  readonly available: boolean;
}

/** Kolom kosong, tetapi ada dokumen teknis. Nilainya **tidak** diambil dari dokumen. */
export interface UnavailableAnswer extends AnswerBase {
  readonly kind: 'unavailable';
  readonly provenance: 'UNAVAILABLE';
  readonly documents: readonly DocumentReference[];
}

/** Tidak ada di kolom, tidak ada dokumen. Tawarkan tim teknis. */
export interface InsufficientDataAnswer extends AnswerBase {
  readonly kind: 'insufficientData';
  readonly provenance: 'UNAVAILABLE';
}

export type ProductAnswer =
  ValueAnswer | ListAnswer | AvailabilityAnswer | UnavailableAnswer | InsufficientDataAnswer;

/** Apakah jawaban ini memuat fakta yang boleh dirender sebagai nilai. */
export function answerHasFact(answer: ProductAnswer): boolean {
  return answer.kind === 'value' || answer.kind === 'list' || answer.kind === 'availability';
}
