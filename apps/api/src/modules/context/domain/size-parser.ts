/**
 * Parser nilai terstruktur: UKURAN pipa yang disebut dalam teks ("3/4", "1 1/2 inch", "63 mm").
 * Ini pembacaan angka+satuan, bukan pemahaman pertanyaan — pertanyaannya sendiri ("ada ukuran …?")
 * dikenali modul `understanding` dari contoh. Mengembalikan teks ukuran dalam bentuk yang diterima
 * `PipeSize.parse` ("3/4", "1 1/2", "63 mm"); `null` bila tidak ada angka ukuran.
 *
 * Angka yang bukan ukuran disingkirkan dulu: kelas/seri produk ("PE 100", "PN 10", "SDR 11",
 * "S-12.5") dan jumlah bangunan ("2 lantai"). Angka bersatuan atau pecahan menang atas angka
 * telanjang — "pe 100 ada ukuran 63 mm?" adalah 63 mm, bukan 100 (tinjauan 2026-10-08).
 */

const NOT_A_SIZE = /\b(?:pe|pn|sdr|s|kelas|class)\s*-?\s*\d+(?:[.,]\d+)?\b/gi;
const COUNT_NOUN =
  /\b\d{1,3}\s*-?\s*(?:lantai|lt|tingkat|kamar mandi|km|toilet|wastafel|dapur|titik|keran|floors?|stor(?:e)?ys?|bathrooms?|sinks?|kitchens?|taps?)\b/gi;

const NUMBER = String.raw`(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)`;
/** Angka diikuti satuan ukuran; satuan ditangkap supaya milimeter tidak dibaca sebagai inci. */
const SIZED = new RegExp(`(?<![\\w/])${NUMBER}\\s*(inch|inci|in\\b|"|mm\\b)`, 'i');
/** Pecahan tanpa satuan ("ada ukuran 3/4?") — pecahan hampir selalu ukuran pipa inci. */
const FRACTION = /(?<![\w/])(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)(?![\w/])/;
const MAX_BARE_INCH = 12;

/** Angka telanjang sebagai cadangan terakhir ("ukuran 63 ada?"). */
const BARE = /(?<![\w/.,])(\d+(?:[.,]\d+)?)(?![\w/])/;

export function parseSize(text: string): string | null {
  const cleaned = text.replace(NOT_A_SIZE, ' ').replace(COUNT_NOUN, ' ');
  const sized = SIZED.exec(cleaned);
  if (sized) {
    const unit = sized[2]!.toLowerCase() === 'mm' ? ' mm' : '';
    return `${tidy(sized[1]!)}${unit}`;
  }
  const fraction = FRACTION.exec(cleaned);
  if (fraction) return tidy(fraction[1]!);
  const bare = BARE.exec(cleaned);
  if (!bare) return null;
  // Angka telanjang di atas 12 adalah milimeter: ukuran inci pipa berhenti di belasan, ukuran mm
  // dimulai dari 16 — "elbow hdpe 63 ada?" adalah 63 mm, bukan 63 inci (audit live 2026-10-08).
  const value = Number(bare[1]!.replace(',', '.'));
  return value > MAX_BARE_INCH ? `${tidy(bare[1]!)} mm` : tidy(bare[1]!);
}

function tidy(value: string): string {
  return value
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}
