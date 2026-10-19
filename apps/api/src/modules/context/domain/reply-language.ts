/**
 * Bahasa balasan dari kalimat pengguna sendiri (keputusan pemilik 2026-10-19): pengguna yang
 * menulis dalam bahasa Inggris dijawab dalam bahasa Inggris, apa pun posisi tombol bahasa di UI.
 *
 * Pengenalannya model n-gram bahasa, dibatasi ke dua bahasa yang didukung — bukan daftar kata atau
 * kalimat, jadi tidak ada pertanyaan pengguna yang di-hardcode. Pesan yang tidak cukup jelas ("ok",
 * "pralon jis vs sni") tidak memutuskan apa-apa: `null`, dan pemanggil tetap memakai bahasa
 * percakapan saat ini. Salah bahasa lebih buruk daripada tetap di bahasa percakapan.
 *
 * Nilai bersatuan ("3 inch", "110 mm") dan nama produk/merek disisihkan lebih dulu karena sama di
 * kedua bahasa; skor yang seri berarti tidak jelas (audit 2026-10-19: "elbow pvc 3 inch ada?").
 *
 * Dua model, dipilih lewat `evals/reply-language-cases.json`: tinyld memutuskan (andal di kalimat
 * pendek bermerek, tempat franc salah — "pralon itu apa?"), dan franc boleh MEMBATALKAN bila ia
 * tegas melihat bahasa lain (andal di kalimat panjang bercampur istilah, tempat tinyld salah —
 * "gedung kantor 8 lantai … ground tank lalu pompa ke atas" terbaca Inggris, simulasi 2026-10-19).
 */
import { francAll } from 'franc-min';
import { detectAll } from 'tinyld';
import { isLocale, type Locale } from '@snouty/shared-types';
import { maskValues } from '../../understanding/domain/value-mask.js';

const FRANC_LOCALE: Readonly<Record<string, Locale>> = { ind: 'id', eng: 'en' };
/** Runner-up franc di atas ini = kedua bahasa sama-sama masuk akal: franc tidak ikut memutuskan. */
const FRANC_AMBIGUOUS = 0.95;

export function replyLanguageOf(
  text: string,
  withoutNames: (text: string) => string = (t) => t,
): Locale | null {
  const signal = withoutNames(maskValues(text).replace(/\bN\b/g, ' '));
  const [best, second] = detectAll(signal, { only: ['id', 'en'] });
  if (!best || !isLocale(best.lang)) return null;
  if (second && second.accuracy >= best.accuracy) return null;
  // franc hanya andal di kalimat panjang; di kalimat pendek ia sendiri sering salah ("how do you join
  // pipe?" terbaca Indonesia), jadi pembatalannya hanya berlaku dari VETO_MIN_WORDS kata.
  if (wordsIn(signal) < VETO_MIN_WORDS) return best.lang;
  const veto = francLocale(signal);
  return veto !== null && veto !== best.lang ? null : best.lang;
}

/** Kata (dua huruf atau lebih) setelah nilai dan nama disisihkan — batas pembatalan franc. */
const VETO_MIN_WORDS = 8;
const wordsIn = (signal: string) => signal.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length;

function francLocale(signal: string): Locale | null {
  const [top, runnerUp] = francAll(signal, { only: Object.keys(FRANC_LOCALE), minLength: 1 });
  if (!top || top[1] <= 0 || (runnerUp && runnerUp[1] > FRANC_AMBIGUOUS)) return null;
  return FRANC_LOCALE[top[0]] ?? null;
}
