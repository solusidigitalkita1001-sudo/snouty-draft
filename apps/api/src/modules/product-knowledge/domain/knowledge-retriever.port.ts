/**
 * Port retrieval pengetahuan. docs/PRODUCT_KNOWLEDGE.md §5.
 *
 * Antarmukanya didefinisikan **sekarang** dengan implementasi MySQL, sehingga
 * mengadopsi Qdrant nanti berarti menambah satu implementasi — bukan merombak
 * pemanggilnya. Qdrant sendiri belum diadopsi, dan kriterianya ada di §5.
 *
 * Satu batasan dibawa di tingkat kontrak, bukan diserahkan ke kesopanan pemanggil:
 * **hasil retrieval tidak pernah menjadi nilai spesifikasi.** Ia hanya pernah
 * menjadi tawaran "buka dokumen teknis". Kolom kosong yang ditambal hasil pencarian
 * menghasilkan jawaban percaya diri yang salah, dan itu lebih berbahaya daripada
 * mengaku tidak tahu (SPEC §5 Policy 2).
 *
 * Karena itu tipe kembaliannya adalah **rujukan**, bukan teks yang bisa langsung
 * dipakai sebagai jawaban.
 */

import type { ProductAspect } from './product-aspect.js';

export const KNOWLEDGE_RETRIEVER = Symbol('KNOWLEDGE_RETRIEVER');

export interface RetrievalFilter {
  /** Retrieval selalu dibatasi satu produk; pencarian lintas produk bukan kebutuhan di sini. */
  readonly productId: string;
  readonly aspect: ProductAspect;
  readonly limit?: number;
}

/**
 * Satu potongan yang ditemukan.
 *
 * `sourceDocument` dan `sourcePage` wajib ada — potongan tanpa sitasi tidak boleh
 * ditampilkan sama sekali (docs/PRODUCT_KNOWLEDGE.md §8). `score` dipakai ambang
 * batas: di bawahnya, jawaban yang benar adalah "data belum cukup", bukan potongan
 * paling mirip dari korpus yang tidak relevan.
 */
export interface RetrievedChunk {
  readonly title: string;
  readonly url: string;
  readonly sourceDocument: string;
  readonly sourcePage: number | null;
  /** 0..1. Implementasi MySQL memakai tumpang-tindih istilah, bukan kemiripan vektor. */
  readonly score: number;
}

export interface KnowledgeRetriever {
  retrieve(query: string, filter: RetrievalFilter): Promise<readonly RetrievedChunk[]>;
}

/**
 * Ambang skor minimum.
 *
 * Nilainya rendah karena implementasi MySQL hanya mencocokkan judul dokumen — satu
 * istilah yang cocok sudah merupakan sinyal pada korpus sekecil ini. Ia akan naik
 * bersama retrieval yang sungguhan; yang penting ambangnya **ada**, sehingga
 * "kembalikan apa pun yang paling mirip" tidak pernah menjadi perilaku bakunya.
 */
export const MINIMUM_RETRIEVAL_SCORE = 0.2;
