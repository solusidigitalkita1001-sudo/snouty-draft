/**
 * Nomor standar yang disebut sebuah jawaban — ditemukan, dibakukan, lalu diuji terhadap daftar
 * yang memang dipegang SNOUTY (P31-88, OQ-79). **Fungsi murni.**
 *
 * Pengukuran 2026-10-28 di produksi: dari lima jawaban pengetahuan pipa, dua menyebut nomor
 * standar yang keliru atau tidak ada — salah satunya lengkap dengan judul SNI yang dikarang.
 * Pagar yang sudah ada memeriksa penyebutan Pralon, merek lain, dan baris provenance untuk angka;
 * tidak satu pun bisa membantah nomor standar, dan justru nomor standar yang paling sulit
 * dibantah pembacanya: ia terlihat seperti hal yang bisa dicek, sehingga tidak ada yang mengecek.
 *
 * Yang dipegang di sini hanya mekanismenya. Daftar nomornya adalah data
 * (`data/knowledge/standards.json`), jadi standar baru ditambah tanpa menyentuh kode.
 */

/**
 * Badan standar yang dikenali. Sengaja terbatas: makin luas daftarnya, makin besar peluang
 * sebuah kata biasa terbaca sebagai kutipan standar.
 */
const BODIES = [
  'SNI',
  'ISO',
  'ASTM',
  'JIS',
  'DIN',
  'EN',
  'BS',
  'AS/NZS',
  'UPC',
  'IPC',
  'ASME',
  'AWWA',
  'ANSI',
  'NSF',
] as const;

/**
 * `SNI 4829-1:2015`, `JIS K 6741`, `UPC Tabel 702.1`, `ISO 4427`.
 *
 * Kata "Tabel"/"Table" dibuang saat pembakuan — "UPC Tabel 702.1" dan "UPC 702.1" menyebut hal
 * yang sama, dan daftar tidak perlu memuat keduanya.
 */
const CITATION = new RegExp(
  String.raw`\b(${BODIES.map((b) => b.replace('/', '\\/')).join('|')})` +
    String.raw`[\s-]+(?:tabel|table)?[\s-]*([A-Z])?[\s-]*(\d[\d.:/-]*)`,
  'gi',
);

/** Pemisah yang boleh mengikuti sebuah nomor yang dikenal: bagian, tahun, atau revisinya. */
const PART_SEPARATORS = [':', '-', '/', '.'];

/**
 * Bentuk baku sebuah kutipan: huruf besar, satu spasi antara badan dan nomornya, tanda baca
 * ujung dibuang. `UPC Tabel 702.1:` → `UPC 702.1`, `sni-4829` → `SNI 4829`.
 *
 * Tanda hubung **di dalam** nomor tidak disentuh: `SNI 06-0084-2002` adalah satu nomor, dan
 * membuang tanda hubungnya membuat dua dokumen berbeda terbaca sama.
 */
export function normalizeStandard(text: string): string {
  const match = new RegExp(CITATION.source, 'i').exec(text.trim());
  if (match === null) return text.toUpperCase().replace(/\s+/g, ' ').trim();
  return formatCitation(match[1]!, match[2], match[3]!);
}

function formatCitation(body: string, letter: string | undefined, number: string): string {
  const trimmed = number.replace(/[.,:;/-]+$/, '');
  const prefix = letter === undefined ? '' : `${letter.toUpperCase()} `;
  return `${body.toUpperCase()} ${prefix}${trimmed}`;
}

/** Nomor standar yang disebut teks, dalam bentuk baku dan tanpa duplikat. */
export function standardCitationsIn(text: string): readonly string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(CITATION)) {
    found.add(formatCitation(match[1]!, match[2], match[3]!));
  }
  return [...found];
}

/**
 * Apakah sebuah kutipan tercakup daftar yang dipegang.
 *
 * Daftar menyimpan nomor pokoknya (`SNI 4829`), dan bagian atau tahun di belakangnya ikut
 * diterima (`SNI 4829-1:2015`) — itu dokumen yang sama, bukan nomor lain. Yang tidak diterima
 * adalah nomor pokok yang tidak ada di daftar, berapa pun mirip bentuknya.
 */
export function isKnownStandard(citation: string, known: ReadonlySet<string>): boolean {
  if (known.has(citation)) return true;
  for (const entry of known) {
    if (!citation.startsWith(entry)) continue;
    const next = citation.charAt(entry.length);
    if (PART_SEPARATORS.includes(next)) return true;
  }
  return false;
}

/** Kutipan pertama yang tidak bisa dipertanggungjawabkan, atau `null` bila semuanya bisa. */
export function unknownStandardIn(text: string, known: ReadonlySet<string>): string | null {
  return standardCitationsIn(text).find((c) => !isKnownStandard(c, known)) ?? null;
}
