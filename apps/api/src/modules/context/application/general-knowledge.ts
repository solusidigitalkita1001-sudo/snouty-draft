/**
 * Jawaban PENGETAHUAN UMUM pipa — pertanyaan teknik pemipaan yang tidak tercakup fakta
 * bersumber (`data/knowledge/pipe-facts.json`) maupun konsep di `pipe-knowledge.ts`.
 * P30-01, keputusan pemilik 2026-10-26.
 *
 * Mengapa jalur ini ada: pengetahuan pipa SNOUTY ditulis tangan satu topik demi satu topik,
 * sementara pertanyaan pengguna tidak terbatas. Audit 2026-10-26 — 25 pertanyaan pipa yang
 * wajar, 7 terjawab; sembilan di antaranya tidak punya topik sama sekali dan dijawab ikhtisar
 * katalog ("Katalog Pralon memuat 7.664 produk…") setelah menunggu 19–31 detik.
 *
 * Pembagian kerjanya tetap sama dengan jalur lain: **model menjawab, kode memeriksa**. Yang
 * berbeda hanya satu, dan ini disengaja — di sini tidak ada blok DATA, jadi angka tidak
 * dibandingkan dengan DATA. Gantinya tiga pagar yang tidak bergantung pada kepatuhan model:
 *
 *   1. jawaban tidak boleh menyebut Pralon — klaim tentang Pralon hanya boleh lahir dari
 *      katalog dan fakta bersumber, yang ditempelkan pemanggil;
 *   2. merek lain tidak boleh muncul (POLICY.md §1);
 *   3. jawaban yang memuat angka atau penanda teknis membawa baris provenance: angkanya
 *      praktik umum, bukan spesifikasi Pralon;
 *   4. nomor standar yang disebut harus ada di daftar yang dipegang SNOUTY
 *      (`data/knowledge/standards.json`) — P31-88.
 *
 * Yang tidak pernah lewat sini: harga, ketersediaan produk, dan perhitungan teknik — ketiganya
 * punya jalurnya sendiri dan sudah dicegat sebelum pemanggil sampai ke mari (SPEC §25).
 */
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import {
  addsNoStructure,
  buildReplyContext,
  OTHER_BRANDS,
  technicalClaimsIn,
  withoutOpener,
  type ReplyTurn,
} from './reply-writer.js';
import { productAnswerCopy } from './product-answer-text.js';
import { unknownStandardIn } from '../domain/standard-citations.js';
import { knownStandards } from '../infrastructure/known-standards.js';

export interface GeneralKnowledgeAi {
  writeProse(input: {
    readonly systemPrompt: string;
    readonly userMessage: string;
    readonly timeoutMs?: number;
    readonly task?: 'general_knowledge';
  }): Promise<unknown>;
}

export interface GeneralKnowledgeInput {
  readonly message: string;
  readonly recentTurns: readonly ReplyTurn[];
  readonly locale: Locale;
}

/**
 * Jawaban pengetahuan umum terpanjang yang masih terbaca sebagai penjelasan teknisi. Lebih
 * panjang dari batas FAQ karena pertanyaan "apa itu X dan kapan dipakai" memang dua bagian;
 * lebih pendek dari laporan karena ini gelembung chat.
 */
const MAX_LENGTH = 1_400;

/** `null` = tidak ada jawaban yang lolos; pemanggil memakai jalurnya sendiri. */
export class GeneralKnowledgeWriter {
  constructor(
    private readonly ai: GeneralKnowledgeAi,
    private readonly systemPromptFor: (locale: Locale) => string,
    private readonly timeoutMs: number | undefined = undefined,
  ) {}

  async answer(input: GeneralKnowledgeInput): Promise<string | null> {
    let raw: unknown;
    try {
      raw = await this.ai.writeProse({
        systemPrompt: this.systemPromptFor(input.locale),
        userMessage: buildReplyContext({
          intent: 'PRODUCT_LOOKUP',
          userMessage: input.message,
          recentTurns: input.recentTurns,
          fallback: '',
          locale: input.locale,
        }),
        task: 'general_knowledge',
        ...(this.timeoutMs !== undefined ? { timeoutMs: this.timeoutMs } : {}),
      });
    } catch {
      return null;
    }
    return acceptedAnswer(raw, input.locale);
  }
}

/**
 * Keluaran model → jawaban siap tampil, atau `null`. Dipisah dari kelasnya supaya pagarnya
 * bisa diuji tanpa model sama sekali.
 */
export function acceptedAnswer(raw: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  const text = textOf(raw);
  if (text === null) return null;
  const cleaned = withoutOpener(text, '');
  if (cleaned.length > MAX_LENGTH) return null;
  if (!passesKnowledgeGuards(cleaned)) return null;
  // Angka yang disebut membawa provenance-nya; jawaban kualitatif tidak perlu baris tambahan.
  return technicalClaimsIn(cleaned).length > 0 || hasPlainFigure(cleaned)
    ? `${cleaned}\n\n${productAnswerCopy(locale).generalPractice}`
    : cleaned;
}

/**
 * Pagar atas keluaran model — empat larangan, semuanya di kode: aturan yang hanya ada di prompt
 * dianggap tidak ada (CLAUDE.md).
 */
export function passesKnowledgeGuards(
  text: string,
  known: ReadonlySet<string> = knownStandards(),
): boolean {
  if (OTHER_BRANDS.test(text)) return false;
  // Nomor standar yang tidak bisa dipertanggungjawabkan menjatuhkan seluruh jawaban, bukan
  // hanya kalimatnya: pembaca memakai nomor itu untuk mempercayai sisanya.
  if (unknownStandardIn(text, known) !== null) return false;
  // Tanpa DATA, tidak ada yang bisa membuktikan klaim tentang Pralon — jadi jalur ini tidak
  // pernah menyebutnya. Kalimat Pralon-nya ditempelkan pemanggil dari katalog.
  if (/\bpralon\b/i.test(text)) return false;
  // Prosa, bukan buku teks (P27-03). `addsNoStructure` dengan DATA kosong menolak judul,
  // tabel, daftar butir, dan baris yang seluruhnya tebal.
  return addsNoStructure(text, '');
}

/** Angka bersatuan sudah tertangkap `technicalClaimsIn`; ini menangkap "60 derajat", "2 persen". */
const PLAIN_FIGURE = /\b\d+(?:[.,]\d+)?\s*(?:derajat|persen|percent|degrees?|%)/i;

function hasPlainFigure(text: string): boolean {
  return PLAIN_FIGURE.test(text);
}

function textOf(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = (raw as { text?: unknown }).text;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
