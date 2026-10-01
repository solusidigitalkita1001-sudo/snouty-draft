/**
 * Galat domain `product-knowledge`, masing-masing membawa kode API-nya sendiri
 * (docs/API_CONTRACTS.md §4).
 */

import type { ProductAspect } from './product-aspect.js';

/**
 * Pertanyaan ketersediaan ukuran datang tanpa ukurannya.
 *
 * Tidak dibulatkan ke ukuran terdekat dan tidak dijawab untuk "ukuran apa saja":
 * menebak ukuran yang dimaksud berarti menjawab pertanyaan yang tidak diajukan, dan
 * jawabannya akan terlihat sama meyakinkannya dengan jawaban yang benar.
 */
export class SizeQuestionWithoutSizeError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(readonly aspect: ProductAspect) {
    super('Ukuran yang ditanyakan belum disebutkan.');
    this.name = 'SizeQuestionWithoutSizeError';
    this.details = { aspect };
  }
}
