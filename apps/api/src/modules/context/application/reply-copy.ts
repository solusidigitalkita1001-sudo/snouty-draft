/**
 * Balasan tetap untuk giliran yang TIDAK masuk ruas ekstraksi maupun lookup produk.
 *
 * Sebelum ini intent-intent tersebut menutup giliran tanpa sepatah kata — pengguna yang
 * menyapa atau bertanya "kenapa" melihat gelembungnya sendiri tanpa jawaban. Kalimat di
 * sini deterministik dan tidak memuat fakta teknis apa pun; dengan model aktif, LLM yang
 * akan menyapa dan bertanya balik secara wajar, tetapi kartunya tetap sama.
 *
 * Dua bahasa (Fase 15): teks hidup di kode per bahasa, bukan diterjemahkan model.
 */
import { DEFAULT_LOCALE, type Intent, type Locale } from '@snouty/shared-types';

export const REPLY_COPY = {
  /** Sapaan atau di luar topik perpipaan — arahkan, jangan diam. */
  OUT_OF_SCOPE:
    'Halo! Saya SNOUTY, asisten perencanaan pipa air bersih Pralon. Ceritakan bangunan dan kebutuhan airnya — misalnya jumlah lantai, kamar mandi, dan sumber airnya — atau tanyakan produk Pralon.',
  /** "Kenapa pipa utamanya 1 inci?" — dasar perhitungannya ada di solusi, bukan dikarang di sini. */
  EXPLANATION_REQUEST:
    'Dasar setiap angka ada di solusi: buka "Tampilkan detail teknis" untuk melihat aturan dan masukan yang dipakai. Bila ada yang terasa keliru, ubah kebutuhannya dan solusinya dihitung ulang.',
  /** Model ragu — bertanya lebih murah daripada mengubah kebutuhan yang tidak diminta. */
  CLARIFICATION_NEEDED:
    'Maaf, saya belum menangkap maksudnya. Bisa dijelaskan sedikit lebih rinci — apakah ini tentang kebutuhan bangunan Anda, atau tentang produk tertentu?',
} as const satisfies Partial<Record<Intent, string>>;

const REPLY_COPY_EN: Readonly<Record<RepliedIntent, string>> = {
  OUT_OF_SCOPE:
    'Hello! I am SNOUTY, the Pralon clean-water piping planning assistant. Tell me about your building and its water needs — for example the number of floors, bathrooms, and the water source — or ask about Pralon products.',
  EXPLANATION_REQUEST:
    'Every number in the solution has its basis: open "Show technical details" to see the rules and inputs used. If something looks off, change the requirement and the solution is recalculated.',
  CLARIFICATION_NEEDED:
    'Sorry, I did not quite catch that. Could you explain a little more — is this about your building needs, or about a specific product?',
};

/**
 * Pesan pembuka tanpa satu pun fakta kebutuhan ("mau nanya2 dong", "boleh tanya?") yang model
 * beri label pernyataan kebutuhan. Bukan intent tersendiri — ditentukan dari hasil ekstraksi
 * yang kosong — jadi tidak masuk `REPLY_COPY` yang berkunci intent.
 */
export const OPENER_REPLY =
  'Silakan, tanyakan saja. Saya bisa membantu merencanakan pipa untuk bangunan Anda — sebutkan jumlah lantai, kamar mandi, dan sumber airnya — atau menjawab pertanyaan tentang produk Pralon.';

const OPENER_REPLY_EN =
  'Go ahead and ask. I can help plan the piping for your building — tell me the number of floors, bathrooms, and the water source — or answer questions about Pralon products.';

export type RepliedIntent = keyof typeof REPLY_COPY;

export function replyFor(intent: Intent, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!(intent in REPLY_COPY)) return null;
  const key = intent as RepliedIntent;
  return locale === 'en' ? REPLY_COPY_EN[key] : REPLY_COPY[key];
}

export function openerReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? OPENER_REPLY_EN : OPENER_REPLY;
}

/**
 * Pesan yang dikenali DI LUAR urusan pipa ("cuaca hari ini gimana?", "bisa kirim ke bandung?"):
 * bukan sapaan, jadi pembuka "Halo! Saya SNOUTY…" terbaca seperti percakapan di-reset (audit live
 * 2026-10-08). Katakan batasnya, lalu tawarkan yang bisa dibantu.
 */
const OUT_OF_TOPIC_REPLY =
  'Itu di luar yang bisa saya bantu di sini — saya khusus soal pipa dan instalasi air Pralon. Untuk pengiriman, harga, atau urusan pesanan, tim Pralon yang bisa membantu. Kalau ada kebutuhan pipa atau pertanyaan produk, tinggal tulis.';

const OUT_OF_TOPIC_REPLY_EN =
  'That is outside what I can help with here — I cover Pralon pipes and water installations only. For delivery, pricing, or order matters, the Pralon team can help. If you have a piping need or a product question, just write it.';

export function outOfTopicReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? OUT_OF_TOPIC_REPLY_EN : OUT_OF_TOPIC_REPLY;
}
