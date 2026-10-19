/**
 * Bahasa balasan dari kalimat pengguna sendiri (keputusan pemilik 2026-10-19): pengguna yang
 * menulis dalam bahasa Inggris dijawab dalam bahasa Inggris, apa pun posisi tombol bahasa di UI.
 *
 * Pengenalannya model n-gram bahasa (tinyld), dibatasi ke dua bahasa yang didukung — bukan
 * daftar kata atau kalimat, jadi tidak ada pertanyaan pengguna yang di-hardcode. Dipilih dari
 * tiga pustaka lewat `evals/reply-language-cases.json`: franc salah membaca kalimat pendek bermerek
 * ("pralon itu apa?" → Inggris). Pesan yang tidak cukup jelas ("ok", "pralon jis vs sni") tidak
 * memutuskan apa-apa: `null`, dan pemanggil tetap memakai bahasa percakapan saat ini.
 */
import { detectAll } from 'tinyld';
import { isLocale, type Locale } from '@snouty/shared-types';

export function replyLanguageOf(text: string): Locale | null {
  const [best] = detectAll(text, { only: ['id', 'en'] });
  return best && isLocale(best.lang) ? best.lang : null;
}
