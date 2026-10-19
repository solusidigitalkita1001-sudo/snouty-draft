/**
 * Bahasa balasan dari kalimat pengguna sendiri (keputusan pemilik 2026-10-19): pengguna yang
 * menulis dalam bahasa Inggris dijawab dalam bahasa Inggris, apa pun posisi tombol bahasa di UI.
 *
 * Pengenalannya model n-gram bahasa (tinyld), dibatasi ke dua bahasa yang didukung — bukan
 * daftar kata atau kalimat, jadi tidak ada pertanyaan pengguna yang di-hardcode. Dipilih dari
 * tiga pustaka lewat `evals/reply-language-cases.json`: franc salah membaca kalimat pendek bermerek
 * ("pralon itu apa?" → Inggris). Pesan yang tidak cukup jelas ("ok", "pralon jis vs sni") tidak
 * memutuskan apa-apa: `null`, dan pemanggil tetap memakai bahasa percakapan saat ini.
 *
 * Nilai bersatuan ("3 inch", "110 mm") dan nama produk/merek disisihkan lebih dulu karena sama di
 * kedua bahasa; skor yang seri berarti tidak jelas (audit 2026-10-19: "elbow pvc 3 inch ada?"
 * dijawab dalam bahasa Inggris).
 */
import { detectAll } from 'tinyld';
import { isLocale, type Locale } from '@snouty/shared-types';
import { maskValues } from '../../understanding/domain/value-mask.js';

export function replyLanguageOf(
  text: string,
  withoutNames: (text: string) => string = (t) => t,
): Locale | null {
  const signal = withoutNames(maskValues(text).replace(/\bN\b/g, ' '));
  const [best, second] = detectAll(signal, { only: ['id', 'en'] });
  if (!best || !isLocale(best.lang)) return null;
  if (second && second.accuracy >= best.accuracy) return null;
  return best.lang;
}
