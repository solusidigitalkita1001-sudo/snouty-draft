/**
 * Pencatat pertanyaan yang tidak terjawab katalog.
 *
 * Ada untuk satu alasan yang sangat spesifik: kriteria adopsi RAG #2
 * (docs/PRODUCT_KNOWLEDGE.md §5) berbunyi "**terukur** ≥ 10% pertanyaan produk nyata
 * tidak terjawab oleh query MySQL". Tanpa pencatat, angka itu akan diperkirakan dari
 * perasaan — dan perasaan cenderung membenarkan teknologi yang sedang ingin dipakai.
 *
 * Yang dicatat sengaja sesempit mungkin: produk, aspek, dan apakah ada dokumen.
 * **Isi pertanyaan pengguna tidak pernah dicatat** (docs/PRIVACY.md §5, docs/SECURITY.md §11).
 * Untuk memutuskan ambang 10%, aspek sudah cukup; kalimat pengguna tidak menambah
 * apa pun selain risiko.
 *
 * Pencatat ini juga menjawab pertanyaan yang lebih berguna daripada rasionya:
 * **aspek mana** yang paling sering kosong. Kalau jawabannya `pressure_class`,
 * solusinya mengisi kolom — bukan meng-embed PDF.
 */

import type { ProductAspect } from './product-aspect.js';

export const UNANSWERED_QUESTION_RECORDER = Symbol('UNANSWERED_QUESTION_RECORDER');

export interface UnansweredQuestion {
  readonly productId: string;
  readonly aspect: ProductAspect;
  /** `true` bila ada dokumen teknis untuk dibuka — bedanya "lihat dokumen" dan "data belum cukup". */
  readonly hasDocuments: boolean;
  readonly catalogVersionId: string;
}

export interface UnansweredQuestionRecorder {
  record(question: UnansweredQuestion): void;
}
