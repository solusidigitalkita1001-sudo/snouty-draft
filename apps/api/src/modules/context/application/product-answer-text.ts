/**
 * Kalimat jawaban pertanyaan produk, dirangkai **deterministik** dari `ProductAnswer` dan
 * data katalog — bukan oleh LLM. docs/PRODUCT_KNOWLEDGE.md §4 membolehkan LLM merangkai
 * kalimatnya dengan `ProductAnswer` sebagai satu-satunya bahan; templat ini adalah jalur
 * dasarnya (dan satu-satunya jalur selama kunci model belum ada). Setiap angka di sini
 * berasal dari katalog dan membawa sumbernya.
 */
import { specHasValue, type Product } from '@snouty/shared-types';
import type { ProductAnswer } from '../../product-knowledge/domain/product-answer.js';
import type { ProductAspect } from '../../product-knowledge/domain/product-aspect.js';

export const ASPECT_LABEL: Readonly<Record<ProductAspect, string>> = {
  sizes: 'Ukuran tersedia',
  size_availability: 'Ketersediaan ukuran',
  compatible_fittings: 'Fitting yang sepadan',
  material: 'Material',
  standard: 'Standar',
  pressure_class: 'Tekanan kerja',
  rod_length: 'Panjang batang',
  joint_type: 'Sambungan',
  application: 'Aplikasi',
};

export const PRODUCT_ANSWER_COPY = {
  notInCatalog: (query: string) =>
    `"${query}" tidak ada di katalog Pralon yang aktif. Tim teknis Pralon bisa membantu bila Anda membutuhkannya.`,
  noProductNamed:
    'Produk mana yang Anda maksud? Sebutkan nama atau keluarganya, misalnya "PVC AW".',
  comparisonIntro: 'Berikut yang tercatat di katalog Pralon untuk masing-masing:',
  source: (document: string, page: number) => `Sumber: ${document} hal. ${page}.`,
  seeDocuments: (titles: readonly string[]) => `Lihat dokumen teknis: ${titles.join('; ')}.`,
  insufficient: (label: string, name: string) =>
    `Data ${label.toLowerCase()} untuk ${name} belum cukup di katalog. Tim teknis Pralon bisa membantu.`,
} as const;

/** Ikhtisar satu produk — dipakai saat pertanyaan tidak menunjuk aspek tertentu. */
export function overviewText(product: Product): string {
  const parts = [`${product.name} (${product.category}): ${product.description}`];
  if (specHasValue(product.material)) parts.push(`Material ${product.material.value}.`);
  if (specHasValue(product.application)) parts.push(`Aplikasi: ${product.application.value}.`);
  if (specHasValue(product.standard)) parts.push(`Standar ${product.standard.value}.`);
  return parts.join(' ');
}

/** Kalimat untuk satu `ProductAnswer`, per jalur jawaban §4. */
export function answerText(product: Product, answer: ProductAnswer): string {
  const label = ASPECT_LABEL[answer.aspect];
  switch (answer.kind) {
    case 'value':
      return `${label} ${product.name}: ${answer.value}. ${PRODUCT_ANSWER_COPY.source(answer.sourceDocument, answer.sourcePage)}`;
    case 'list':
      return `${label} ${product.name}: ${answer.items.join(', ')}. ${PRODUCT_ANSWER_COPY.source(answer.sourceDocument, answer.sourcePage)}`;
    case 'availability':
      return answer.available
        ? `${product.name} tersedia dalam ukuran ${answer.sizeLabel}. ${PRODUCT_ANSWER_COPY.source(answer.sourceDocument, answer.sourcePage)}`
        : `${product.name} tidak tersedia dalam ukuran ${answer.sizeLabel} menurut katalog. ${PRODUCT_ANSWER_COPY.source(answer.sourceDocument, answer.sourcePage)}`;
    case 'unavailable':
      return `${label} ${product.name} belum tersedia di data katalog. ${PRODUCT_ANSWER_COPY.seeDocuments(answer.documents.map((d) => d.title))}`;
    case 'insufficientData':
      return PRODUCT_ANSWER_COPY.insufficient(label, product.name);
  }
}
