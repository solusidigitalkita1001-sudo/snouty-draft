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
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';
import { answerText, overviewText, PRODUCT_ANSWER_COPY } from './product-answer-text.js';

/** Maksimal produk yang dijawab sekaligus — "bedanya A dan B" adalah dua. */
const MAX_PRODUCTS = 2;

export interface ProductQuestionInput {
  readonly messageId: string;
  readonly message: string;
  readonly recentTurns?: readonly ReplyTurn[];
}

export async function runProductQuestion(
  ai: AiService,
  catalog: Pick<CatalogQueryService, 'listProducts'>,
  questions: Pick<ProductQuestionService, 'answer'>,
  input: ProductQuestionInput,
  reply: ReplyWriter | null = null,
  faqPrompt: string | null = null,
): Promise<readonly AssistantStreamEvent[]> {
  const events: AssistantStreamEvent[] = [{ type: 'message.start', messageId: input.messageId }];
  /**
   * Dua macam pertanyaan, dua perlakuan (docs/AI_BEHAVIOR.md):
   *   - SPESIFIKASI ("ada ukuran 3/4?", "standarnya apa?") → `PRODUCT_LOOKUP`: fakta katalog
   *     dirangkai kode dan dikirim apa adanya. Model tidak menyentuhnya — pernah dicoba, dan
   *     qwen2.5:7b membuang faktanya.
   *   - KONSEP ("apa bedanya PVC dan HDPE?") → `PRODUCT_FAQ`: model boleh menjelaskan sifat
   *     bahan secara kualitatif, dengan DATA katalog sebagai pijakan dan pagar angka
   *     ReplyWriter (tidak ada angka di luar DATA). Tanpa model, faktanya saja.
   */
  const facts: string[] = [];
  const finish = async (
    conceptual: boolean,
    products: readonly Product[],
  ): Promise<readonly AssistantStreamEvent[]> => {
    const factsText = facts.join('\n\n');
    let text = factsText;
    if (conceptual && reply && faqPrompt) {
      const written = await reply.write({
        intent: 'PRODUCT_LOOKUP',
        userMessage: input.message,
        recentTurns: input.recentTurns ?? [],
        facts: factsText,
        fallback: factsText,
        systemPrompt: faqPrompt,
      });
      // Fakta katalog tetap tampil bila penjelasan model tidak menyebut satu pun produknya.
      const mentionsCatalog = products.some((p) => written.text.includes(p.name));
      text =
        written.source === 'llm' && !mentionsCatalog && products.length > 0
          ? `${written.text}\n\n${factsText}`
          : written.text;
    }
    events.splice(1, 0, { type: 'token', text });
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
    return finish(false, []);
  }

  const { products, missing } = await findProducts(catalog, parsed.productQuery);
  if (products.length === 0) {
    facts.push(PRODUCT_ANSWER_COPY.notInCatalog(parsed.productQuery));
    events.push({ type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } });
    // Produk tidak ada di katalog, tetapi pertanyaan konsep tetap bisa dijelaskan umum.
    return finish(parsed.aspect === null, []);
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
  return finish(parsed.aspect === null, products);
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
