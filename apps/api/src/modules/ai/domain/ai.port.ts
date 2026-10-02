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

import type { Extraction, IntentClassification } from './extraction-schema.js';

export const AI_SERVICE = Symbol('AI_SERVICE');

export interface IntentInput {
  readonly message: string;
  /** Apakah percakapan sudah punya state terisi — membedakan statement vs mutation. */
  readonly hasExistingRequirements: boolean;
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

  /** Judul percakapan dari pesan pertama (tingkat cepat). */
  titleFor(firstMessage: string): Promise<string>;
}
