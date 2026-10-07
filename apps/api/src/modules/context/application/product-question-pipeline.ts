/**
 * Ruas pertanyaan produk — dua jalur dengan sumber kebenaran yang berbeda.
 * docs/AI_BEHAVIOR.md §4 · docs/PRODUCT_KNOWLEDGE.md §1, §4.
 *
 *   KONSEP (`PRODUCT_FAQ`, aspek `null`: "apa bedanya PVC dan HDPE?", "apa itu PPR?")
 *     pengetahuan umum (pipe-knowledge.ts) → katalog sebagai PENDUKUNG, opsional →
 *     model merangkai (opsional) → jawaban.
 *     Jawaban harus utuh tanpa katalog dan tanpa model. Katalog yang gagal dibaca atau
 *     tidak otoritatif tidak mengubah isi penjelasannya — hanya menghilangkan bagian
 *     "yang mana di Pralon".
 *
 *   SPESIFIKASI (`PRODUCT_LOOKUP`, aspek terisi: "ada ukuran 3/4?", "standarnya apa?")
 *     katalog aktif → `product-knowledge` → kalimat templat dengan sumber. Model tidak
 *     menyentuhnya; ia hanya memetakan pertanyaan ke produk + aspek.
 *
 * Klaim tentang Pralon — termasuk "tidak ada di katalog Pralon" — hanya dibuat atas versi
 * katalog `pralon` (`isAuthoritative`). Katalog contoh pengembangan tidak pernah menjadi
 * dasar pernyataan apa pun tentang Pralon, dan produknya tidak dipakai sebagai pendukung
 * jawaban konsep.
 */
import type { Locale } from '@snouty/shared-types';
import {
  PipeSize,
  specHasValue,
  type AssistantCard,
  type AssistantStreamEvent,
  type Product,
  type ProductCardDto,
} from '@snouty/shared-types';
import type { AiService } from '../../ai/domain/ai.port.js';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { isAnswerable, isAuthoritative } from '../../product-catalog/domain/catalog-visibility.js';
import { CatalogUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import type { ProductQuestionService } from '../../product-knowledge/application/product-question.service.js';
import { endEvent } from './message-pipeline.js';
import { asksProductRange } from '../domain/message-signals.js';
import { MATERIALS, briefComparison, explain, materialsIn } from './pipe-knowledge.js';
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';
import { answerText, overviewText, PRODUCT_ANSWER_COPY } from './product-answer-text.js';

/** Maksimal produk yang dijawab sekaligus — "bedanya A dan B" adalah dua. */
const MAX_PRODUCTS = 2;
/** Perbandingan per dimensi ± dukungan katalog; 700 (balasan percakapan) memotongnya. */
const FAQ_MAX_LENGTH = 1800;

export type ProductCatalog = Pick<CatalogQueryService, 'activeVersion' | 'listProducts'>;

export interface ProductQuestionInput {
  readonly messageId: string;
  readonly message: string;
  readonly recentTurns?: readonly ReplyTurn[];
  /** Bahasa percakapan (Fase 15) — untuk penulisan ulang FAQ oleh model. */
  readonly locale?: Locale;
}

/** Hasil pencarian katalog beserta bobot yang boleh diberikan padanya. */
interface CatalogSupport {
  /** Versi aktif adalah impor Pralon — boleh mendasari klaim ada/tidak ada. */
  readonly authoritative: boolean;
  /** Katalog tidak terbaca (belum ada versi, ditolak sebagai contoh, database). */
  readonly unavailable: boolean;
  readonly products: readonly Product[];
  readonly missing: readonly string[];
}

const NO_SUPPORT: CatalogSupport = {
  authoritative: false,
  unavailable: false,
  products: [],
  missing: [],
};

export async function runProductQuestion(
  ai: AiService,
  catalog: ProductCatalog,
  questions: Pick<ProductQuestionService, 'answer'>,
  input: ProductQuestionInput,
  reply: ReplyWriter | null = null,
  faqPrompt: string | null = null,
): Promise<readonly AssistantStreamEvent[]> {
  let parsed;
  try {
    parsed = await ai.parseProductQuestion(input.message);
  } catch (error) {
    if (!(error instanceof AiOutputInvalidError)) throw error;
    parsed = null;
  }

  const query = parsed?.productQuery ?? null;
  const aspect = parsed?.aspect ?? null;

  const outcome =
    aspect === null
      ? await answerConcept(catalog, input, query, reply, faqPrompt)
      : await answerSpec(catalog, questions, query, aspect, parsed?.size ?? null);

  return [
    { type: 'message.start', messageId: input.messageId },
    { type: 'token', text: outcome.text },
    ...outcome.cards.map((card) => ({ type: 'card', card }) as AssistantStreamEvent),
    endEvent(input.messageId),
  ];
}

interface Outcome {
  readonly text: string;
  readonly cards: readonly AssistantCard[];
}

// ── Jalur KONSEP ────────────────────────────────────────────────────────────

async function answerConcept(
  catalog: ProductCatalog,
  input: ProductQuestionInput,
  query: string | null,
  reply: ReplyWriter | null,
  faqPrompt: string | null,
): Promise<Outcome> {
  // "Produk Pralon yang terkenal apa?" — ragam, bukan satu bahan. Diputuskan dari pesannya,
  // SEBELUM parse model: 7B pernah menjawab pertanyaan ini dengan productQuery "PVC".
  if (asksProductRange(input.message) && materialsIn(input.message).length === 0) {
    return rangeOverview(catalog);
  }

  const knowledge = withoutRepeating(explain(input.message, query), input);
  // Katalog opsional: kegagalan membacanya tidak boleh mengubah penjelasan teknik.
  const support = query === null ? NO_SUPPORT : await lookup(catalog, query, { optional: true });

  // Pendukung dari katalog HANYA bila otoritatif. Dari katalog contoh: tidak ada kartu,
  // tidak ada "tidak ada di katalog Pralon" — hanya ajakan ke tim teknis.
  const facts: string[] = [];
  const cards: AssistantCard[] = [];
  if (support.authoritative) {
    if (support.missing.length > 0) {
      facts.push(PRODUCT_ANSWER_COPY.notInCatalog(support.missing.join(', ')));
    }
    if (support.products.length > 0) {
      facts.push(PRODUCT_ANSWER_COPY.catalogSupport);
      facts.push(support.products.map(overviewText).join('\n\n'));
      cards.push({ kind: 'product', products: support.products.map(toCard) });
    }
    if (support.missing.length > 0) cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  } else {
    // Penutup: bila pengguna bertanya tentang Pralon-nya ("HDPE di Pralon ok nggak?"), katakan
    // MENGAPA belum bisa dijawab; dan jangan ulangi kalimat yang persis sama tiap giliran.
    const closing = /\bpralon\b/i.test(input.message)
      ? PRODUCT_ANSWER_COPY.catalogNotInstalledShort
      : PRODUCT_ANSWER_COPY.askTechnicalForProducts;
    if (!lastAssistantText(input).includes(closing)) facts.push(closing);
    cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  }

  if (knowledge === '' && support.products.length === 0) {
    // "Produk Pralon yang terkenal apa?" — pertanyaan tentang RAGAM, bukan satu produk.
    if (asksProductRange(input.message)) return rangeOverview(catalog);
    // Tidak ada yang dikenali: bukan bahan, bukan produk Pralon. Bertanya, bukan menebak.
    return { text: PRODUCT_ANSWER_COPY.noProductNamed, cards: [] };
  }

  const data = [knowledge, ...facts].filter((part) => part !== '').join('\n\n');
  if (!reply || !faqPrompt) return { text: data, cards };

  const written = await reply.write({
    intent: 'PRODUCT_LOOKUP',
    userMessage: input.message,
    recentTurns: input.recentTurns ?? [],
    facts: data,
    fallback: data,
    systemPrompt: faqPrompt,
    maxLength: FAQ_MAX_LENGTH,
    ...(input.locale ? { locale: input.locale } : {}),
  });
  // Model yang meringkas DATA berstruktur menjadi satu paragraf membuang perbedaannya —
  // persis "oversimplified" yang dikeluhkan. Struktur dijaga kode, bukan hanya diminta prompt.
  const accepted = written.source === 'llm' && keepsStructure(written.text, knowledge);
  const text = accepted ? withUncoveredFacts(written.text, facts, support.products) : data;
  return { text, cards };
}

/**
 * Anti-ulang: bila penjelasan yang sama baru saja diberikan (giliran asisten terakhir memuat
 * kalimat pembukanya) dan pertanyaan sekarang BUKAN pengulangan pertanyaan sebelumnya, cukup
 * satu kalimat pengingat — pengguna bertanya hal lain, bukan minta diulang.
 */
function lastAssistantText(input: ProductQuestionInput): string {
  return [...(input.recentTurns ?? [])].reverse().find((t) => t.role === 'assistant')?.text ?? '';
}

function withoutRepeating(knowledge: string, input: ProductQuestionInput): string {
  if (knowledge === '') return knowledge;
  const turns = input.recentTurns ?? [];
  const lastAssistant = lastAssistantText(input);
  const lastUser = [...turns].reverse().find((t) => t.role === 'user')?.text ?? '';
  const opening = knowledge.split('\n')[0] ?? '';
  const repeated = opening !== '' && lastAssistant.includes(opening);
  const sameQuestion = normalize(lastUser) === normalize(input.message);
  if (!repeated || sameQuestion) return knowledge;
  const materials = materialsIn(input.message, null).slice(0, 2);
  return materials.length > 0 ? briefComparison(materials) : knowledge;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Bila pengetahuan dirangkai sebagai butir, tulisan model harus tetap berbutir — minimal
 * separuh jumlah butirnya — dan membawa penekanan tebal. Teks tanpa struktur → teks deterministik.
 */
export function keepsStructure(written: string, knowledge: string): boolean {
  const items = (s: string) => (s.match(/^\s*(?:[-*]|\d+\.)\s/gm) ?? []).length;
  const expected = items(knowledge);
  if (expected === 0) return true;
  return items(written) * 2 >= expected && written.includes('**');
}

/**
 * Ikhtisar ragam produk. Atas katalog Pralon (otoritatif): keluarga produk yang aktif beserta
 * anggotanya, satu kartu per keluarga. Atas katalog contoh / katalog tak terbaca: TIDAK ada
 * nama produk — jujur bahwa katalog Pralon belum terpasang, lalu ragam keluarga bahan secara
 * umum dari pengetahuan milik kode, dan tim teknis untuk daftar resminya.
 */
async function rangeOverview(catalog: ProductCatalog): Promise<Outcome> {
  let authoritative = false;
  let products: readonly Product[] = [];
  try {
    authoritative = isAuthoritative(await catalog.activeVersion());
    if (authoritative) {
      const page = await catalog.listProducts({ limit: 50 });
      products = page.items.filter(isAnswerable);
    }
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError)) throw error;
  }

  if (authoritative && products.length > 0) {
    const byFamily = new Map<string, Product[]>();
    for (const p of products) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p]);
    const lines = [...byFamily.entries()].map(
      ([family, members]) => `- **${family}**: ${members.map((m) => m.name).join(', ')}`,
    );
    const representatives = [...byFamily.values()]
      .slice(0, 4)
      .map((members) => toCard(members[0]!));
    return {
      text: [PRODUCT_ANSWER_COPY.rangeIntro, ...lines, '', PRODUCT_ANSWER_COPY.rangeNext].join(
        '\n',
      ),
      cards: [{ kind: 'product', products: representatives }],
    };
  }

  const families = MATERIALS.map(
    (m) => `- **${m.label}** — ${m.gist}; lazim untuk ${m.typicalUse}.`,
  );
  return {
    text: [
      PRODUCT_ANSWER_COPY.catalogNotInstalled,
      '',
      ...families,
      '',
      PRODUCT_ANSWER_COPY.askTechnicalForProducts,
    ].join('\n'),
    cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }],
  };
}

// ── Jalur SPESIFIKASI ───────────────────────────────────────────────────────

async function answerSpec(
  catalog: ProductCatalog,
  questions: Pick<ProductQuestionService, 'answer'>,
  query: string | null,
  aspect: NonNullable<Awaited<ReturnType<AiService['parseProductQuestion']>>['aspect']>,
  rawSize: string | null,
): Promise<Outcome> {
  if (query === null) return { text: PRODUCT_ANSWER_COPY.noProductNamed, cards: [] };

  const support = await lookup(catalog, query, { optional: false });
  if (support.unavailable) {
    return {
      text: PRODUCT_ANSWER_COPY.catalogUnavailable,
      cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }],
    };
  }

  const notFound = (names: string) =>
    support.authoritative
      ? PRODUCT_ANSWER_COPY.notInCatalog(names)
      : PRODUCT_ANSWER_COPY.notInInstalledCatalog(names);

  if (support.products.length === 0) {
    return { text: notFound(query), cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }] };
  }

  const facts: string[] = [];
  const cards: AssistantCard[] = [];
  // "PVC dan HDPE" dengan HDPE tidak ada: katakan yang tidak ada, jangan diam-diam
  // menjawab separuh seolah itu seluruh pertanyaannya.
  if (support.missing.length > 0) facts.push(notFound(support.missing.join(', ')));

  let needsTechnical = support.missing.length > 0;
  for (const product of support.products) {
    const size = rawSize ? (PipeSize.parse(rawSize) ?? undefined) : undefined;
    const answer = await questions.answer({
      productId: product.id,
      aspect,
      ...(size !== undefined ? { size } : {}),
    });
    facts.push(answerText(product, answer));
    if (answer.kind === 'insufficientData') needsTechnical = true;
  }
  if (needsTechnical) cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  cards.push({ kind: 'product', products: support.products.map(toCard) });

  return { text: facts.join('\n\n'), cards };
}

// ── Katalog ─────────────────────────────────────────────────────────────────

/**
 * "PVC AW dan HDPE" → dua pencarian; tiap pencarian memberi satu produk teratas supaya
 * perbandingan tetap satu lawan satu, bukan daftar seluruh keluarga. Produk `discontinued`
 * tidak dihitung ada. `optional`: kegagalan membaca katalog dilaporkan sebagai
 * `unavailable`, bukan dilempar — jalur konsep tidak boleh jatuh karena katalog.
 */
async function lookup(
  catalog: ProductCatalog,
  query: string,
  { optional }: { readonly optional: boolean },
): Promise<CatalogSupport> {
  let authoritative: boolean;
  try {
    authoritative = isAuthoritative(await catalog.activeVersion());
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError) || !optional) {
      if (error instanceof CatalogUnavailableError) return { ...NO_SUPPORT, unavailable: true };
      throw error;
    }
    return { ...NO_SUPPORT, unavailable: true };
  }

  const terms = query
    .split(/\s+(?:dan|sama|vs|versus|atau)\s+|,/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, MAX_PRODUCTS);
  const products: Product[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    const page = await catalog.listProducts({ q: term, limit: 1 });
    const product = page.items[0];
    if (!product || !isAnswerable(product)) missing.push(term);
    else if (!products.some((f) => f.id === product.id)) products.push(product);
  }
  return { authoritative, unavailable: false, products, missing };
}

/**
 * Fakta katalog yang tidak tercermin di tulisan model ditempel di bawahnya: ikhtisar produk
 * bila namanya tidak disebut, kalimat "tidak ada di katalog" bila katalog tidak disinggung.
 * Yang sudah disebut tidak diulang — jawaban yang menyebut hal yang sama dua kali terbaca mesin.
 */
function withUncoveredFacts(
  written: string,
  facts: readonly string[],
  products: readonly Product[],
): string {
  const lower = written.toLowerCase();
  const uncovered = facts.filter((fact) => {
    if (fact === PRODUCT_ANSWER_COPY.catalogSupport) return false;
    if (fact.includes('tim teknis')) return !lower.includes('tim teknis');
    if (fact.includes('tidak ada di katalog')) return !lower.includes('katalog');
    return !products.some((p) => fact.includes(p.name) && written.includes(p.name));
  });
  return [written, ...uncovered].join('\n\n');
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
