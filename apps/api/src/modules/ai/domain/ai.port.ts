/**
 * Port layanan AI. docs/ARCHITECTURE.md §7 · docs/AI_BEHAVIOR.md.
 *
 * `ai` adalah **layanan, bukan pengambil keputusan**: ia tidak menyentuh domain dan
 * tidak pernah menghitung apa pun teknik (SPEC §25). Ia memahami bahasa dan
 * mengembalikan data terstruktur tervalidasi; apa yang dilakukan atas data itu
 * adalah urusan Context Engine dan Engineering Engine.
 *
 * Semua metode mengembalikan hasil yang SUDAH tervalidasi zod. Implementasi live
 * digerbang keberadaan `OPENROUTER_API_KEY`; tanpa kunci, port ini tidak terikat
 * dan pemanggil memilih jalur deterministik/klarifikasi.
 */

import type { Locale } from '@snouty/shared-types';
import type {
  Extraction,
  IntentClassification,
  ProductQuestionParse,
} from './extraction-schema.js';

export const AI_SERVICE = Symbol('AI_SERVICE');

export interface IntentInput {
  readonly message: string;
  /** Apakah percakapan sudah punya state terisi — membedakan statement vs mutation. */
  readonly hasExistingRequirements: boolean;
  /**
   * Giliran terakhir (tertua dulu) — supaya "yang mana?" setelah perbandingan bisa dibaca
   * sebagai lanjutan, bukan pesan lepas. Opsional: klasifikasi tetap sah tanpanya.
   */
  readonly recentTurns?: readonly { readonly role: 'user' | 'assistant'; readonly text: string }[];
}

export interface AiService {
  /**
   * Mengekstrak field kebutuhan dari pesan bebas. Mengembalikan objek tervalidasi
   * (field tak disebut = `undefined`). Melempar bila setelah satu percobaan ulang
   * keluaran tetap tidak valid — pemanggil lalu jatuh ke klarifikasi, tidak pernah
   * meneruskan keluaran mentah ke engine.
   */
  extract(message: string): Promise<Extraction>;

  classifyIntent(input: IntentInput): Promise<IntentClassification>;

  /**
   * Memetakan pertanyaan produk ke produk yang disebut + aspek tertutup. Faktanya TIDAK
   * dijawab di sini — `product-knowledge` menjawab dari katalog, nol LLM
   * (docs/PRODUCT_KNOWLEDGE.md §4).
   */
  parseProductQuestion(message: string): Promise<ProductQuestionParse>;

  /** Judul percakapan dari pesan pertama (tingkat cepat), dalam bahasa percakapan. */
  titleFor(firstMessage: string, locale?: Locale): Promise<string>;

  /**
   * Menulis prosa penjelas atas angka yang **sudah** dihitung engine.
   *
   * Satu-satunya metode yang mengembalikan keluaran **mentah dan belum tervalidasi**,
   * dan itu disengaja. Skema prosa milik pemanggil, dan pemeriksaan REC-1 — apakah
   * prosanya memuat angka yang tidak pernah dihitung — hanya bisa dilakukan oleh pihak
   * yang tahu angka mana yang sah. Modul ai tidak boleh tahu itu, sebab begitu ia tahu,
   * ia berhenti menjadi layanan dan mulai menilai kebenaran teknik (SPEC §25).
   *
   * Prompt dan pesan datang sebagai string buram supaya port ini tetap tidak menyentuh
   * domain: ia mengirimkannya, mencatat biayanya, dan tidak menafsirkan isinya.
   */
  writeProse(input: {
    readonly systemPrompt: string;
    readonly userMessage: string;
    /** Batas tunggu; lewat itu panggilan DIBATALKAN (bukan hanya ditinggal) dan melempar. */
    readonly timeoutMs?: number;
    /** Jenis tugas — menentukan tier model; baku `explanation_prose`. */
    readonly task?: 'explanation_prose' | 'turn_planning';
  }): Promise<unknown>;
}
