/**
 * Balasan sosial tanpa model (uji proaktif 2026-10-07): "ok makasih" dijawab model 7B 49 detik
 * — lalu jatuh ke teks pembuka "Halo! Saya SNOUTY…" yang salah tempat. Ucapan terima kasih,
 * persetujuan singkat, dan pamit tidak membawa isi; jawabannya tetap, cepat, dan tidak mengubah
 * state apa pun.
 *
 * Bentuk kalimatnya dikenali modul `understanding` dari contoh (data). Pagar di sini: pesan yang
 * menyebut produk atau kebutuhan membawa isi, apa pun bentuk sosialnya ("makasih, terus bedanya
 * sama pipa AW apa?" bukan ucapan terima kasih yang berdiri sendiri).
 */
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import { isSocial } from '../../understanding/domain/labels.js';

export type SocialKind = 'thanks' | 'ack' | 'bye' | 'complaint';

/** Jenis pesan sosial; `null` bila pesan membawa isi. */
export function socialKind(u: MessageUnderstanding): SocialKind | null {
  const intent = u.intent?.label;
  if (!isSocial(intent)) return null;
  if (u.families.length > 0 || u.mentionsRequirement || u.mentionsCompetitor) return null;
  return intent;
}

const COPY: Readonly<Record<Locale, Readonly<Record<SocialKind, string>>>> = {
  id: {
    thanks: 'Sama-sama. Kalau ada lagi yang mau ditanyakan, tinggal tulis di sini.',
    ack: 'Siap. Lanjutkan kapan saja — tanyakan produk, atau ceritakan kebutuhan pipanya.',
    bye: 'Sampai jumpa. Percakapan ini bisa dibuka lagi kapan saja.',
    // Keluhan bukan sapaan: jangan memperkenalkan diri lagi (laporan pemilik 2026-10-09: "dongo"
    // dijawab "Silakan, tanyakan saja…").
    complaint:
      'Maaf, jawaban saya tadi belum pas. Bagian mana yang keliru, atau apa yang sebenarnya Anda cari? Saya jawab ulang.',
  },
  en: {
    thanks: 'You are welcome. If anything else comes up, just write it here.',
    ack: 'Noted. Carry on whenever you like — ask about a product, or describe your piping needs.',
    bye: 'See you. You can reopen this conversation any time.',
    complaint:
      "Sorry, my last answer missed the mark. Which part was wrong, or what were you looking for? I'll answer again.",
  },
};

/** Teks balasan sosial, atau `null` bila pesan bukan pesan sosial. */
export function socialReply(
  u: MessageUnderstanding,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const kind = socialKind(u);
  return kind === null ? null : COPY[locale][kind];
}
