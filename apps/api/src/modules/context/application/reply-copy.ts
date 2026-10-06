/**
 * Balasan tetap untuk giliran yang TIDAK masuk ruas ekstraksi maupun lookup produk.
 *
 * Sebelum ini intent-intent tersebut menutup giliran tanpa sepatah kata — pengguna yang
 * menyapa atau bertanya "kenapa" melihat gelembungnya sendiri tanpa jawaban. Kalimat di
 * sini deterministik dan tidak memuat fakta teknis apa pun; dengan model aktif, LLM yang
 * akan menyapa dan bertanya balik secara wajar, tetapi kartunya tetap sama.
 */
import type { Intent } from '@snouty/shared-types';

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

/**
 * Pesan pembuka tanpa satu pun fakta kebutuhan ("mau nanya2 dong", "boleh tanya?") yang model
 * beri label pernyataan kebutuhan. Bukan intent tersendiri — ditentukan dari hasil ekstraksi
 * yang kosong — jadi tidak masuk `REPLY_COPY` yang berkunci intent.
 */
export const OPENER_REPLY =
  'Silakan, tanyakan saja. Saya bisa membantu merencanakan pipa untuk bangunan Anda — sebutkan jumlah lantai, kamar mandi, dan sumber airnya — atau menjawab pertanyaan tentang produk Pralon.';

export type RepliedIntent = keyof typeof REPLY_COPY;

export function replyFor(intent: Intent): string | null {
  return intent in REPLY_COPY ? REPLY_COPY[intent as RepliedIntent] : null;
}
