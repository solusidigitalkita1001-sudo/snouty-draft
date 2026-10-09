/**
 * Kalimat jawaban pertanyaan produk, dirangkai **deterministik** dari `ProductAnswer` dan
 * data katalog — bukan oleh LLM. docs/PRODUCT_KNOWLEDGE.md §4 membolehkan LLM merangkai
 * kalimatnya dengan `ProductAnswer` sebagai satu-satunya bahan; templat ini adalah jalur
 * dasarnya (dan satu-satunya jalur selama kunci model belum ada). Setiap angka di sini
 * berasal dari katalog dan membawa sumbernya.
 */
import { DEFAULT_LOCALE, specHasValue, type Locale, type Product } from '@snouty/shared-types';
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
  /** Hanya atas katalog `pralon` (otoritatif) — klaim negatif tentang Pralon. */
  notInCatalog: (query: string) =>
    `"${query}" tidak ada di katalog Pralon yang aktif. Tim teknis Pralon bisa membantu bila Anda membutuhkannya.`,
  /** Katalog aktif bukan impor Pralon (contoh pengembangan): tidak ada klaim tentang Pralon. */
  notInInstalledCatalog: (query: string) =>
    `"${query}" belum ada di data katalog yang terpasang di sistem ini. Tim teknis Pralon bisa membantu bila Anda membutuhkannya.`,
  catalogUnavailable:
    'Katalog Pralon sedang tidak terjangkau, jadi saya belum bisa memeriksa produknya. Coba lagi sebentar, atau hubungi tim teknis Pralon.',
  /** Harga nonaktif (OQ-03): harga mengikuti daftar distributor; tim Pralon yang memberi penawaran. */
  priceNotShown:
    'Harga tidak saya tampilkan di sini — harga final mengikuti daftar harga distributor Pralon yang berlaku dan bisa berbeda per wilayah. Tim Pralon bisa mengirimkan penawarannya untuk produk yang Anda butuhkan.',
  catalogSupport: 'Contoh produknya di katalog Pralon:',
  familyNext: 'Mau saya rinci ukuran untuk salah satu jenisnya?',
  typeNext: 'Sebutkan jenisnya kalau mau saya tampilkan semua ukurannya.',
  sizeNext: 'Mau dicek ketersediaan ukuran tertentu, atau dibandingkan dengan jenis lain?',
  rangeNext:
    'Mau saya jelaskan salah satunya, atau ceritakan bangunannya supaya saya bisa memilihkan?',
  /** Pengguna menyebut Pralon ("HDPE di Pralon ok nggak?") tetapi katalognya belum terpasang. */
  catalogNotInstalledShort:
    'Soal produk Pralon-nya sendiri, katalog Pralon belum terpasang di sistem ini, jadi saya belum bisa memastikan tipe dan ukurannya — tim teknis Pralon bisa membantu.',
  catalogNotInstalled:
    'Katalog produk Pralon belum terpasang di sistem ini, jadi saya belum bisa menyebut produk Pralon yang spesifik. Secara umum, keluarga pipa air bersih yang lazim:',
  askTechnicalForProducts:
    'Untuk pilihan produk Pralon yang sesuai kebutuhan Anda, tim teknis Pralon bisa membantu.',
  comparisonIntro: 'Berikut yang tercatat di katalog Pralon untuk masing-masing:',
  source: (document: string, page: number) => `Sumber: ${document} hal. ${page}.`,
  seeDocuments: (titles: readonly string[]) => `Lihat dokumen teknis: ${titles.join('; ')}.`,
  insufficient: (label: string, name: string) =>
    `${label} untuk ${name} belum tercantum di katalog; tim teknis Pralon bisa memastikannya.`,
} as const;

export const ASPECT_LABEL_EN: Readonly<Record<ProductAspect, string>> = {
  sizes: 'Available sizes',
  size_availability: 'Size availability',
  compatible_fittings: 'Matching fittings',
  material: 'Material',
  standard: 'Standard',
  pressure_class: 'Working pressure',
  rod_length: 'Length per piece',
  joint_type: 'Joint type',
  application: 'Application',
};

export function aspectLabel(aspect: ProductAspect, locale: Locale = DEFAULT_LOCALE): string {
  return (locale === 'en' ? ASPECT_LABEL_EN : ASPECT_LABEL)[aspect];
}

/** Bentuk bersama kedua bahasa — salinan Inggris yang kehilangan kunci gagal typecheck. */
export interface ProductAnswerCopy {
  readonly notInCatalog: (query: string) => string;
  readonly notInInstalledCatalog: (query: string) => string;
  readonly catalogUnavailable: string;
  readonly priceNotShown: string;
  readonly catalogSupport: string;
  readonly familyNext: string;
  readonly typeNext: string;
  readonly sizeNext: string;
  readonly rangeNext: string;
  readonly catalogNotInstalledShort: string;
  readonly catalogNotInstalled: string;
  readonly askTechnicalForProducts: string;
  readonly comparisonIntro: string;
  readonly source: (document: string, page: number) => string;
  readonly seeDocuments: (titles: readonly string[]) => string;
  readonly insufficient: (label: string, name: string) => string;
}

export const PRODUCT_ANSWER_COPY_EN: ProductAnswerCopy = {
  notInCatalog: (query) =>
    `"${query}" is not in the active Pralon catalog. Pralon's technical team can help if you need it.`,
  notInInstalledCatalog: (query) =>
    `"${query}" is not yet in the catalog data installed in this system. Pralon's technical team can help if you need it.`,
  catalogUnavailable:
    "The Pralon catalog is unreachable right now, so I can't check the product yet. Try again in a moment, or contact Pralon's technical team.",
  priceNotShown:
    'Prices are not shown here — final prices follow the current Pralon distributor price list and can differ by region. The Pralon team can send a quotation for the products you need.',
  catalogSupport: 'Examples in the Pralon catalogue:',
  familyNext: 'Shall I list the sizes for one of these types?',
  typeNext: 'Name a type and I will list all of its sizes.',
  sizeNext: 'Want me to check a specific size, or compare it with another type?',
  rangeNext:
    'Would you like me to explain one of them, or tell me about the building so I can pick for you?',
  catalogNotInstalledShort:
    "As for the Pralon product itself, the Pralon catalog is not installed in this system, so I can't confirm the type and size yet — Pralon's technical team can help.",
  catalogNotInstalled:
    "The Pralon product catalog is not installed in this system, so I can't name a specific Pralon product yet. In general, the common clean water pipe families are:",
  askTechnicalForProducts:
    "For the Pralon product that fits your needs, Pralon's technical team can help.",
  comparisonIntro: 'Here is what the Pralon catalog records for each:',
  source: (document, page) => `Source: ${document} p. ${page}.`,
  seeDocuments: (titles) => `See the technical documents: ${titles.join('; ')}.`,
  insufficient: (label, name) =>
    `${label} for ${name} is not listed in the catalogue yet; Pralon's technical team can confirm it.`,
};

export function productAnswerCopy(locale: Locale = DEFAULT_LOCALE): ProductAnswerCopy {
  return locale === 'en' ? PRODUCT_ANSWER_COPY_EN : PRODUCT_ANSWER_COPY;
}

/** Ikhtisar satu produk — dipakai saat pertanyaan tidak menunjuk aspek tertentu. */
export function overviewText(product: Product, locale: Locale = DEFAULT_LOCALE): string {
  const en = locale === 'en';
  // Deskripsi kosong tidak boleh menyisakan "Nama (KATEGORI): " yang menggantung.
  const description = product.description.trim();
  const parts = [description === '' ? `${product.name}.` : `${product.name}: ${description}`];
  if (specHasValue(product.material))
    parts.push(en ? `Material: ${product.material.value}.` : `Material ${product.material.value}.`);
  if (specHasValue(product.application))
    parts.push(`${en ? 'Application' : 'Aplikasi'}: ${product.application.value}.`);
  if (specHasValue(product.standard))
    parts.push(en ? `Standard: ${product.standard.value}.` : `Standar ${product.standard.value}.`);
  return parts.join(' ');
}

/** Kalimat untuk satu `ProductAnswer`, per jalur jawaban §4. */
export function answerText(
  product: Product,
  answer: ProductAnswer,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const en = locale === 'en';
  const copy = productAnswerCopy(locale);
  const label = aspectLabel(answer.aspect, locale);
  switch (answer.kind) {
    case 'value':
      return `${label} ${product.name}: ${answer.value}. ${copy.source(answer.sourceDocument, answer.sourcePage)}`;
    case 'list':
      return `${label} ${product.name}: ${answer.items.join(', ')}. ${copy.source(answer.sourceDocument, answer.sourcePage)}`;
    case 'availability': {
      const source = copy.source(answer.sourceDocument, answer.sourcePage);
      if (en) {
        return answer.available
          ? `${product.name} is available in size ${answer.sizeLabel}. ${source}`
          : `${product.name} is not available in size ${answer.sizeLabel} according to the catalog. ${source}`;
      }
      return answer.available
        ? `${product.name} tersedia dalam ukuran ${answer.sizeLabel}. ${source}`
        : `${product.name} tidak tersedia dalam ukuran ${answer.sizeLabel} menurut katalog. ${source}`;
    }
    case 'unavailable':
      return en
        ? `${label} for ${product.name} is not yet available in the catalog data. ${copy.seeDocuments(answer.documents.map((d) => d.title))}`
        : `${label} ${product.name} belum tersedia di data katalog. ${copy.seeDocuments(answer.documents.map((d) => d.title))}`;
    case 'insufficientData':
      return copy.insufficient(label, product.name);
  }
}
