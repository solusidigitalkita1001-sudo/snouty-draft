/**
 * Kesetaraan ukuran mm ↔ inci, dijawab dari tabel ukuran resmi Pralon (PROD/STD-04 lewat
 * `@snouty/engineering`), bukan dikarang dan bukan ditanya balik.
 *
 * Produksi 2026-11-04: "pipa 160 mm itu sama dengan 6 inch ya?" dijawab seluruh tabel diameter
 * luar tanpa mengatakan jawabannya — padahal angkanya ada: 6 inci berdiameter luar 165 mm,
 * sedangkan 160 mm adalah diameter luar pipa HDPE. Yang dibaca dari pesan hanya angka dan
 * satuannya (parser nilai), bukan bentuk kalimatnya.
 */

import { HDPE_MM_SIZES, PVC_INCH_SIZES, PVC_LARGE_SIZES } from '@snouty/engineering';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';

/** Ukuran nominal inci Pralon beserta diameter luarnya, dari ½" sampai 12". */
const INCH_ROWS: readonly {
  readonly label: string;
  readonly inch: number;
  readonly outerMm: number;
}[] = [...PVC_INCH_SIZES, ...PVC_LARGE_SIZES]
  .map((row) => ({ label: row.size, inch: inchValue(row.size), outerMm: row.outerMm }))
  .filter((row) => row.inch > 0)
  .sort((a, b) => a.inch - b.inch);

const HDPE_OUTER_MM: readonly number[] = HDPE_MM_SIZES.map((row) => row.outerMm);

/** Label tabel ("3/4\"", "1¼\"") menjadi angka inci. */
function inchValue(label: string): number {
  const plain = label
    .replace(/"/g, '')
    .replace(/¼/g, ' 1/4')
    .replace(/½/g, ' 1/2')
    .replace(/¾/g, ' 3/4')
    .trim();
  const parts = plain.split(/\s+/);
  let total = 0;
  for (const part of parts) {
    const fraction = /^(\d+)\/(\d+)$/.exec(part);
    if (fraction) total += Number(fraction[1]) / Number(fraction[2]);
    else if (/^\d+(?:[.,]\d+)?$/.test(part)) total += Number(part.replace(',', '.'));
    else return 0;
  }
  return total;
}

/** Nilai milimeter yang tersurat di pesan; ukuran pipa terkecil di tabel 16 mm. */
function millimetres(text: string): readonly number[] {
  const found = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:mm|milimeter|millimet(?:er|re)s?)\b/gi)]
    .map((m) => Number(m[1]!.replace(',', '.')))
    .filter((value) => value >= 10 && value <= 2000);
  return [...new Set(found)];
}

/** Nilai inci yang tersurat di pesan, termasuk pecahan ("1 1/2 inci", '3/4"'). */
function inchesIn(text: string): readonly number[] {
  const pattern =
    /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:"|''|inch(?:es)?|inchi|inci|in\b)/gi;
  const found = [...text.matchAll(pattern)]
    .map((m) => inchValue(m[1]!))
    .filter((value) => value > 0 && value <= 24);
  return [...new Set(found)];
}

function rowFor(inch: number): (typeof INCH_ROWS)[number] | undefined {
  return INCH_ROWS.find((row) => Math.abs(row.inch - inch) < 0.01);
}

function nearest(outerMm: number): (typeof INCH_ROWS)[number] {
  return INCH_ROWS.reduce((best, row) =>
    Math.abs(row.outerMm - outerMm) < Math.abs(best.outerMm - outerMm) ? row : best,
  );
}

/** Label inci dalam prosa: 1¼" → "1 1/4 inci". */
function spoken(label: string, locale: Locale): string {
  const value = label
    .replace(/"/g, '')
    .replace(/¼/g, ' 1/4')
    .replace(/½/g, ' 1/2')
    .replace(/¾/g, ' 3/4');
  return locale === 'en' ? `${value.trim()} inch` : `${value.trim()} inci`;
}

const hdpeHasOd = (outerMm: number) => HDPE_OUTER_MM.includes(outerMm);

/**
 * Jawaban langsung untuk pertanyaan kesetaraan ukuran; `null` bila pesannya tidak menyebut satu
 * ukuran pun yang bisa disetarakan.
 */
export function sizeEquivalence(message: string, locale: Locale = DEFAULT_LOCALE): string | null {
  const en = locale === 'en';
  const mm = millimetres(message);
  const inch = inchesIn(message);

  if (mm.length > 0 && inch.length > 0) {
    const row = rowFor(inch[0]!);
    if (row === undefined) return null;
    const stated = mm[0]!;
    const size = spoken(row.label, locale);
    if (Math.abs(row.outerMm - stated) < 0.5) {
      return en
        ? `Yes — ${size} pipe has an outside diameter of ${row.outerMm} mm, so ${stated} mm is that same size.`
        : `Ya — pipa ${size} berdiameter luar ${row.outerMm} mm, jadi ${stated} mm memang ukuran itu.`;
    }
    const hdpe = hdpeHasOd(stated)
      ? en
        ? ` HDPE pipe is sized by its outside diameter in mm, and ${stated} mm is one of those sizes — the closest inch size to it is ${size}, but the diameter is not the same.`
        : ` Pipa HDPE memakai diameter luar dalam mm, dan ${stated} mm salah satu ukurannya — ukuran inci terdekatnya ${size}, tetapi diameternya tidak sama.`
      : '';
    return en
      ? `Not quite: ${size} pipe has an outside diameter of ${row.outerMm} mm, not ${stated} mm.${hdpe}`
      : `Tidak persis: pipa ${size} berdiameter luar ${row.outerMm} mm, bukan ${stated} mm.${hdpe}`;
  }

  if (mm.length > 0) {
    const stated = mm[0]!;
    const row = nearest(stated);
    const size = spoken(row.label, locale);
    if (Math.abs(row.outerMm - stated) < 0.5) {
      return en
        ? `${stated} mm is the outside diameter of ${size} pipe.`
        : `${stated} mm adalah diameter luar pipa ${size}.`;
    }
    const hdpe = hdpeHasOd(stated)
      ? en
        ? ` ${stated} mm is itself an HDPE size, where the number is the outside diameter.`
        : ` Ukuran ${stated} mm sendiri ukuran pipa HDPE, yang angkanya memang diameter luar.`
      : '';
    return en
      ? `${stated} mm has no exact inch equivalent: the closest is ${size}, whose outside diameter is ${row.outerMm} mm.${hdpe}`
      : `${stated} mm tidak punya padanan inci yang persis: yang terdekat ${size}, berdiameter luar ${row.outerMm} mm.${hdpe}`;
  }

  if (inch.length > 0) {
    const row = rowFor(inch[0]!);
    if (row === undefined) return null;
    const size = spoken(row.label, locale);
    return en
      ? `${size} pipe has an outside diameter of ${row.outerMm} mm.`
      : `Pipa ${size} berdiameter luar ${row.outerMm} mm.`;
  }
  return null;
}
