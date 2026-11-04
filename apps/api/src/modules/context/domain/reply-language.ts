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
  // Dua bahasa yang nilainya hampir sama bukan keputusan. Bahasa Indonesia perdagangan memungut
  // kata Inggris ("ready stok", "order", "cancel"), dan pada kalimat pendek kata pungutan itu
  // cukup membalik tinyld: "ready stok pvc aw 4" ga? butuh 300 batang" terbaca Inggris 0,52 lawan
  // 0,48 dan dijawab dalam bahasa Inggris di produksi (2026-11-02). Pada jarak sedekat itu franc
  // yang memutuskan — ia tegas Indonesia di kalimat yang sama (1 lawan 0,45) — dan bila franc pun
  // tidak tegas, gilirannya tetap di bahasa percakapan.
  //
  // Hanya bila bahasa kedua MEMANG muncul. Tanpa pesaing, tinyld tidak melihat jejak bahasa lain
  // sama sekali, dan itu keputusan walau nilainya kecil ("bathrooms, sinks, kitchen" 0,095 tanpa
  // pesaing — franc membacanya Indonesia, dan franc yang salah tidak boleh ikut memutuskan).
  if (second && best.accuracy - second.accuracy < TIED_MARGIN) return francLocale(signal);
  // franc hanya andal di kalimat panjang; di kalimat pendek ia sendiri sering salah ("how do you join
  // pipe?" terbaca Indonesia dengan pesaing 0,74), jadi pembatalannya hanya berlaku dari
  // VETO_MIN_WORDS kata — KECUALI bila franc tegas: satu bahasa penuh dan pesaingnya jauh di bawah.
  // "ready stock ngga di jakarta?" terbaca Inggris penuh oleh tinyld karena dua kata pungutan di
  // depan, dan dijawab bahasa Inggris di produksi (2026-11-04); franc membacanya Indonesia 1 lawan
  // 0,43 — jarak yang tidak pernah terjadi pada kalimat Inggris pendek yang dicoba.
  const words = wordsIn(signal);
  if (words < VETO_MIN_WORDS) {
    // Satu-dua kata ("great", "thanks") tidak punya bahan untuk n-gram mana pun: tinyld yang
    // memutuskan, seperti sebelumnya.
    if (words < FRANC_MIN_WORDS) return best.lang;
    const emphatic = francLocale(signal, FRANC_EMPHATIC);
    // Dua pengenal yang sama-sama yakin dan tidak sepakat bukan keputusan: gilirannya tetap di
    // bahasa percakapan. Pada kalimat berlabel, bacaan franc yang SALAH selalu punya pesaing
    // 0,79 ke atas — jadi di bawah 0,7 ia tegas, dan ketegasan yang bertabrakan menahan pindah
    // bahasa alih-alih membalikkannya.
    return emphatic === null || emphatic === best.lang ? best.lang : null;
  }
  const veto = francLocale(signal);
  return veto !== null && veto !== best.lang ? null : best.lang;
}

/** Jarak akurasi tinyld yang sudah terhitung seri; di bawah ini franc yang memutuskan. */
const TIED_MARGIN = 0.1;
/** Kata (dua huruf atau lebih) setelah nilai dan nama disisihkan — batas pembatalan franc. */
const VETO_MIN_WORDS = 8;
const wordsIn = (signal: string) => signal.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length;
/** Pesaing franc di bawah ini = bacaan franc tegas; di kalimat pendek hanya yang tegas didengar. */
const FRANC_EMPHATIC = 0.7;
/** Kalimat di bawah ini terlalu pendek untuk n-gram franc ('great'): tinyld yang memutuskan. */
const FRANC_MIN_WORDS = 3;

function francLocale(signal: string, runnerUpCeiling = FRANC_AMBIGUOUS): Locale | null {
  const [top, runnerUp] = francAll(signal, { only: Object.keys(FRANC_LOCALE), minLength: 1 });
  if (!top || top[1] <= 0 || (runnerUp && runnerUp[1] > runnerUpCeiling)) return null;
  return FRANC_LOCALE[top[0]] ?? null;
}
