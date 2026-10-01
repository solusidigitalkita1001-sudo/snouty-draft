/**
 * Menjawab pertanyaan produk dari katalog. docs/PRODUCT_KNOWLEDGE.md §4.
 *
 * **Tidak ada satu pun panggilan LLM di berkas ini**, dan itu bukan kebetulan: LLM
 * hanya merangkai kalimatnya nanti, memakai `ProductAnswer` yang dikembalikan di
 * sini sebagai satu-satunya bahan. Fakta tidak pernah berasal darinya.
 *
 * Empat jalur, dan yang membedakannya penting:
 *
 * | Keadaan                                 | Jawaban            | Tampilan                      |
 * | --------------------------------------- | ------------------ | ----------------------------- |
 * | Kolom terisi                            | `value` / `list`   | nilai + tag provenance        |
 * | Ukuran ditanyakan, katalog menjawab     | `availability`     | ya / tidak                    |
 * | Kolom kosong, ada dokumen teknis        | `unavailable`      | "Lihat dokumen teknis"        |
 * | Kolom kosong, tidak ada dokumen         | `insufficientData` | "data belum cukup" + tim teknis |
 *
 * Baris ketiga adalah tempat kesalahan paling mahal menunggu: dokumennya
 * **ditawarkan**, tidak dibaca untuk mengisi nilainya. Menambal kolom kosong dengan
 * hasil pencarian adalah cara halus untuk berhalusinasi — jawabannya akan terdengar
 * percaya diri justru ketika datanya paling tidak ada.
 */

import { specHasValue, type Product, type SpecValue } from '@snouty/shared-types';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { PRODUCT_ASPECTS, requiresSize, type ProductAspect } from '../domain/product-aspect.js';
import type { DocumentReference, ProductAnswer } from '../domain/product-answer.js';
import { SizeQuestionWithoutSizeError } from '../domain/product-knowledge.errors.js';
import type { UnansweredQuestionRecorder } from '../domain/unanswered-question.port.js';
import type { PipeSize } from '@snouty/shared-types';

export interface ProductQuestion {
  readonly productId: string;
  readonly aspect: ProductAspect;
  /** Wajib untuk aspek `size_availability`, diabaikan untuk yang lain. */
  readonly size?: PipeSize;
}

export class ProductQuestionService {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly unanswered: UnansweredQuestionRecorder,
  ) {}

  async answer(question: ProductQuestion): Promise<ProductAnswer> {
    if (requiresSize(question.aspect) && question.size === undefined) {
      // Menebak ukuran yang dimaksud adalah menjawab pertanyaan yang tidak diajukan.
      throw new SizeQuestionWithoutSizeError(question.aspect);
    }

    const product = await this.catalog.findProduct(question.productId);

    switch (question.aspect) {
      case PRODUCT_ASPECTS.sizes:
        return this.answerSizes(product, question);
      case PRODUCT_ASPECTS.sizeAvailability:
        return this.answerSizeAvailability(product, question);
      case PRODUCT_ASPECTS.compatibleFittings:
        return this.answerCompatibleFittings(product, question);
      default:
        return this.answerSpec(product, question, product[specFieldOf(question.aspect)]);
    }
  }

  private async answerSizes(product: Product, question: ProductQuestion): Promise<ProductAnswer> {
    if (product.sizes.length === 0) return this.answerMissing(product, question);
    return {
      kind: 'list',
      productId: product.id,
      aspect: question.aspect,
      provenance: 'VERIFIED',
      items: product.sizes,
      sourceDocument: product.sourceDocument,
      sourcePage: product.sourcePage,
    };
  }

  /**
   * Perhatikan bahwa "tidak tersedia" dan "saya tidak tahu" adalah dua jawaban
   * berbeda, dan hanya yang pertama boleh dijawab dari sini.
   *
   * Produk yang **punya** daftar ukuran tetapi tanpa ukuran yang ditanyakan adalah
   * jawaban: katalog menyatakan ukurannya tidak ada. Produk yang daftar ukurannya
   * kosong sama sekali bukan jawaban — itu data yang belum masuk.
   */
  private async answerSizeAvailability(
    product: Product,
    question: ProductQuestion,
  ): Promise<ProductAnswer> {
    if (product.sizes.length === 0) return this.answerMissing(product, question);

    const asked = question.size;
    if (asked === undefined) throw new SizeQuestionWithoutSizeError(question.aspect);

    return {
      kind: 'availability',
      productId: product.id,
      aspect: question.aspect,
      provenance: 'VERIFIED',
      sizeLabel: asked.label,
      available: product.sizes.includes(asked.label),
      sourceDocument: product.sourceDocument,
      sourcePage: product.sourcePage,
    };
  }

  private async answerCompatibleFittings(
    product: Product,
    question: ProductQuestion,
  ): Promise<ProductAnswer> {
    const fittings = await this.catalog.findCompatibleFittings(product.id);
    if (fittings.length === 0) return this.answerMissing(product, question);

    return {
      kind: 'list',
      productId: product.id,
      aspect: question.aspect,
      provenance: 'VERIFIED',
      items: fittings.map((fitting) => fitting.name),
      sourceDocument: product.sourceDocument,
      sourcePage: product.sourcePage,
    };
  }

  private async answerSpec(
    product: Product,
    question: ProductQuestion,
    spec: SpecValue,
  ): Promise<ProductAnswer> {
    if (!specHasValue(spec)) return this.answerMissing(product, question);

    return {
      kind: 'value',
      productId: product.id,
      aspect: question.aspect,
      provenance: 'VERIFIED',
      value: spec.value,
      // Sitasi spesifikasi dipakai bila ada; kalau tidak, rujukan produknya sendiri.
      sourceDocument: spec.sourceDocument ?? product.sourceDocument,
      sourcePage: spec.sourcePage ?? product.sourcePage,
    };
  }

  /**
   * Jalur "tidak tahu", dan satu-satunya tempat dokumen teknis muncul.
   *
   * Dokumennya hanya **ditawarkan**. Tidak ada cabang di sini yang membaca isinya
   * untuk menyusun nilai — itu akan mengubah pengakuan jujur menjadi tebakan
   * berpenampilan rapi.
   */
  private async answerMissing(product: Product, question: ProductQuestion): Promise<ProductAnswer> {
    const documents = await this.catalog.findProductDocuments(product.id);

    this.unanswered.record({
      productId: product.id,
      aspect: question.aspect,
      hasDocuments: documents.length > 0,
      catalogVersionId: product.catalogVersionId,
    });

    const base = {
      productId: product.id,
      aspect: question.aspect,
      provenance: 'UNAVAILABLE',
      sourceDocument: product.sourceDocument,
      sourcePage: product.sourcePage,
    } as const;

    if (documents.length === 0) return { ...base, kind: 'insufficientData' };
    return { ...base, kind: 'unavailable', documents: documents.map(toDocumentReference) };
  }
}

/**
 * Nama aspek spesifikasi SAMA dengan `spec_key` di database, tetapi field pada
 * `Product` memakai camelCase. Pemetaan dinyatakan sebagai data supaya aspek baru
 * yang lupa dipetakan menjadi galat kompilasi, bukan `undefined` saat berjalan.
 */
const SPEC_FIELD: Readonly<Record<SpecAspect, keyof Product & SpecField>> = {
  material: 'material',
  standard: 'standard',
  pressure_class: 'pressureClass',
  rod_length: 'rodLength',
  joint_type: 'jointType',
  application: 'application',
};

type SpecField =
  'material' | 'standard' | 'pressureClass' | 'rodLength' | 'jointType' | 'application';

type SpecAspect = Exclude<
  ProductAspect,
  | typeof PRODUCT_ASPECTS.sizes
  | typeof PRODUCT_ASPECTS.sizeAvailability
  | typeof PRODUCT_ASPECTS.compatibleFittings
>;

function specFieldOf(aspect: SpecAspect): SpecField {
  return SPEC_FIELD[aspect];
}

function toDocumentReference(document: {
  title: string;
  url: string;
  page: number | null;
}): DocumentReference {
  return { title: document.title, url: document.url, page: document.page };
}
