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
  FITTING_VS_MATERIAL,
  isChoiceFollowUp,
  isFollowUp,
  isFormatFollowUp,
} from '../domain/subject.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import type { EntityLexicon } from '../../understanding/domain/vocabulary.js';
import { isConceptual } from '../../understanding/domain/labels.js';
import { parseSize } from '../domain/size-parser.js';
import { designationsOf } from '../../product-catalog/domain/product-identity.js';
import { catalogScope, fittingAnswer, fittingScope, type FittingOutcome } from './catalog-scope.js';
import { knowledgeAnswer, mentionsPressure, pressureRange } from './knowledge-answer.js';
import { asksGeneralKnowledge } from './intent-router.js';
import { runsReply } from './solution-facts.js';
/** Topik yang hanya tentang jalur buangan — jawabannya tidak perlu membacakan jalur air bersih. */
const DRAINAGE_TOPICS: ReadonlySet<string> = new Set(['pipa pembuangan', 'kemiringan buangan']);
import type { ActiveSolution } from '../domain/active-solution.port.js';
import { factTopics } from '../infrastructure/knowledge-facts.js';
import { repeatedTopicReply } from './reply-copy.js';
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
import { dimensionAnswer } from './dimension-answer.js';
import { pipeStandardRows } from '../../product-knowledge/infrastructure/pipe-standards.loader.js';
import {
  briefComparison,
  compareMaterials,
  explain,
  materialsFor,
  reformat,
} from './pipe-knowledge.js';
import type { ReplyTurn, ReplyWriter } from './reply-writer.js';
import { answerText, overviewText, productAnswerCopy } from './product-answer-text.js';
import {
  familyRange,
  familySizes,
  overviewChoice,
  previousRange,
  rangeOverview,
  familySizeAnswer,
} from './product-range.js';

/** Alias kosakata sebuah keluarga kanonis — untuk mencari katalog dengan nama yang dipakai katalog. */
type Aliases = (family: string) => readonly string[];
const NO_ALIASES: Aliases = () => [];
/**
 * Nama yang disebut pengguna untuk ditulis di kalimat: nama keluarga produk dari kosakata ditulis
 * seperti nama produknya ("hdpe" → "HDPE", "pvc d" → "PVC D"); nama lain apa adanya. Dulu kata
 * kuncinya dikutip mentah ('"ppr" tidak ada di katalog…', audit 2026-10-19).
 */
function displayNameOf(term: string, lexicon: Pick<EntityLexicon, 'productFamilies'>): string {
  const families = lexicon.productFamilies(term);
  return families.length === 1 && families[0] === term.trim().toLowerCase()
    ? term.trim().toUpperCase()
    : term;
}

const aliasesFrom = (lexicon: Partial<Pick<EntityLexicon, 'aliasesOf'>>): Aliases =>
  lexicon.aliasesOf ? (family) => lexicon.aliasesOf!(family) : NO_ALIASES;

/** Maksimal produk yang dijawab sekaligus — "bedanya A dan B" adalah dua. */
const MAX_PRODUCTS = 2;
/** Perbandingan per dimensi ± dukungan katalog; 700 (balasan percakapan) memotongnya. */
const FAQ_MAX_LENGTH = 1800;

export type ProductCatalog = Pick<
  CatalogQueryService,
  'activeVersion' | 'listProducts' | 'familyCounts' | 'productNamesInFamily' | 'categoryCounts'
>;

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
  /** Hasil pemahaman pesan (intent, aspek, topik, keluarga produk) — dihitung sekali per giliran. */
  readonly understanding: MessageUnderstanding;
  /** Kosakata entitas, untuk membaca keluarga produk dari teks lain (subjek, jawaban sebelumnya). */
  readonly lexicon: Pick<
    EntityLexicon,
    'productFamilies' | 'isCatalogFamily' | 'isFittingFamily' | 'aliasesOf' | 'mentionsOwnBrand'
  > &
    Partial<Pick<EntityLexicon, 'representativeFamily'>>;
  /** Solusi aktif percakapan: pertanyaan yang tidak tercakup data pengetahuan dijawab dari jalurnya. */
  readonly solution?: ActiveSolution | null;
  /** Dipanggil untuk tiap data resmi yang belum ada di jawaban pengetahuan (log, bukan state). */
  readonly onGap?: (gap: { readonly topic: string; readonly gap: string }) => void;
}

/** Pesan lanjutan atas subjek produk: entitas subjek yang ditanya, bukan pesannya. */
function subjectQuery(input: ProductQuestionInput): string | null {
  const subject = input.subject;
  if (!subject || subject.kind === 'company' || subject.kind === 'case') return null;
  // Subjek produk tanpa entitas tercatat sebagai merek sendiri ("Pralon") — itu penanda "ragam
  // Pralon", bukan nama keluarga. Mencarinya ke katalog menghasilkan "Pralon tidak ada di katalog
  // Pralon" lalu ikhtisar 7.664 produk untuk pertanyaan "ada yang lebih murah ga" (produksi
  // 2026-10-26).
  if (
    input.lexicon.mentionsOwnBrand(subject.entity) &&
    input.lexicon.productFamilies(subject.entity).length === 0
  )
    return null;
  const u = input.understanding;
  return isFollowUp(u) || isFormatFollowUp(u) || isChoiceFollowUp(u) ? subject.entity : null;
}

/**
 * Keluarga produk kanonis yang disebut pesan — query katalog ("pvc aw dan hdpe"); `null` bila tidak
 * ada. Keluarga yang hanya pengetahuan (galvanis — bukan produk Pralon) tidak dicari ke katalog:
 * "tidak ada di katalog Pralon" untuk pipa besi bukan informasi, melainkan kebingungan.
 */
export function productQueryOf(
  u: MessageUnderstanding,
  lexicon: Pick<EntityLexicon, 'isCatalogFamily' | 'isFittingFamily'>,
): string | null {
  const catalog = u.families.filter((f) => lexicon.isCatalogFamily(f));
  // "tee pvc 3/4 ada?" mencari SATU produk (tee dari PVC), bukan dua pencarian "tee" dan "pvc"
  // yang masing-masing mengembalikan produk sembarang (audit live 2026-10-08).
  const fittings = catalog.filter((f) => lexicon.isFittingFamily(f));
  const materials = catalog.filter((f) => !lexicon.isFittingFamily(f));
  if (fittings.length === 1 && materials.length === 1) return `${fittings[0]} ${materials[0]}`;
  const families = catalog.slice(0, MAX_PRODUCTS);
  return families.length > 0 ? families.join(' dan ') : null;
}

/**
 * "Bikinin skema perbedaannya dalam bentuk tabel": jawaban yang baru diberikan disajikan ulang —
 * isinya dari bahan yang sedang dibicarakan (pesan + subjek, atau jawaban asisten terakhir yang
 * membahas bahan), bukan dari pesan yang memang tidak menyebut apa-apa.
 */
function reformatted(input: ProductQuestionInput, locale: Locale): string | null {
  const u = input.understanding;
  const format = u.format;
  if (format === null) return null;
  const mentioned = u.families.length > 0;
  // Tanpa bahan di pesan, ini harus lanjutan ("tabelnya dong"); dengan bahan ("bandingin sama PVC
  // dalam bentuk tabel") permintaannya sudah jelas sendiri — bahan pesan digabung dengan subjek.
  if (!mentioned && !isFormatFollowUp(u)) return null;
  const subjectEntity = input.subject?.kind === 'product' ? input.subject.entity : '';
  // Subjek dulu: penjelasan fitting menyebut "PVC untuk PVC, HDPE untuk HDPE", jadi membaca bahan
  // dari teks jawaban saja akan mengira ada dua bahan yang dibandingkan.
  const fromSubject = materialsFor([
    ...u.families,
    ...input.lexicon.productFamilies(subjectEntity),
  ]);
  const materials =
    fromSubject.length > 0
      ? fromSubject
      : materialsFor(input.lexicon.productFamilies(lastAssistantTextWithMaterial(input)));
  // Lanjutan atas jawaban "fitting vs HDPE" (topik subjek, lihat `productSubject`) tetap tabel
  // komponen-lawan-bahan, bukan tabel dua bahan.
  const fitting =
    u.knowledgeTopics.includes('fitting') || input.subject?.topic === FITTING_VS_MATERIAL;
  return reformat(format, { materials, fitting }, locale);
}

/** Jawaban asisten terakhir yang memang membahas bahan — melewati balasan tanya-balik di antaranya. */
function lastAssistantTextWithMaterial(input: ProductQuestionInput): string {
  const assistant = [...(input.recentTurns ?? [])].reverse().filter((t) => t.role === 'assistant');
  return (
    assistant.find((t) => input.lexicon.productFamilies(t.text).length > 0)?.text ??
    lastAssistantText(input)
  );
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

/**
 * Pertanyaan membandingkan: intent yakin `product_comparison`, atau — saat intent ragu — label
 * teratas peringkatnya ("dasar memilih HDPE dibanding uPVC?": perbandingan 0,841 vs saran 0,837).
 */
function asksComparison(u: ProductQuestionInput['understanding']): boolean {
  return (u.intent?.label ?? u.intentRanking[0]?.label) === 'product_comparison';
}

/** Penjawab pengetahuan umum (P30-01); `null` bila belum dikonfigurasi. */
export interface GeneralKnowledgeAnswerer {
  answer(input: {
    readonly message: string;
    readonly recentTurns: readonly ReplyTurn[];
    readonly locale: Locale;
  }): Promise<string | null>;
}

export async function runProductQuestion(
  ai: AiService,
  catalog: ProductCatalog,
  questions: Pick<ProductQuestionService, 'answer'>,
  input: ProductQuestionInput,
  reply: ReplyWriter | null = null,
  faqPrompt: string | null = null,
  /** Pengetahuan umum pipa untuk pertanyaan yang tidak tercakup data (P30-01). */
  knowledge: GeneralKnowledgeAnswerer | null = null,
): Promise<readonly AssistantStreamEvent[]> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const u = input.understanding;

  // Tebal dinding / diameter dalam / berat: tabel standar Pralon per kelas (P21-08), nol model.
  // Didahulukan dari harga: "tebal pipa d 3 inch berapa?" sempat terbaca pertanyaan harga karena
  // "berapa" (QA smoke 2026-10-14) — aspek tebal/berat dari contoh lebih spesifik daripada intentnya.
  const nominalSizes = u.families.length === 0 && u.knowledgeTopics.includes('ukuran inci');
  if (u.productAspect === 'dimensions' && !nominalSizes) {
    const outcome = dimensionAnswer(input.message, u.families, pipeStandardRows(), locale);
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: outcome.text },
      ...outcome.cards.map((card) => ({ type: 'card', card }) as AssistantStreamEvent),
      endEvent(input.messageId),
    ];
  }

  // Harga tidak ditampilkan (OQ-03): jawab jujur dan arahkan, jangan bertanya "produk mana".
  if (u.intent?.label === 'price_question') {
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: productAnswerCopy(locale).priceNotShown },
      // Penawaran milik tim sales, bukan validasi teknis (P26-04).
      { type: 'card', card: { kind: 'cta', action: 'CONTACT_SALES' } },
      endEvent(input.messageId),
    ];
  }

  // Pengetahuan bersumber (data/knowledge + konsep) untuk topik yang dikenali — sebelum jalur
  // katalog, karena "pipa pralon bisa buat cairan kimia?" dulu dijawab ikhtisar seluruh katalog
  // (daftar FAQ pemilik 2026-10-09). Fakta + data katalog yang dihitung saat ini adalah DATA;
  // mode kualitas merangkainya untuk pertanyaan ini, mode hemat menampilkannya langsung.
  // Nilai tekanan di pesan ("8-12 bar") membawa topik tekanan kerja — kelas tekanan dari katalog.
  const knowledgeTopics = mentionsPressure(input.message)
    ? [...new Set([...u.knowledgeTopics, 'tekanan kerja'])]
    : u.knowledgeTopics;
  // "kalau yang 3/4?" atas subjek produk (tee PVC) adalah ukuran produk itu, bukan topik "ukuran inci"
  // (simulasi 2026-10-19: dijawab tabel diameter luar).
  const sizeOfSubject =
    u.families.length === 0 &&
    input.subject?.kind === 'product' &&
    u.productAspect === 'size_availability' &&
    parseSize(input.message) !== null;
  if (!sizeOfSubject && knowledgeTopics.some((t) => factTopics().has(t))) {
    // Lanjutan tanpa bahan ("panjang per batangnya?" setelah ukuran HDPE) membicarakan bahan
    // subjeknya, bukan semua keluarga di fakta (audit campuran 2026-10-20).
    const subjectFamilies =
      u.families.length === 0 && input.subject?.kind === 'product'
        ? input.lexicon.productFamilies(input.subject.entity)
        : [];
    const answer = await knowledgeAnswer(
      knowledgeTopics,
      input.message,
      catalog,
      locale,
      u.families,
      subjectFamilies,
    );
    // Perbandingan umum bahan HANYA bila pertanyaannya memang perbandingan ("dasar memilih HDPE
    // dibanding uPVC?"): tes FAQ 2026-10-12 — blok "HDPE lentur dan bisa digulung" membuka jawaban
    // soal tekanan, air panas, dan jenis pipa baru. Pertanyaan bernilai tekanan dijawab kelasnya.
    const compared =
      asksComparison(u) && pressureRange(input.message) === null ? materialsFor(u.families) : [];
    const known =
      answer !== null && compared.length >= 2
        ? {
            ...answer,
            // Tabel perbandingan sudah menjawab "dasar memilih"; dari pengetahuan hanya topik terdekat
            // yang ikut — dulu tiga topik menempel di bawah tabel (uji sales 2026-10-20).
            text: [
              compareMaterials(compared[0]!, compared[1]!, locale),
              (
                (await knowledgeAnswer(
                  knowledgeTopics.slice(0, 1),
                  input.message,
                  catalog,
                  locale,
                  u.families,
                  subjectFamilies,
                )) ?? answer
              ).text,
            ].join('\n\n'),
          }
        : answer;
    if (known !== null) {
      // Topik yang BARU SAJA dijawab tidak dikirim ulang kata demi kata: dua pertanyaan pompa
      // berurutan mendapat blok empat paragraf yang sama persis (produksi 2026-10-26), dan tidak
      // ada yang lebih menandai bot daripada itu. Yang dikatakan: bagian mana yang mau diperjelas.
      const lastAssistant =
        [...(input.recentTurns ?? [])].reverse().find((t) => t.role === 'assistant')?.text ?? '';
      if (lastAssistant.trim() !== '' && lastAssistant.includes(known.text.trim())) {
        return [
          { type: 'message.start', messageId: input.messageId },
          { type: 'token', text: repeatedTopicReply(locale) },
          endEvent(input.messageId),
        ];
      }
      const text =
        reply && faqPrompt
          ? (
              await reply.write({
                intent: 'PRODUCT_LOOKUP',
                userMessage: input.message,
                recentTurns: input.recentTurns ?? [],
                facts: known.text,
                locale,
                fallback: known.text,
                systemPrompt: faqPrompt,
                maxLength: 2400,
              })
            ).text
          : known.text;
      // Data resmi yang belum ada: dicatat (bahan OQ-54/55) dan ditawarkan langkah konkret —
      // tombol teruskan ke tim teknis, bukan kalimat saja (tes FAQ 2026-10-12 bagian 4).
      for (const gap of known.gaps) input.onGap?.(gap);
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text },
        ...(known.gaps.length > 0
          ? [
              {
                type: 'card',
                card: { kind: 'cta', action: 'CONTACT_TECHNICAL' },
              } as AssistantStreamEvent,
            ]
          : []),
        endEvent(input.messageId),
      ];
    }
  }

  // Lingkup FITTING (audit 2026-10-09): keluarga katalog yang disebut pesan (atau subjek, untuk
  // lanjutan ukuran/jenis), dijawab dengan filter terstruktur — keluarga, kategori resmi, ukuran.
  const fitting = await fittingTurn(catalog, input, locale);
  if (fitting !== null) {
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: fitting.text },
      ...(fitting.products.length > 0
        ? [
            {
              type: 'card',
              card: { kind: 'product', products: fitting.products.map(toCard) },
            } as const,
          ]
        : []),
      endEvent(input.messageId),
    ];
  }

  // "Bikinin tabelnya" tepat setelah daftar ragam produk: yang disajikan ulang adalah RAGAM itu,
  // bukan perbandingan PVC vs HDPE — dulu bahan dibaca dari teks jawaban, dan daftar ragam
  // menyebut HDPE dan PVC (laporan pemilik 2026-10-08).
  const previous = isFormatFollowUp(u) ? previousRange(lastAssistantText(input)) : null;
  if (previous !== null) {
    const subjectFamilies =
      input.subject?.kind === 'product' ? input.lexicon.productFamilies(input.subject.entity) : [];
    const range =
      (previous === 'family' && subjectFamilies.length > 0
        ? await familyRange(catalog, subjectFamilies, locale, u.format)
        : null) ?? (await rangeOverview(catalog, locale, u.format));
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: range.text },
      ...range.cards.map((card) => ({ type: 'card', card }) as const),
      endEvent(input.messageId),
    ];
  }

  // "boleh" atas ikhtisar ragam: tanyakan keluarganya, bukan ajakan umum.
  if (previousRange(lastAssistantText(input)) === 'overview' && isFollowUp(u)) {
    const choice = await overviewChoice(catalog, locale);
    if (choice !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: choice.text },
        endEvent(input.messageId),
      ];
    }
  }

  // Memilih SATU jenis dari keluarga yang sedang dibahas dengan namanya sendiri ("yang pe 100 aja"
  // setelah ukuran per jenis HDPE): "pe 100" alias HDPE, jadi tanpa ini terbaca menyebut keluarga
  // dan daftar jenisnya diulang (simulasi 2026-10-19).
  const subjectFamilies =
    input.subject?.kind === 'product' ? input.lexicon.productFamilies(input.subject.entity) : [];
  if (
    previousRange(lastAssistantText(input)) === 'family' &&
    u.families.length > 0 &&
    u.families.every((f) => subjectFamilies.includes(f)) &&
    !u.mentionsRequirement
  ) {
    const chosen = await familySizes(
      catalog,
      subjectFamilies,
      input.message,
      false,
      lastAssistantText(input),
      locale,
    );
    if (chosen !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: chosen.text },
        endEvent(input.messageId),
      ];
    }
  }

  // Tepat setelah daftar jenis/ragam, pesan yang hanya menyebut keluarga lain tanpa aspek
  // ("kalau yang pvc?") meminta daftar jenis keluarga itu — bukan penjelasan bahannya (uji
  // pemilik 2026-10-09). Aturan konteks atas jawaban sebelumnya, bukan pola kalimat.
  if (
    previousRange(lastAssistantText(input)) !== null &&
    u.families.length > 0 &&
    u.productAspect === null &&
    // "kalau yang pvc?" dikenali mirip "pvc itu apa?" (product_concept) — tepat setelah daftar
    // jenis, menyebut keluarga lain berarti meminta jenisnya; perbandingan tetap jalurnya sendiri.
    u.intent?.label !== 'product_comparison'
  ) {
    const range = await familyRange(catalog, u.families, locale, null, input.message);
    if (range !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: range.text },
        endEvent(input.messageId),
      ];
    }
  }

  // Lanjutan atas jawaban JENIS keluarga: "boleh" menerima tawaran rincian ukuran; "yang telkom"
  // memilih satu jenis. Dulu "boleh" dijawab penjelasan bahan HDPE (laporan pemilik 2026-10-09).
  // Pesan yang menyebut produk atau kebutuhan baru membawa topik baru — tidak dicegat di sini.
  if (
    previousRange(lastAssistantText(input)) === 'family' &&
    u.families.length === 0 &&
    !u.mentionsRequirement &&
    input.subject?.kind === 'product'
  ) {
    const sizes = await familySizes(
      catalog,
      input.lexicon.productFamilies(input.subject.entity),
      input.message,
      isFollowUp(u) || isChoiceFollowUp(u),
      lastAssistantText(input),
      locale,
    );
    if (sizes !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: sizes.text },
        endEvent(input.messageId),
      ];
    }
  }

  const asTable = reformatted(input, locale);
  if (asTable !== null) {
    return [
      { type: 'message.start', messageId: input.messageId },
      { type: 'token', text: asTable },
      endEvent(input.messageId),
    ];
  }

  // Pengetahuan umum pipa (P30-01): pertanyaan teknik pemipaan yang tidak punya topik di data.
  // Sebelum ini, pertanyaan seperti "apa itu thrust block?" atau "apa bedanya pipa tekan dan non
  // tekan?" memanggil pemeta pertanyaan (19–31 detik di CPU) lalu dijawab ikhtisar seluruh
  // katalog — jawaban yang tidak ada hubungannya dengan yang ditanya (audit 2026-10-26).
  // Didahulukan dari pemeta itu justru supaya panggilan model yang sia-sia itu tidak terjadi.
  if (knowledge !== null && asksGeneralKnowledge(u)) {
    const general = await knowledge.answer({
      message: input.message,
      recentTurns: input.recentTurns ?? [],
      locale,
    });
    if (general !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: general },
        endEvent(input.messageId),
      ];
    }
  }

  // Model pemeta pertanyaan hanya dipanggil bila pemahaman dari contoh tidak cukup: lanjutan subjek
  // sudah tahu produknya; keluarga produk yang tersurat dibaca kosakata; aspeknya dari contoh; dan
  // pertanyaan pengetahuan tanpa keluarga produk ("pipa buat air panas pake apa?") sudah terjawab
  // dari pengetahuan milik kode. Di CPU, satu panggilan model ±1 menit (uji proaktif 2026-10-07).
  const continued = subjectQuery(input);
  const named = productQueryOf(u, input.lexicon);
  const knowledgeOnly = named === null && u.knowledgeTopics.length > 0;
  // "standarnya apa?" / "ukurannya apa aja?" saat subjeknya HDPE: aspek dari contoh, produknya
  // dari subjek — bukan "Produk mana yang Anda maksud?" setelah satu menit model (tinjauan
  // 2026-10-08). Ragam produk ("produk Pralon apa aja?") pun sudah diputuskan intent-nya.
  const fromSubject =
    u.productAspect !== null && input.subject?.kind === 'product' ? input.subject.entity : null;
  // Keluarga yang disebut tetapi bukan produk katalog (galvanis) juga sudah menjawab "produk apa" —
  // pengetahuannya dijawab kode; model pemeta hanya menambah 40 detik (audit live 2026-10-08).
  const settled =
    continued !== null ||
    named !== null ||
    u.families.length > 0 ||
    knowledgeOnly ||
    fromSubject !== null ||
    u.intent?.label === 'product_range' ||
    // Pertanyaan pengetahuan tak tercakup sudah diputuskan: memetakannya ke produk + aspek tidak
    // menambah apa pun selain 19–31 detik (audit 2026-10-26).
    asksGeneralKnowledge(u);
  let parsed: ProductQuestionParse | null = null;
  if (!settled) {
    try {
      parsed = await ai.parseProductQuestion(input.message);
    } catch (error) {
      if (!(error instanceof AiOutputInvalidError)) throw error;
      parsed = null;
    }
  }
  const query = continued ?? named ?? fromSubject ?? parsed?.productQuery ?? null;
  // Lanjutan ("lebih detail dong") memperdalam penjelasan konsep; aspek hanya dari pesan nyata —
  // dan tidak pernah dari pertanyaan konsep ("apa bedanya fitting sama HDPE?"), apa pun kata model.
  const conceptual = isConceptual(u.intent?.label);
  // Dimensi tanpa jenis pipa yang dijawab ukuran nominal (di atas) tidak menjadi aspek spesifikasi.
  const askedAspect =
    (u.productAspect === 'dimensions' ? null : u.productAspect) ?? parsed?.aspect ?? null;
  // Ukuran di pesan berlaku untuk aspek apa pun (parser nilai terstruktur): "what pressure class for
  // 110 mm?" dulu kehilangan 110 mm dan dijawab PN satu produk 160 mm (audit campuran 2026-10-20).
  // Ketersediaan ukuran tanpa angka → daftar ukuran.
  const size = parsed?.size ?? parseSize(input.message);
  // Pertanyaan RAGAM ("HDPE jenisnya apa aja?") tidak pernah menjadi pertanyaan spesifikasi:
  // "jenis" sempat terbaca aspek ukuran dan dijawab ukuran satu produk (live 2026-10-09).
  const asksRange = u.intent?.label === 'product_range';
  const aspect =
    continued !== null || conceptual || asksRange
      ? null
      : askedAspect === 'size_availability' && size === null
        ? 'sizes'
        : askedAspect;

  // Keluarga yang ditanya: dari pesan, atau dari subjek produk untuk lanjutan tanpa bahan ("kalau
  // yang 3 inch ada?" setelah ukuran PVC AW) — satu keluarga saja, selain itu jalur produk.
  const askedFamilies = u.families.length > 0 ? u.families : subjectFamilies;
  const oneFamily = askedFamilies.length === 1 ? askedFamilies[0]! : null;

  // "pipa pvc aw ada ukuran apa saja?" — ukuran seluruh keluarga dari katalog, bukan ukuran satu
  // produk teratas (QA smoke 2026-10-14: dijawab "…AW - Lon 4\" x 4 Meter: 4\"").
  // "pvc aw paling kecil berapa?" dijawab satu ukuran, bukan seluruh daftar: terkecil/terbesar
  // dibaca katalog contoh `extreme` (P31-01), bukan lagi perencana giliran yang memanggil model.
  if (aspect === 'sizes' && continued === null && u.families.length === 1) {
    const family = await catalogFamily(catalog, u.families[0]!);
    const sizes =
      family === null ? null : await familySizeAnswer(catalog, family, null, u.extreme, locale);
    if (sizes !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: sizes.text },
        ...sizes.cards.map((card) => ({ type: 'card', card }) as AssistantStreamEvent),
        endEvent(input.messageId),
      ];
    }
  }

  // "pvc d 4 inch ada?" / "pipa pvc aw 7 inch ada?": ketersediaan ukuran dalam SATU keluarga katalog —
  // beberapa produk berukuran itu, atau "tidak ada" beserta ukuran yang tersedia. Dulu satu produk
  // sembarang ("Pipa ... Lon 4\" tidak tersedia dalam ukuran 7\"", simulasi 2026-10-19).
  if (aspect === 'size_availability' && size !== null && continued === null && oneFamily !== null) {
    const family = await catalogFamily(catalog, oneFamily);
    const sized =
      family === null ? null : await familySizeAvailability(catalog, family, size, locale);
    if (sized !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: sized.text },
        ...sized.cards.map((card) => ({ type: 'card', card }) as AssistantStreamEvent),
        endEvent(input.messageId),
      ];
    }
  }

  // "what pressure class for 110 mm?" atas HDPE: SEMUA kelas yang tertulis di produk keluarga itu
  // berukuran 110 mm — bukan kelas satu produk yang kebetulan teratas.
  if (aspect === 'pressure_class' && size !== null && continued === null && oneFamily !== null) {
    const family = await catalogFamily(catalog, oneFamily);
    const classes =
      family === null ? null : await familyClassesAtSize(catalog, family, size, locale);
    if (classes !== null) {
      return [
        { type: 'message.start', messageId: input.messageId },
        { type: 'token', text: classes.text },
        ...classes.cards.map((card) => ({ type: 'card', card }) as AssistantStreamEvent),
        endEvent(input.messageId),
      ];
    }
  }

  const outcome =
    aspect === null
      ? await answerConcept(catalog, input, query, reply, faqPrompt)
      : await answerSpec(
          catalog,
          questions,
          query,
          aspect,
          size,
          locale,
          aliasesFrom(input.lexicon),
          (term) => displayNameOf(term, input.lexicon),
        );

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
  const u = input.understanding;

  // Pertanyaan pengetahuan yang tidak tercakup data dan tidak terjawab jalur pengetahuan umum
  // (mati, gagal, atau tidak lolos pagar): katakan apa adanya (P30-04). Sampai di sini pertanyaan
  // seperti "jarak klem pipa tegak berapa?" dijawab ikhtisar seluruh katalog atau contoh produk
  // PVC sembarang — keduanya bukan jawaban, dan keduanya terbaca seperti tidak menyimak.
  // Jalur umum sudah mendapat kesempatannya di `runProductQuestion` sebelum ini.
  if (asksGeneralKnowledge(u)) {
    // Kasus yang solusinya sudah dihitung bukan "tanpa acuan": jalur solusinya sendiri acuan
    // yang paling dekat dengan pertanyaannya (produksi 2026-10-26).
    const drainageOnly =
      u.knowledgeTopics.length > 0 && u.knowledgeTopics.every((t) => DRAINAGE_TOPICS.has(t));
    const runs =
      input.solution && !input.solution.stale
        ? runsReply(input.solution, locale, drainageOnly)
        : null;
    if (runs !== null) return { text: runs, cards: [] };
    return { text: COPY.noSourcedAnswer, cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }] };
  }

  const asksRange = u.intent?.label === 'product_range';
  // "Produk Pralon yang terkenal apa?" — ragam, bukan satu bahan. Diputuskan dari pesannya,
  // SEBELUM parse model: 7B pernah menjawab pertanyaan ini dengan productQuery "PVC".
  if (asksRange && u.families.length === 0) return rangeOverview(catalog, locale);
  // "HDPE di Pralon jenisnya apa aja?" — jenis dalam keluarga itu, dari katalog. Tanpa katalog
  // Pralon (atau keluarganya tidak ada di katalog): jalur penjelasan bahan di bawah.
  if (asksRange) {
    const range = await familyRange(catalog, u.families, locale, null, input.message);
    if (range !== null) return range;
  }

  // Bahan yang dibicarakan: dari pesan, dari query (subjek/model), dan — untuk perbandingan —
  // dari subjek aktif: "bedanya sama pipa AW?" saat subjeknya HDPE membandingkan keduanya, bukan
  // menjelaskan AW sendirian.
  const comparison = u.intent?.label === 'product_comparison';
  const subjectEntity = input.subject?.kind === 'product' ? input.subject.entity : '';
  const messageFamilies = [...u.families, ...input.lexicon.productFamilies(query ?? '')];
  const subjectFamilies = input.lexicon.productFamilies(subjectEntity);
  const named = materialsFor(messageFamilies);
  const fromSubject = materialsFor(subjectFamilies);
  // "apa bedanya fitting sama HDPE?" sudah menyebut KEDUA hal yang dibandingkan (komponen + bahan):
  // subjek sebelumnya (mis. PVC vs HDPE) tidak ditarik masuk — verifikasi live 2026-10-08.
  const comparesConcept = u.knowledgeTopics.includes('fitting');
  // Hanya bila pesan menyebut SATU keluarga: "pvc aw sama pvc d bedanya apa?" menyebut dua (satu
  // bahan) dan sudah lengkap sendiri — subjek HDPE sebelumnya tidak boleh ikut (audit 2026-10-08).
  const comparedWithSubject =
    comparison &&
    !comparesConcept &&
    u.families.length === 1 &&
    named.length === 1 &&
    fromSubject.some((m) => !named.includes(m));
  // Bahan subjek hanya ikut saat dibandingkan; pertanyaan pengetahuan tanpa bahan ("pipa buat air
  // panas pake apa?") dijawab topiknya, bukan perbandingan ulang bahan yang kebetulan sedang dibahas
  // (verifikasi live 2026-10-08). Lanjutan sudah membawa entitas subjek lewat `query`.
  const families = comparedWithSubject ? [...messageFamilies, ...subjectFamilies] : messageFamilies;
  // Topik dibaca dari pesan DAN subjek: lanjutan atas jawaban "fitting vs HDPE" tetap tentang
  // fitting (topik subjek); konsep yang terikat keluarga produk (kelas PVC) ikut lewat `families`.
  const topics = [
    ...u.knowledgeTopics,
    ...(input.subject?.topic === FITTING_VS_MATERIAL ? ['fitting'] : []),
  ];
  // Pertanyaan TOPIK (cara sambung, penyimpanan, gangguan, istilah) dijawab topiknya saja: tanpa
  // ikhtisar bahan, tanpa produk katalog, tanpa penutup soal produk — dulu jawabannya 3–4 kali
  // lebih panjang dari yang ditanya (audit keterbacaan 2026-10-08).
  const topicOnly = topics.length > 0 && !isConceptual(u.intent?.label) && !comparison;
  const knowledge = withoutRepeating(
    explain(
      { families, topics, comparison, aboutMaterial: isConceptual(u.intent?.label), topicOnly },
      locale,
    ),
    input,
  );
  // Katalog opsional: kegagalan membacanya tidak boleh mengubah penjelasan teknik.
  const support =
    query === null || (topicOnly && knowledge !== '')
      ? NO_SUPPORT
      : await lookup(catalog, query, {
          optional: true,
          aliases: aliasesFrom(input.lexicon),
          representative: (term) => input.lexicon.representativeFamily?.(term) ?? null,
        });

  // Pendukung dari katalog HANYA bila otoritatif. Dari katalog contoh: tidak ada kartu,
  // tidak ada "tidak ada di katalog Pralon" — hanya ajakan ke tim teknis.
  const facts: string[] = [];
  const cards: AssistantCard[] = [];
  const missing = support.missing.map((m) => displayNameOf(m, input.lexicon)).join(', ');
  // "pipa ppr pralon ada?" bertanya KETERSEDIAAN di Pralon: jawabannya dulu, penjelasan bahan
  // sesudahnya (audit 2026-10-19: dulu kalimat "tidak ada" baru muncul di paragraf terakhir).
  const availabilityFirst = support.authoritative && missing !== '' && u.mentionsOwnBrand;
  if (support.authoritative) {
    if (missing !== '' && !availabilityFirst) facts.push(COPY.notInCatalog(missing));
    if (support.products.length > 0) {
      // Prosa katalog hanya untuk produk yang DESKRIPSInya berisi — di situ katalog benar-benar
      // menjelaskan sesuatu ("Pipa PVC AW: Pipa untuk air bersih…"). Produk tanpa deskripsi
      // merosot jadi nama plus materialnya ("Pipa HDPE PE 100 PN-12.5 20 mm x 270 Meter. Material
      // HDPE."), yang sudah ada di kartunya dan di bawah penjelasan penerapan HDPE terbaca
      // seperti tempelan mesin (pemilik 2026-10-26).
      const described = support.products.filter((p) => p.description.trim() !== '');
      if (described.length > 0) {
        facts.push(COPY.catalogSupport);
        facts.push(described.map((p) => overviewText(p, locale)).join('\n\n'));
      }
      cards.push({ kind: 'product', products: support.products.map(toCard) });
    }
    if (support.missing.length > 0) cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  } else if (!(topicOnly && knowledge !== '')) {
    // Penutup: bila pengguna bertanya tentang Pralon-nya ("HDPE di Pralon ok nggak?"), katakan
    // MENGAPA belum bisa dijawab; dan jangan ulangi kalimat yang persis sama tiap giliran.
    // Bahan yang memang bukan produk Pralon (galvanis) tidak dicari ke katalog — itu bukan "katalog
    // belum terpasang" (simulasi 2026-10-19: "pralon jual pipa galvanis?" dijawab begitu).
    const notPralon =
      u.families.length > 0 && u.families.every((f) => !input.lexicon.isCatalogFamily(f));
    const closing = notPralon
      ? COPY.notPralonProduct(materialsFor(u.families)[0]?.label ?? u.families.join(', '))
      : query !== null && /\bpralon\b/i.test(input.message)
        ? COPY.catalogNotInstalledShort
        : COPY.askTechnicalForProducts;
    if (!lastAssistantText(input).includes(closing)) facts.push(closing);
    cards.push({ kind: 'cta', action: 'CONTACT_TECHNICAL' });
  }

  if (knowledge === '' && support.products.length === 0) {
    // Pertanyaan produk tanpa produk yang disebut ("PT Pralon produknya apa aja?") adalah
    // pertanyaan tentang RAGAM: jawab dengan keluarga produknya, lalu tawarkan rincian. Dulu
    // dibalas "Produk mana yang Anda maksud?" — pengguna disuruh menjawab pertanyaannya sendiri
    // (laporan pemilik 2026-10-08). Nama yang disebut tetapi tidak ada di katalog Pralon
    // dikatakan dulu, lalu ragam yang memang ada.
    const range = await rangeOverview(catalog, locale);
    if (!support.authoritative || support.missing.length === 0) return range;
    return {
      ...range,
      text: `${COPY.notInCatalog(missing)}\n\n${range.text}`,
    };
  }

  const data = [availabilityFirst ? COPY.notInCatalog(missing) : '', knowledge, ...facts]
    .filter((part) => part !== '')
    .join('\n\n');
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
  if (isFollowUp(input.understanding) || input.understanding.depth !== null) return knowledge;
  const turns = input.recentTurns ?? [];
  const lastAssistant = lastAssistantText(input);
  const lastUser = [...turns].reverse().find((t) => t.role === 'user')?.text ?? '';
  const opening = knowledge.split('\n')[0] ?? '';
  const repeated = opening !== '' && lastAssistant.includes(opening);
  const sameQuestion = normalize(lastUser) === normalize(input.message);
  if (!repeated || sameQuestion) return knowledge;
  const materials = materialsFor(input.understanding.families).slice(0, 2);
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
 * separuh jumlah butirnya — dan membawa penekanan tebal. Bila dirangkai sebagai tabel, tulisannya
 * harus tetap tabel dengan minimal separuh barisnya. Teks tanpa struktur → teks deterministik.
 */
export function keepsStructure(written: string, knowledge: string): boolean {
  const rows = (s: string) => (s.match(/^\s*\|.*\|\s*$/gm) ?? []).length;
  const tableRows = rows(knowledge);
  if (tableRows > 0 && rows(written) * 2 < tableRows) return false;
  const items = (s: string) => (s.match(/^\s*(?:[-*]|\d+\.)\s/gm) ?? []).length;
  const expected = items(knowledge);
  if (expected === 0) return true;
  return items(written) * 2 >= expected && written.includes('**');
}

// ── Jalur SPESIFIKASI ───────────────────────────────────────────────────────

async function answerSpec(
  catalog: ProductCatalog,
  questions: Pick<ProductQuestionService, 'answer'>,
  query: string | null,
  aspect: NonNullable<Awaited<ReturnType<AiService['parseProductQuestion']>>['aspect']>,
  rawSize: string | null,
  locale: Locale = DEFAULT_LOCALE,
  aliases: Aliases = NO_ALIASES,
  display: (term: string) => string = (term) => term,
): Promise<Outcome> {
  const COPY = productAnswerCopy(locale);
  // Aspek tanpa produk ("ukurannya apa aja?" di awal percakapan): tunjukkan ragamnya dulu,
  // bukan bertanya balik.
  if (query === null) return rangeOverview(catalog, locale);

  const support = await lookup(catalog, query, { optional: false, aliases, size: rawSize });
  if (support.unavailable) {
    return {
      text: COPY.catalogUnavailable,
      cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }],
    };
  }

  const notFound = (names: string) => {
    const shown = names
      .split(', ')
      .map((n) => display(n))
      .join(', ');
    return support.authoritative ? COPY.notInCatalog(shown) : COPY.notInInstalledCatalog(shown);
  };

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
  {
    optional,
    aliases = NO_ALIASES,
    size = null,
    representative = () => null,
  }: {
    readonly optional: boolean;
    readonly aliases?: Aliases;
    readonly size?: string | null;
    readonly representative?: (term: string) => string | null;
  },
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
    // Bahan tanpa ukuran ("pvc", "hdpe"): wakilnya pipa terkecil dari keluarga katalog yang mewakili
    // bahan itu, bukan hasil pencarian nama yang urutannya sembarang.
    const family = size === null ? representative(term) : null;
    if (family !== null) {
      const own = await catalog.listProducts({ family, status: 'active', limit: 50 });
      const pick = smallestFirst(own.items.filter(isAnswerable))[0];
      if (pick) {
        if (!products.some((f) => f.id === pick.id)) products.push(pick);
        continue;
      }
    }
    const page = await catalog.listProducts({ q: term, limit: 10 });
    let candidates = page.items.filter(isAnswerable);
    // Istilah gabungan "elbow hdpe" jarang muncul utuh di nama produk ("Elbow 90° HDPE 63 mm"):
    // cari kata pertamanya, lalu saring yang memuat kata-kata sisanya di nama/keluarga/kategori
    // (audit live 2026-10-08: "elbow hdpe 63 ada?" → "tidak ada di katalog").
    // Nama katalog memakai sinonimnya sendiri: elbow HDPE Pralon bernama "Bend (Segmented) 90º PE
    // 63 mm". Setiap alias kata pertama (kosakata) dicoba, hasilnya disaring kata-kata sisanya.
    const words = term.split(/\s+/);
    if (candidates.length === 0 && words.length > 1) {
      const rest = words.slice(1).map((w) => w.toLowerCase());
      for (const alias of [words[0]!, ...aliases(words[0]!)]) {
        const wider = await catalog.listProducts({ q: alias, limit: 50 });
        candidates = wider.items.filter(isAnswerable).filter((p) => {
          const haystack = `${p.name} ${p.family} ${p.category}`.toLowerCase();
          return rest.every((w) => haystack.includes(w));
        });
        if (candidates.length > 0) break;
      }
    }
    // Pertanyaan ketersediaan ukuran: produk yang memang berukuran itu yang mewakili istilahnya —
    // bukan wakil sembarang lalu "tidak tersedia dalam ukuran 3/4" (audit live 2026-10-08).
    const sized = size === null ? [] : candidates.filter((p) => hasSize(p, size));
    const product = bestMatch(sized.length > 0 ? sized : candidates, term);
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
/** Contoh produk yang ditampilkan untuk satu ukuran dalam satu keluarga. */
const SIZE_EXAMPLES = 6;

/** Ada/tidaknya satu ukuran dalam satu keluarga katalog; `null` bila ukurannya tidak terbaca. */
async function familySizeAvailability(
  catalog: ProductCatalog,
  family: string,
  rawSize: string,
  locale: Locale,
): Promise<Outcome | null> {
  const size = PipeSize.parse(rawSize);
  if (size === null) return null;
  const en = locale === 'en';
  const page = await catalog.listProducts({ family, status: 'active', size, limit: 50 });
  const found = page.items.filter(isAnswerable).slice(0, SIZE_EXAMPLES);
  if (found.length > 0) {
    return {
      text: [
        en
          ? `Yes. ${family} ${size} in the Pralon catalogue, for example:`
          : `Ada. ${family} ${size} di katalog Pralon, contohnya:`,
        '',
        ...found.map((p) => `- ${p.name}`),
      ].join('\n'),
      cards: [{ kind: 'product', products: found.map(toCard) }],
    };
  }
  const range = await familySizeAnswer(catalog, family, null, null, locale);
  const absent = en
    ? `${family} ${size} is not in the Pralon catalogue.`
    : `${family} ${size} tidak ada di katalog Pralon.`;
  return {
    text: range === null ? absent : `${absent}\n\n${range.text}`,
    cards: [{ kind: 'cta', action: 'CONTACT_TECHNICAL' }],
  };
}

/** Batas halaman yang dibaca untuk satu ukuran dalam satu keluarga (HDPE 110 mm ±100 produk). */
const CLASS_PAGES = 6;

/**
 * Kelas tekanan yang tertulis di nama produk satu keluarga pada satu ukuran ("PN-6, PN-8, …"); tidak
 * ada produk berukuran itu → "tidak ada" beserta ukuran yang tersedia. `null` bila ukurannya tidak
 * terbaca atau produknya tidak menulis kelas (pemanggil memakai jalur spesifikasi).
 */
async function familyClassesAtSize(
  catalog: ProductCatalog,
  family: string,
  rawSize: string,
  locale: Locale,
): Promise<Outcome | null> {
  const size = PipeSize.parse(rawSize);
  if (size === null) return null;
  const en = locale === 'en';
  const found: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < CLASS_PAGES; page++) {
    const result = await catalog.listProducts({
      family,
      status: 'active',
      size,
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });
    found.push(...result.items.filter(isAnswerable));
    if (result.nextCursor === null) break;
    cursor = result.nextCursor;
  }
  if (found.length === 0) return familySizeAvailability(catalog, family, rawSize, locale);
  const classes = designationsOf(found.map((p) => p.name));
  if (classes.length === 0) return null;
  const examples = classes
    .map((c) => found.find((p) => p.name.includes(c)))
    .filter((p): p is Product => p !== undefined)
    .slice(0, SIZE_EXAMPLES);
  return {
    text: en
      ? `${family} ${size} in the Pralon catalogue comes in classes ${classes.join(', ')}. The class to pick depends on the line's working pressure plus room for pressure surges.`
      : `${family} ${size} di katalog Pralon tersedia kelas ${classes.join(', ')}. Kelas yang dipilih mengikuti tekanan kerja jalurnya ditambah ruang untuk lonjakan tekanan.`,
    cards: examples.length > 0 ? [{ kind: 'product', products: examples.map(toCard) }] : [],
  };
}

/** Produk urut ukuran pertamanya, terkecil dulu; yang tanpa ukuran di belakang. */
function smallestFirst(items: readonly Product[]): Product[] {
  const sizeOf = (p: Product) => (p.sizes[0] ? PipeSize.parse(p.sizes[0]) : null);
  return [...items].sort((a, b) => {
    const x = sizeOf(a);
    const y = sizeOf(b);
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    // Satuan berbeda tidak dibandingkan (PipeSize.compare melempar): inci dulu, lalu mm.
    if (x.unit !== y.unit) return x.unit === 'in' ? -1 : 1;
    return x.valueX1000 - y.valueX1000;
  });
}

/** Produk berukuran `size` — dari daftar ukurannya, atau dari namanya bila daftar ukuran kosong. */
function hasSize(product: Product, size: string): boolean {
  const wanted = PipeSize.parse(size);
  if (wanted === null) return false;
  if (product.sizes.some((s) => PipeSize.parse(s)?.equals(wanted) ?? false)) return true;
  const label = size.toLowerCase().replace(/s+/g, ' ');
  return product.name.toLowerCase().includes(label);
}

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

/**
 * Giliran berlingkup fitting: hanya atas katalog Pralon resmi, dan hanya bila lingkupnya memuat
 * keluarga FITTING. Subjek aktif dipakai sebagai lingkup bila pesan tidak menyebut keluarga apa
 * pun tetapi menyebut ukuran atau jenis fitting ("kalau ukuran 110 mm?").
 */
async function fittingTurn(
  catalog: ProductCatalog,
  input: ProductQuestionInput,
  locale: Locale,
): Promise<FittingOutcome | null> {
  const u = input.understanding;
  let families: string[];
  try {
    if (!isAuthoritative(await catalog.activeVersion())) return null;
    families = (await catalog.familyCounts()).map((f) => f.family);
  } catch {
    return null;
  }
  const ownKinds = u.families.filter((f) => input.lexicon.isFittingFamily(f));
  // Jenis fitting baru tanpa ukuran atas subjek bersize ("and a tee in the same size?" setelah
  // elbow 2"): ukurannya ukuran subjek. Permintaan daftar ukuran ("tee ukuran apa aja?") tidak.
  // Subjek hanya menyimpan nama ("elbow pvc"), jadi ukurannya dibaca dari pesan pengguna terakhir
  // yang menyebut ukuran.
  const subjectSize =
    ownKinds.length > 0 && input.subject?.kind === 'product' && u.productAspect !== 'sizes'
      ? ([...(input.recentTurns ?? [])]
          .reverse()
          .filter((t) => t.role === 'user')
          .map((t) => parseSize(t.text))
          .find((s) => s !== null) ?? null)
      : null;
  const size = parseSize(input.message) ?? subjectSize;
  const subjectEntity =
    input.subject?.kind === 'product' &&
    (size !== null || ownKinds.length > 0) &&
    u.families.every((f) => input.lexicon.isFittingFamily(f))
      ? input.subject.entity
      : null;
  // "kalau yang 3/4?" setelah tee PVC: jenisnya dari subjek — tanpa ini semua fitting PVC 3/4" ikut.
  const kinds =
    ownKinds.length > 0 || subjectEntity === null
      ? ownKinds
      : input.lexicon
          .productFamilies(subjectEntity)
          .filter((f) => input.lexicon.isFittingFamily(f));
  const ownMaterials = u.families.filter((f) => !input.lexicon.isFittingFamily(f));
  const materials =
    ownMaterials.length > 0 || subjectEntity === null
      ? ownMaterials
      : input.lexicon
          .productFamilies(subjectEntity)
          .filter((f) => !input.lexicon.isFittingFamily(f));
  const scope = fittingScope(
    catalogScope(input.message, subjectEntity, families),
    kinds,
    materials,
    families,
  );
  if (scope.length === 0) return null;
  const kindTerms = kinds.flatMap((k) => [k, ...input.lexicon.aliasesOf(k)]);
  return fittingAnswer(catalog, scope, {
    message: input.message,
    kindTerms: [...new Set(kindTerms)],
    size,
    locale,
    listSizes:
      u.productAspect === 'sizes' || (u.productAspect === 'size_availability' && size === null),
  });
}

/** Nama keluarga katalog untuk keluarga kosakata ("pvc aw" → "PVC AW"); katalog tak terbaca → null. */
async function catalogFamily(catalog: ProductCatalog, family: string): Promise<string | null> {
  try {
    const counts = await catalog.familyCounts();
    return counts.find((c) => c.family.toLowerCase() === family.toLowerCase())?.family ?? null;
  } catch (error) {
    if (error instanceof CatalogUnavailableError) return null;
    throw error;
  }
}
