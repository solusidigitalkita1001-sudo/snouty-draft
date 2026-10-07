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
import { DEFAULT_LOCALE, type ConversationSubject, type Locale } from '@snouty/shared-types';
import {
  isChoiceFollowUp,
  isFollowUp,
  isFormatFollowUp,
  requestedDepth,
  requestedFormat,
} from '../domain/subject.js';
import { PRODUCT_CONCEPT, heuristicProductQuestion } from '../../ai/domain/heuristics.js';
import type { ProductQuestionParse } from '../../ai/domain/extraction-schema.js';
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
import { MATERIALS, briefComparison, explain, materialsIn, reformat } from './pipe-knowledge.js';
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';
import { answerText, overviewText, productAnswerCopy } from './product-answer-text.js';

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
  /**
   * Subjek percakapan aktif (Fase 16): "lebih detail dong" setelah jawaban HDPE adalah tentang
   * HDPE — entitas subjek menjadi query bila pesannya tidak menyebut produk.
   */
  readonly subject?: ConversationSubject;
}

/** Pesan lanjutan atas subjek produk: entitas subjek yang ditanya, bukan pesannya. */
function subjectQuery(input: ProductQuestionInput): string | null {
  const subject = input.subject;
  if (!subject || subject.kind === 'company' || subject.kind === 'case') return null;
  return isFollowUp(input.message) ||
    isFormatFollowUp(input.message) ||
    isChoiceFollowUp(input.message)
    ? subject.entity
    : null;
}

/**
 * "Bikinin skema perbedaannya dalam bentuk tabel": jawaban yang baru diberikan disajikan ulang —
 * isinya dari jawaban asisten terakhir dan subjek, bukan dari pesan yang memang tidak menyebut apa-apa.
 */
function reformatted(input: ProductQuestionInput, locale: Locale): string | null {
  const format = requestedFormat(input.message);
  if (format === null) return null;
  const mentioned = materialsIn(input.message).length > 0;
  // Tanpa bahan di pesan, ini harus lanjutan ("tabelnya dong"); dengan bahan ("bandingin sama PVC
  // dalam bentuk tabel") permintaannya sudah jelas sendiri — bahan pesan digabung dengan subjek.
  if (!mentioned && !isFormatFollowUp(input.message)) return null;
  const subjectEntity = input.subject?.kind === 'product' ? input.subject.entity : null;
  return reformat(
    format,
    {
      subject: [input.message, subjectEntity].filter((s) => s !== null).join(' dan '),
      previous: lastAssistantTextWithMaterial(input),
    },
    locale,
  );
}

const PRICE_QUESTION =
  /\b(harga|harganya|berapa duit|berapa rupiah|biaya|biayanya|price|prices|cost|how much)\b/i;

const COMPARISON_REQUEST =
  /\b(beda|bedanya|perbedaan|bandingkan|bandingin|dibanding|differ|difference|compare|versus|vs)\b/i;

/** Jawaban asisten terakhir yang memang membahas bahan — melewati balasan tanya-balik di antaranya. */
function lastAssistantTextWithMaterial(input: ProductQuestionInput): string {
  const assistant = [...(input.recentTurns ?? [])].reverse().filter((t) => t.role === 'assistant');
  return assistant.find((t) => materialsIn(t.text).length > 0)?.text ?? lastAssistantText(input);
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
  const locale = input.locale ?? DEFAULT_LOCALE;

  // Harga tidak ditampilkan (OQ-03): jawab jujur dan arahkan, jangan bertanya "produk mana".
  if (PRICE_QUESTION.test(input.message)) {
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: productAnswerCopy(locale).priceNotShown },
      { type: 'card', card: { kind: 'cta', action: 'CONTACT_TECHNICAL' } },
      endEvent(input.messageId),
    ];
  }

  const asTable = reformatted(input, locale);
  if (asTable !== null) {
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: asTable },
      endEvent(input.messageId),
    ];
  }

  // Model pemeta pertanyaan hanya dipanggil bila jalur deterministik tidak cukup: lanjutan subjek
  // sudah tahu produknya, dan pertanyaan pengetahuan tanpa keluarga produk ("pipa buat air panas
  // pake apa?") sudah terjawab dari pengetahuan milik kode. Di CPU, satu panggilan itu ±1 menit
  // (uji proaktif 2026-10-07: 61–87 s per giliran hanya untuk memetakan).
  const continued = subjectQuery(input);
  const heuristic = heuristicProductQuestion(input.message);
  const knowledgeOnly =
    heuristic.productQuery === null && explain(input.message, null, locale) !== '';
  let parsed: ProductQuestionParse | null = null;
  if (continued === null && !knowledgeOnly) {
    try {
      parsed = await ai.parseProductQuestion(input.message);
    } catch (error) {
      if (!(error instanceof AiOutputInvalidError)) throw error;
      parsed = null;
    }
  }
  const query = continued ?? parsed?.productQuery ?? null;
  // Lanjutan ("lebih detail dong") memperdalam penjelasan konsep; aspek hanya dari pesan nyata —
  // dan tidak pernah dari pertanyaan konsep ("apa bedanya fitting sama HDPE?"), apa pun kata model.
  const conceptual = PRODUCT_CONCEPT.test(input.message.toLowerCase());
  const aspect = continued !== null || conceptual ? null : (parsed?.aspect ?? null);

  const outcome =
    aspect === null
      ? await answerConcept(catalog, input, query, reply, faqPrompt)
      : await answerSpec(catalog, questions, query, aspect, parsed?.size ?? null, locale);

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
  const locale = input.locale ?? DEFAULT_LOCALE;
  const COPY = productAnswerCopy(locale);
  // "Produk Pralon yang terkenal apa?" — ragam, bukan satu bahan. Diputuskan dari pesannya,
  // SEBELUM parse model: 7B pernah menjawab pertanyaan ini dengan productQuery "PVC".
  if (asksProductRange(input.message) && materialsIn(input.message).length === 0) {
    return rangeOverview(catalog, locale);
  }

  // "Bedanya sama pipa AW?" saat subjeknya HDPE: satu bahan di pesan dibandingkan dengan bahan
  // yang sedang dibahas — bukan dijelaskan sendirian.
  const subjectEntity = input.subject?.kind === 'product' ? input.subject.entity : null;
  const comparedQuery =
    COMPARISON_REQUEST.test(input.message) &&
    materialsIn(input.message, query).length === 1 &&
    subjectEntity !== null &&
    materialsIn(subjectEntity).some((m) => !materialsIn(input.message, query).includes(m))
      ? `${query ?? input.message} dan ${subjectEntity}`
      : query;
  const knowledge = withoutRepeating(explain(input.message, comparedQuery, locale), input);
  // Katalog opsional: kegagalan membacanya tidak boleh mengubah penjelasan teknik.
  const support = query === null ? NO_SUPPORT : await lookup(catalog, query, { optional: true });

  // Pendukung dari katalog HANYA bila otoritatif. Dari katalog contoh: tidak ada kartu,
  // tidak ada "tidak ada di katalog Pralon" — hanya ajakan ke tim teknis.
  const facts: string[] = [];
  const cards: AssistantCard[] = [];
  if (support.authoritative) {
    if (support.missing.length > 0) {
      facts.push(COPY.notInCatalog(support.missing.join(', ')));
    }
    if (support.products.length > 0) {
      facts.push(COPY.catalogSupport);
      facts.push(support.products.map((p) => overviewText(p, locale)).join('\n\n'));
      cards.push({ kind: 'product', products: support.products.map(toCard) });
    }
    if (support.missing.length > 0) cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  } else {
    // Penutup: bila pengguna bertanya tentang Pralon-nya ("HDPE di Pralon ok nggak?"), katakan
    // MENGAPA belum bisa dijawab; dan jangan ulangi kalimat yang persis sama tiap giliran.
    const closing = /\bpralon\b/i.test(input.message)
      ? COPY.catalogNotInstalledShort
      : COPY.askTechnicalForProducts;
    if (!lastAssistantText(input).includes(closing)) facts.push(closing);
    cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  }

  if (knowledge === '' && support.products.length === 0) {
    // "Produk Pralon yang terkenal apa?" — pertanyaan tentang RAGAM, bukan satu produk.
    if (asksProductRange(input.message)) return rangeOverview(catalog, locale);
    // Tidak ada yang dikenali: bukan bahan, bukan produk Pralon. Bertanya, bukan menebak.
    return { text: COPY.noProductNamed, cards: [] };
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
  // Pengguna meminta LEBIH ("lebih detail", "lengkap", "lanjut"): penjelasan utuh, bukan pengingat.
  if (isFollowUp(input.message) || requestedDepth(input.message) !== null) return knowledge;
  const turns = input.recentTurns ?? [];
  const lastAssistant = lastAssistantText(input);
  const lastUser = [...turns].reverse().find((t) => t.role === 'user')?.text ?? '';
  const opening = knowledge.split('\n')[0] ?? '';
  const repeated = opening !== '' && lastAssistant.includes(opening);
  const sameQuestion = normalize(lastUser) === normalize(input.message);
  if (!repeated || sameQuestion) return knowledge;
  const materials = materialsIn(input.message, null).slice(0, 2);
  return materials.length > 0
    ? briefComparison(materials, input.locale ?? DEFAULT_LOCALE)
    : knowledge;
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
async function rangeOverview(
  catalog: ProductCatalog,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Outcome> {
  const COPY = productAnswerCopy(locale);
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
      text: [COPY.rangeIntro, ...lines, '', COPY.rangeNext].join('\n'),
      cards: [{ kind: 'product', products: representatives }],
    };
  }

  const families = MATERIALS.map(
    (m) => `- **${m.label}** — ${m.gist}; lazim untuk ${m.typicalUse}.`,
  );
  return {
    text: [COPY.catalogNotInstalled, '', ...families, '', COPY.askTechnicalForProducts].join('\n'),
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
  locale: Locale = DEFAULT_LOCALE,
): Promise<Outcome> {
  const COPY = productAnswerCopy(locale);
  if (query === null) return { text: COPY.noProductNamed, cards: [] };

  const support = await lookup(catalog, query, { optional: false });
  if (support.unavailable) {
    return {
      text: COPY.catalogUnavailable,
      cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }],
    };
  }

  const notFound = (names: string) =>
    support.authoritative ? COPY.notInCatalog(names) : COPY.notInInstalledCatalog(names);

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
    facts.push(answerText(product, answer, locale));
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
    const page = await catalog.listProducts({ q: term, limit: 10 });
    const product = bestMatch(page.items.filter(isAnswerable), term);
    if (!product) missing.push(term);
    else if (!products.some((f) => f.id === product.id)) products.push(product);
  }
  return { authoritative, unavailable: false, products, missing };
}

/**
 * Produk yang paling mewakili sebuah istilah: keluarga yang sama namanya menang atas nama yang
 * kebetulan memuatnya ("HDPE" → keluarga HDPE, bukan pipa kabel yang kebetulan bernama HDPE), dan
 * pipa menang atas fitting untuk istilah bahan. Pencarian LIKE memberi urutan sembarang.
 */
export function bestMatch(items: readonly Product[], term: string): Product | undefined {
  const needle = term.toLowerCase();
  const score = (p: Product): number => {
    const family = p.family.toLowerCase();
    const name = p.name.toLowerCase();
    const category = p.category.toLowerCase();
    return (
      (family === needle ? 4 : family.includes(needle) ? 3 : 0) +
      (name.includes(needle) ? 1 : 0) +
      (category.includes('pipa') ? 1 : 0) +
      // Keluarga HDPE Pralon memuat pipa air (PE 100 PN-8) DAN pipa pelindung kabel (Telkom)
      // bersebelahan. Untuk pertanyaan bahan, pipa air yang mewakili; penanda kelas tekanan/
      // standar di nama menaikkannya, penanda saluran kabel menurunkannya.
      (WATER_PIPE_MARKER.test(name) ? 1 : 0) -
      (CABLE_DUCT_MARKER.test(name) ? 2 : 0)
    );
  };
  return [...items].sort((a, b) => score(b) - score(a))[0];
}

const WATER_PIPE_MARKER = /\b(pe ?100|pe ?80|pn[- ]?\d+|sni|aw|kelas|class|s-\d+)\b/i;
const CABLE_DUCT_MARKER = /\b(telkom|kabel|cable|duct|subduct|conduit|fo|fiber)\b/i;

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
    if (
      fact === productAnswerCopy('id').catalogSupport ||
      fact === productAnswerCopy('en').catalogSupport
    )
      return false;
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
