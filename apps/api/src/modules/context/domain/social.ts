/**
 * Balasan sosial tanpa model (uji proaktif 2026-10-07): "ok makasih" dijawab model 7B 49 detik
 * — lalu jatuh ke teks pembuka "Halo! Saya SNOUTY…" yang salah tempat. Ucapan terima kasih,
 * persetujuan singkat, dan pamit tidak membawa isi; jawabannya tetap, cepat, dan tidak mengubah
 * state apa pun.
 */
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';

type SocialKind = 'thanks' | 'ack' | 'bye';

const THANKS = /\b(makasih|makasi|terima kasih|trims|thanks?|thank you|thx|tq)\b/i;
const BYE = /\b(bye|dadah|sampai jumpa|selamat tinggal|see you|good ?bye|pamit)\b/i;
/** Seluruh kata adalah persetujuan/pengisi: "ok", "oke sip", "siap", "noted", "baik". */
const ACK_WORDS = new Set([
  'ok',
  'oke',
  'okay',
  'okey',
  'okeh',
  'sip',
  'siap',
  'noted',
  'baik',
  'baiklah',
  'mantap',
  'mantab',
  'keren',
  'nice',
  'good',
  'great',
  'cool',
  'got',
  'it',
  'understood',
  'paham',
  'ngerti',
  'mengerti',
  'jelas',
  'oh',
  'ohh',
  'ooh',
  'ya',
  'iya',
  'yes',
  'yup',
  'yep',
  'deh',
  'dah',
  'ya',
  'ok',
  'sudah',
  'cukup',
  'enough',
  'done',
  'selesai',
  'jo',
  'kak',
  'min',
  'bro',
  'snouty',
  'ya',
  'yah',
  'nih',
  'aja',
]);
const MAX_WORDS = 5;

function words(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Jenis pesan sosial; `null` bila pesan membawa isi. */
export function socialKind(message: string): SocialKind | null {
  const ws = words(message);
  if (ws.length === 0 || ws.length > MAX_WORDS) return null;
  const rest = ws.filter((w) => !ACK_WORDS.has(w));
  if (rest.length === 0) return 'ack';
  // Frasa dua kata ("terima kasih", "sampai jumpa") diperiksa pada kalimatnya, bukan per kata;
  // yang tersisa setelah frasa dan penguat dibuang harus kosong — kalau tidak, pesan membawa isi.
  const joined = rest.join(' ');
  const leftover = (pattern: RegExp) =>
    joined
      .replace(pattern, ' ')
      .replace(/\b(banyak|sekali|you|ya|yaa|lho|loh)\b/g, ' ')
      .trim();
  if (THANKS.test(joined) && leftover(new RegExp(THANKS.source, 'gi')) === '') return 'thanks';
  if (BYE.test(joined) && leftover(new RegExp(BYE.source, 'gi')) === '') return 'bye';
  return null;
}

const COPY: Readonly<Record<Locale, Readonly<Record<SocialKind, string>>>> = {
  id: {
    thanks: 'Sama-sama. Kalau ada lagi yang mau ditanyakan, tinggal tulis di sini.',
    ack: 'Siap. Lanjutkan kapan saja — tanyakan produk, atau ceritakan kebutuhan pipanya.',
    bye: 'Sampai jumpa. Percakapan ini bisa dibuka lagi kapan saja.',
  },
  en: {
    thanks: 'You are welcome. If anything else comes up, just write it here.',
    ack: 'Noted. Carry on whenever you like — ask about a product, or describe your piping needs.',
    bye: 'See you. You can reopen this conversation any time.',
  },
};

/** Teks balasan sosial, atau `null` bila pesan bukan pesan sosial. */
export function socialReply(message: string, locale: Locale = DEFAULT_LOCALE): string | null {
  const kind = socialKind(message);
  return kind === null ? null : COPY[locale][kind];
}
