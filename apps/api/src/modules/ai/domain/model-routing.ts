/**
 * Routing model — **fungsi murni**. docs/AI_BEHAVIOR.md.
 *
 * ID model tidak pernah ditulis di kode: routing memetakan *tugas* ke *tingkat*
 * (`fast`/`balanced`/`strong`), dan tingkat dipetakan ke ID lewat env di tepi.
 * Karena murni, routing bisa diuji dan perubahannya muncul di hasil evaluasi —
 * bukan tersembunyi di dalam adapter.
 */

export type LlmTier = 'fast' | 'balanced' | 'strong';

/**
 * Tugas LLM yang dikenal sistem. Perhitungan teknik SENGAJA tidak ada di sini:
 * ia tidak pernah memanggil model (SPEC §25), jadi tidak punya tingkat.
 */
export type LlmTask =
  | 'product_faq'
  | 'conversation_title'
  | 'product_answer'
  | 'extraction'
  | 'clarification_phrasing'
  | 'intent_classification'
  | 'product_question'
  | 'explanation_prose'
  | 'ambiguous_input'
  | 'extraction_retry'
  | 'turn_planning';

/**
 * Tabel routing (docs/AI_BEHAVIOR.md). Percobaan ulang setelah validasi gagal dan
 * masukan ambigu naik ke `strong` — di situlah kemampuan ekstra berbayar sepadan.
 */
const ROUTING: Readonly<Record<LlmTask, LlmTier>> = {
  product_faq: 'fast',
  conversation_title: 'fast',
  product_answer: 'balanced',
  extraction: 'balanced',
  clarification_phrasing: 'balanced',
  intent_classification: 'balanced',
  /** Memetakan "ada ukuran 3/4?" ke produk + aspek — tugas kecil, kosakata tertutup. */
  product_question: 'fast',
  explanation_prose: 'balanced',
  ambiguous_input: 'strong',
  extraction_retry: 'strong',
  /** Perencana giliran (P16-29): JSON pendek dengan daftar tertutup — model tercepat cukup. */
  turn_planning: 'fast',
};

export function tierForTask(task: LlmTask): LlmTier {
  return ROUTING[task];
}

/** Peta tingkat → variabel env ID model. Dipakai adapter, bukan domain. */
export const TIER_ENV_KEY: Readonly<Record<LlmTier, string>> = {
  fast: 'LLM_MODEL_FAST',
  balanced: 'LLM_MODEL_BALANCED',
  strong: 'LLM_MODEL_STRONG',
};
