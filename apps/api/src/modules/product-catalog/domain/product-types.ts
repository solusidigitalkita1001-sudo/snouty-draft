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
