/**
 * Jenis produk dalam satu keluarga, dibaca dari NAMA produk katalog — **fungsi murni**.
 *
 * Di katalog ERP Pralon, kategori, standar, dan aplikasi untuk satu keluarga sering seragam atau
 * kosong (HDPE: 1.327 produk, satu kategori "PIPA HDPE"); yang membedakan jenisnya hanya nama:
 * "Pipa HDPE PE 100 PN-8 160 mm x 9 Meter", "Pipa HDPE Telkom 40/33 x 182 Meter Orange Garis Biru".
 * Polanya konsisten: jenis → kelas tekanan (PN) → ukuran → panjang/warna. Jenis = nama sebelum
 * ukuran pertama, tanpa PN dan tanpa warna; PN dikumpulkan sebagai varian jenis itu.
 *
 * Ini parser nilai terstruktur atas DATA katalog, bukan tebakan atas kalimat pengguna.
 */

export interface ProductType {
  /** "Pipa HDPE PE 100", "Pipa (TS End) AW", "Red Socket - W". */
  readonly type: string;
  readonly count: number;
  /** Kelas tekanan yang ada untuk jenis ini, urut naik: ["PN-6", "PN-8", …]. */
  readonly pressureClasses: readonly string[];
  /** Satu nama produk utuh dari jenis ini. */
  readonly example: string;
}

const SIZE = String.raw`(?:\d+(?:[.,]\d+)?(?:\s\d+\/\d+)?|\d+\/\d+)`;
/**
 * Awal bagian dimensi: ukuran bersatuan (mm, cm, inci), ukuran diikuti "x", atau pasangan a/b
 * (subduct 40/33). Sudut (11 1/4°) bagian dari jenis, bukan ukuran.
 */
const DIMENSION = new RegExp(
  String.raw`\s(?:${SIZE}\s*(?:mm|cm|"|”|inch)|${SIZE}\s*"?\s*x\s|\d+\/\d+(?![\d°º]))`,
  'i',
);
const PRESSURE_CLASS = /\bPN-?\s?(\d+(?:[.,]\d+)?)/i;
/** Warna membedakan SKU, bukan jenis ("Putih AW" dan "Abu AW" adalah jenis yang sama). */
const COLOR =
  /\b(putih|abu-abu|abu|coklat|cokelat|hitam|kuning|biru|merah|orange|oranye|hijau|ungu)\b(\/\w+)?/gi;

export function productTypeOf(name: string): { type: string; pressureClass: string | null } {
  const dimension = name.match(DIMENSION);
  let head = (dimension ? name.slice(0, dimension.index) : name).trim();
  const pn = head.match(PRESSURE_CLASS);
  head = head
    .replace(PRESSURE_CLASS, '')
    .replace(COLOR, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s*$/, '')
    // Katalog menulis desimal dengan koma dan titik ("SDR-13,6" dan "SDR-13.6"): satu jenis.
    .replace(/(\d),(\d)/g, '$1.$2')
    .trim();
  return {
    type: head === '' ? name.trim() : head,
    pressureClass: pn ? `PN-${pn[1]!.replace(',', '.')}` : null,
  };
}

export interface ProductSize {
  /** Label seperti tertulis: "160 mm", "1 1/2\"", "40/33". */
  readonly label: string;
  /** Nilai pembanding dalam mm (inci × 25,4; pasangan a/b: a, lalu b sebagai pemisah seri). */
  readonly mm: number;
}

const MM = /\s(\d+(?:[.,]\d+)?)\s*mm(?=\b|x)/i;
const INCH = /\s(\d+\s\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:"|”|inch)/i;
const PAIR = /\s(\d+)\/(\d+)(?![\d°º"])/;

/** Ukuran utama dari nama produk (ukuran pertama setelah jenis); `null` bila tidak ada. */
export function productSizeOf(name: string): ProductSize | null {
  const mm = name.match(MM);
  const inch = name.match(INCH);
  const pair = name.match(PAIR);
  // Yang muncul PALING AWAL adalah ukuran utama ("TY - D 12\" x 10\"" → 12").
  const found = [
    mm && { index: mm.index!, size: { label: `${mm[1]} mm`, mm: decimal(mm[1]!) } },
    inch && { index: inch.index!, size: { label: `${inch[1]}"`, mm: inches(inch[1]!) * 25.4 } },
    pair && {
      index: pair.index!,
      size: { label: `${pair[1]}/${pair[2]}`, mm: Number(pair[1]) + Number(pair[2]) / 1000 },
    },
  ].filter((f): f is { index: number; size: ProductSize } => Boolean(f));
  found.sort((a, b) => a.index - b.index);
  return found[0]?.size ?? null;
}

function decimal(text: string): number {
  return Number.parseFloat(text.replace(',', '.'));
}

/** "1 1/2" → 1,5; "3/4" → 0,75; "6" → 6. */
function inches(text: string): number {
  const [whole, fraction] = text.includes(' ') ? text.split(' ') : [null, text];
  const value = (part: string) => {
    const [a, b] = part.split('/');
    return b === undefined ? decimal(a!) : Number(a) / Number(b);
  };
  return (whole === null ? 0 : value(whole)) + value(fraction!);
}

/** Ukuran unik per jenis, urut naik. */
export function sizesByType(names: readonly string[]): ReadonlyMap<string, readonly ProductSize[]> {
  const byType = new Map<string, Map<string, ProductSize>>();
  for (const name of names) {
    const size = productSizeOf(name);
    if (size === null) continue;
    const { type } = productTypeOf(name);
    const sizes = byType.get(type) ?? new Map<string, ProductSize>();
    sizes.set(size.label, size);
    byType.set(type, sizes);
  }
  return new Map(
    [...byType.entries()].map(([type, sizes]) => [
      type,
      [...sizes.values()].sort((a, b) => a.mm - b.mm),
    ]),
  );
}

/** Jenis terbanyak dulu; kelas tekanan urut naik. */
export function productTypesOf(names: readonly string[]): readonly ProductType[] {
  const groups = new Map<string, { count: number; pn: Set<string>; example: string }>();
  for (const name of names) {
    const { type, pressureClass } = productTypeOf(name);
    const group = groups.get(type) ?? { count: 0, pn: new Set<string>(), example: name };
    group.count += 1;
    if (pressureClass) group.pn.add(pressureClass);
    groups.set(type, group);
  }
  return [...groups.entries()]
    .map(([type, g]) => ({
      type,
      count: g.count,
      pressureClasses: [...g.pn].sort((a, b) => pnValue(a) - pnValue(b)),
      example: g.example,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

function pnValue(pn: string): number {
  return Number.parseFloat(pn.slice(3));
}
