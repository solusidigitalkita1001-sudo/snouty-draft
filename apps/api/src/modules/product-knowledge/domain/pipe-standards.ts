/**
 * Tabel standar pipa Pralon — tebal dinding, diameter dalam, berat per meter per kelas dan ukuran.
 *
 * Sumbernya dokumen standar Pralon (PROD/STD-001, 002, 003, 014) lewat handbook yang diterima
 * pemilik 2026-10-14 (`data/standards/`). Ini data per KELAS, bukan per SKU katalog, jadi hidup di
 * sini dan bukan di kolom produk. Kelas yang tidak ada di dokumen (PRALON AW/D/C, OQ-64) tidak
 * punya baris — jawabannya mengakui itu, tidak meminjam kelas lain.
 */

import { PipeSize } from '@snouty/shared-types';

export type StandardSeries = 'pe100' | 'jis_vp' | 'jis_vu' | 'sni_s' | 'sni_ab';

export interface StandardRow {
  readonly series: StandardSeries;
  /** Kelas seperti tertulis di dokumen: "SDR 17", "S-12,5", "Kelas A", "VP". */
  readonly classLabel: string;
  /** Tekanan nominal bila dokumen menyebutnya ("PN 10"). */
  readonly pressure?: string;
  /** Label ukuran kanonik `PipeSize` ("110 mm", `1/2"`). */
  readonly size: string;
  readonly outerMm: number;
  /** Tebal dinding nominal (minimum) dan toleransi atasnya, mm. */
  readonly wallMm: number;
  readonly wallToleranceMm: number;
  readonly kgPerM: number | null;
  /** "PROD/STD/014 Rev. 04". */
  readonly document: string;
}

/** Kelas yang disebut pesan — nilai terstruktur (SDR/PN/S/kelas/seri), bukan pola pertanyaan. */
export interface ClassFilter {
  readonly series?: StandardSeries;
  readonly classLabel?: string;
  /** Kelas PRALON AW/D/C disebut — belum ada tabel resminya (OQ-64). */
  readonly pralonClass?: 'AW' | 'D' | 'C';
}

/** Diameter dalam rata-rata: OD − 2 × (tebal nominal + ½ toleransi), 0,1 mm. */
export function meanInnerMm(row: StandardRow): number {
  return Math.round((row.outerMm - 2 * (row.wallMm + row.wallToleranceMm / 2)) * 10) / 10;
}

const num = (raw: string): number => Number(raw.replace(',', '.'));
const sameNumber = (a: string, b: number) => Math.abs(num(a) - b) < 1e-9;

const SDR = /\bsdr\s*-?\s*(\d+(?:[.,]\d+)?)/i;
const PN = /\bpn\s*-?\s*(\d+(?:[.,]\d+)?)/i;
const S_CLASS = /\bs\s*-?\s*(\d+(?:[.,]\d+)?)\b/i;
const AB_CLASS = /\b(?:kelas|class)\s*([ab])\b/i;

/**
 * Membaca kelas dari teks: "SDR 17", "PN 10", "S-12,5", "kelas A", "VP"/"VU". Nama keluarga HDPE
 * dan kelas PRALON AW/D/C dibaca kosakata (`families`), bukan di sini.
 */
export function classFilterFrom(
  text: string,
  families: readonly string[],
  rows: readonly StandardRow[],
): ClassFilter {
  const sdr = SDR.exec(text);
  if (sdr) return { series: 'pe100', classLabel: labelOf(rows, 'pe100', num(sdr[1]!), 'SDR ') };
  const pn = PN.exec(text);
  if (pn) {
    const wanted = `PN ${pn[1]!.replace('.', ',')}`;
    const match = rows.find((r) => r.series === 'pe100' && r.pressure === wanted);
    return { series: 'pe100', classLabel: match?.classLabel ?? wanted };
  }
  if (/\bvp\b/i.test(text)) return { series: 'jis_vp', classLabel: 'VP' };
  if (/\bvu\b/i.test(text)) return { series: 'jis_vu', classLabel: 'VU' };
  // "S-12,5" / "S 12,5": hanya bila kelas S itu memang ada di dokumen.
  const s = S_CLASS.exec(text);
  const sLabel = s ? existingLabel(rows, 'sni_s', num(s[1]!)) : undefined;
  if (sLabel) return { series: 'sni_s', classLabel: sLabel };
  const ab = AB_CLASS.exec(text);
  if (ab) return { series: 'sni_ab', classLabel: `Kelas ${ab[1]!.toUpperCase()}` };
  const pralon = families.find((f) => /^pvc (aw|d|c)$/.test(f));
  if (pralon) return { pralonClass: pralon.slice(4).toUpperCase() as 'AW' | 'D' | 'C' };
  if (families.includes('hdpe')) return { series: 'pe100' };
  return {};
}

function existingLabel(
  rows: readonly StandardRow[],
  series: StandardSeries,
  value: number,
): string | undefined {
  return rows.find(
    (r) => r.series === series && sameNumber(r.classLabel.replace(/^(SDR |S-)/, ''), value),
  )?.classLabel;
}

/** "17" → "SDR 17" persis dokumen; kelas yang tidak ada tetap diberi label supaya bisa disebut. */
function labelOf(
  rows: readonly StandardRow[],
  series: StandardSeries,
  value: number,
  prefix: string,
): string {
  return existingLabel(rows, series, value) ?? `${prefix}${String(value).replace('.', ',')}`;
}

/** Ukuran yang ditanyakan cocok dengan baris (mm dengan mm, inci dengan inci). */
export function sameSize(row: StandardRow, size: string): boolean {
  const a = PipeSize.parse(row.size);
  const b = PipeSize.parse(size);
  return a !== null && b !== null && a.equals(b);
}

export function rowsFor(
  rows: readonly StandardRow[],
  filter: ClassFilter,
  size: string | null,
): readonly StandardRow[] {
  return rows.filter(
    (r) =>
      (filter.series === undefined || r.series === filter.series) &&
      (filter.classLabel === undefined || r.classLabel === filter.classLabel) &&
      (size === null || sameSize(r, size)),
  );
}

/** Teks tanpa token kelas — supaya "SDR 17" tidak terbaca ukuran 17 oleh parser ukuran. */
export function withoutClassTokens(text: string): string {
  return text
    .replace(/\b(?:sdr|pn)\s*-?\s*\d+(?:[.,]\d+)?/gi, ' ')
    .replace(/\bs\s*-\s*\d+(?:[.,]\d+)?/gi, ' ');
}
