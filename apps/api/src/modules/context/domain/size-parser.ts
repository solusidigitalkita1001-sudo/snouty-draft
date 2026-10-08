/**
 * Parser nilai terstruktur: UKURAN pipa yang disebut dalam teks ("3/4", "1 1/2 inch", "63 mm").
 * Ini pembacaan angka+satuan, bukan pemahaman pertanyaan — pertanyaannya sendiri ("ada ukuran …?")
 * dikenali modul `understanding` dari contoh. Mengembalikan teks ukuran apa adanya (tanpa spasi)
 * untuk di-parse `PipeSize`; `null` bila tidak ada angka ukuran.
 */

const SIZE =
  /(?<![\w/])(\d+(?:\s*\/\s*\d+)?(?:\s*[.,]\d+)?)\s*(?:inch|inci|in\b|"|mm\b)?(?![\w/])/i;

export function parseSize(text: string): string | null {
  const match = SIZE.exec(text);
  return match ? match[1]!.replace(/\s+/g, '') : null;
}
