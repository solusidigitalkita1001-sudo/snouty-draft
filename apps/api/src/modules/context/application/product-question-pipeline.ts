/**
 * Ruas PRODUCT_LOOKUP — pertanyaan produk dijawab dari katalog, bukan dari ingatan model.
 * docs/PRODUCT_KNOWLEDGE.md §4 · docs/AI_BEHAVIOR.md ("PRODUCT_LOOKUP adalah SELECT").
 *
 * Satu-satunya hal yang diminta dari model: ke produk mana dan ke aspek mana pertanyaan
 * itu menunjuk. Produknya dicari di katalog aktif, jawabannya dirakit `product-knowledge`
 * dengan provenance, kalimatnya templat deterministik. Produk yang tidak ada di katalog
 * dikatakan tidak ada — tidak ada jawaban dari pengetahuan umum tentang "HDPE".
 */
import {
  PipeSize,
  specHasValue,
  type AssistantStreamEvent,
  type Product,
  type ProductCardDto,
} from '@snouty/shared-types';
import type { AiService } from '../../ai/domain/ai.port.js';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import type { ProductQuestionService } from '../../product-knowledge/application/product-question.service.js';
import { endEvent } from './message-pipeline.js';
import { answerText, overviewText, PRODUCT_ANSWER_COPY } from './product-answer-text.js';

/** Maksimal produk yang dijawab sekaligus — "bedanya A dan B" adalah dua. */
const MAX_PRODUCTS = 2;

export interface ProductQuestionInput {
  readonly messageId: string;
  readonly message: string;
}

export async function runProductQuestion(
  ai: AiService,
  catalog: Pick<CatalogQueryService, 'listProducts'>,
  questions: Pick<ProductQuestionService, 'answer'>,
  input: ProductQuestionInput,
): Promise<readonly AssistantStreamEvent[]> {
  const events: AssistantStreamEvent[] = [{ type: 'message.start', messageId: input.messageId }];
  // Fakta dirangkai kode dan dikirim APA ADANYA. Pernah dicoba menyerahkannya ke model
  // untuk "dirangkai ulang" (ReplyWriter): qwen2.5:7b membuang fakta katalognya dan
  // menawarkan "membahas perbedaan HDPE dan PVC yang umumnya kita gunakan" — tepat
  // pengetahuan umum yang tidak boleh masuk. Kalimat yang kaku lebih baik daripada
  // kalimat luwes yang menghilangkan sumbernya.
  const facts: string[] = [];
  const finish = (): readonly AssistantStreamEvent[] => {
    events.splice(1, 0, { type: 'token', text: facts.join('\n\n') });
    events.push(endEvent(input.messageId));
    return events;
  };

  let parsed;
  try {
    parsed = await ai.parseProductQuestion(input.message);
  } catch (error) {
    if (!(error instanceof AiOutputInvalidError)) throw error;
    parsed = null;
  }

  if (!parsed?.productQuery) {
    facts.push(PRODUCT_ANSWER_COPY.noProductNamed);
    return finish();
  }

  const { products, missing } = await findProducts(catalog, parsed.productQuery);
  if (products.length === 0) {
    facts.push(PRODUCT_ANSWER_COPY.notInCatalog(parsed.productQuery));
    events.push({ type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } });
    return finish();
  }
  // "PVC dan HDPE" dengan HDPE tidak ada: katakan yang tidak ada, jangan diam-diam
  // menjawab separuh seolah itu seluruh pertanyaannya.
  if (missing.length > 0) facts.push(PRODUCT_ANSWER_COPY.notInCatalog(missing.join(', ')));

  if (parsed.aspect === null) {
    if (products.length > 1) facts.push(PRODUCT_ANSWER_COPY.comparisonIntro);
    facts.push(products.map(overviewText).join('\n\n'));
  } else {
    let needsTechnical = false;
    for (const product of products) {
      const size = parsed.size ? (PipeSize.parse(parsed.size) ?? undefined) : undefined;
      const answer = await questions.answer({
        productId: product.id,
        aspect: parsed.aspect,
        ...(size !== undefined ? { size } : {}),
      });
      facts.push(answerText(product, answer));
      if (answer.kind === 'insufficientData') needsTechnical = true;
    }
    if (needsTechnical) {
      events.push({ type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } });
    }
  }

  events.push({ type: 'card', card: { kind: 'product', products: products.map(toCard) } });
  return finish();
}

/**
 * "PVC AW dan HDPE" → dua pencarian; tiap pencarian memberi satu produk teratas supaya
 * perbandingan tetap satu lawan satu, bukan daftar seluruh keluarga.
 */
async function findProducts(
  catalog: Pick<CatalogQueryService, 'listProducts'>,
  query: string,
): Promise<{ readonly products: readonly Product[]; readonly missing: readonly string[] }> {
  const terms = query
    .split(/\s+(?:dan|vs|versus|atau)\s+|,/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, MAX_PRODUCTS);
  const products: Product[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    const page = await catalog.listProducts({ q: term, limit: 1 });
    const product = page.items[0];
    if (!product) missing.push(term);
    else if (!products.some((f) => f.id === product.id)) products.push(product);
  }
  return { products, missing };
}

/**
 * Kartu produk hasil lookup. `state` di DTO lahir untuk produk yang DIPILIH solusi;
 * untuk lookup ia diturunkan dari provenance spesifikasi inti saja, dan UI tidak
 * menampilkannya sebagai "dipakai di solusi".
 */
function toCard(product: Product): ProductCardDto {
  const verified =
    specHasValue(product.material) &&
    specHasValue(product.standard) &&
    specHasValue(product.application);
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    sizeLabel: null,
    state: verified ? 'VERIFIED_SELECTED' : 'INFORMATION_UNAVAILABLE',
    provenance: verified ? 'VERIFIED' : 'UNAVAILABLE',
    sourceDocument: product.sourceDocument,
    sourcePage: product.sourcePage,
    imageUrl: product.imageUrl,
  };
}
