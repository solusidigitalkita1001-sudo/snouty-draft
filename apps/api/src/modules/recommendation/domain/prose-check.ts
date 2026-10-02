/**
 * Pemeriksa invarian REC-1. docs/DOMAIN_MODEL.md §7 · docs/AI_BEHAVIOR.md §7.
 * **Fungsi murni, tanpa I/O.**
 *
 * Prosa LLM hanya boleh **menjelaskan** angka yang sudah dihitung. Tanpa pemeriksaan
 * ini, "LLM tidak menghitung" cuma benar di atas kertas: model tetap bisa menyelipkan
 * "sekitar 12 batang" di tengah kalimat yang tampak masuk akal, dan pengguna tidak
 * punya cara membedakannya dari angka hasil hitungan.
 *
 * Cara kerjanya sengaja kasar dan konservatif: semua angka di prosa diekstrak, lalu
 * setiap angka harus ada di himpunan nilai terhitung. Angka yang lolos karena kebetulan
 * cocok bukan masalah — yang penting tidak ada angka asing yang lolos.
 */

/** Angka yang tidak membawa klaim teknik apa pun dan biasa muncul dalam prosa. */
const HARMLESS = new Set([0, 1, 2]);

/**
 * Pola label ukuran pipa, **bilangan campuran lebih dulu**: `2 1/2` harus terbaca
 * sebagai satu ukuran 2½ inci, bukan sebagai `1/2`. Urutan alternatif di regex inilah
 * yang menentukannya — kalau pecahan sederhana didahulukan, ukuran 2½" akan menyusut
 * menjadi ½" dan lolos sebagai ukuran yang "sudah dipilih".
 */
const SIZE_PATTERN = /\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+\s*[¼½¾]|[¼½¾]/g;

/**
 * Mengekstrak angka dari teks. Menangani desimal koma (Indonesia) dan titik, serta
 * melewati label ukuran pipa — "3/4 inci" adalah satu nilai, bukan tiga dibagi empat.
 */
export function extractNumbers(text: string): readonly number[] {
  const withoutSizes = text.replace(SIZE_PATTERN, ' ');
  const matches = withoutSizes.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((raw) => Number.parseFloat(raw.replace(',', '.'))).filter(Number.isFinite);
}

/** Ukuran pipa yang disebut prosa, dalam bentuk label mentah. */
export function extractSizeLabels(text: string): readonly string[] {
  const matches = text.match(SIZE_PATTERN) ?? [];
  return matches.map((raw) => raw.replace(/\s+/g, ' ').trim());
}

export interface ProseCheckInput {
  readonly headline: string;
  readonly body: string;
  /** Semua angka yang benar-benar dihitung (stats, baris sistem, kuantitas BOM). */
  readonly allowedNumbers: readonly number[];
  /** Semua label ukuran yang benar-benar dipilih (mis. `1"`, `3/4"`). */
  readonly allowedSizes: readonly string[];
}

export interface ProseCheckResult {
  readonly ok: boolean;
  /** Angka di prosa yang tidak ada di hasil hitungan. */
  readonly foreignNumbers: readonly number[];
  /** Ukuran di prosa yang tidak pernah dipilih. */
  readonly foreignSizes: readonly string[];
}

export function checkProse(input: ProseCheckInput): ProseCheckResult {
  const allowed = new Set(input.allowedNumbers);
  const allowedSizes = new Set(input.allowedSizes.map(normalizeSize));
  const text = `${input.headline}\n${input.body}`;

  const foreignNumbers = [...new Set(extractNumbers(text))].filter(
    (value) => !allowed.has(value) && !HARMLESS.has(value),
  );
  const foreignSizes = [...new Set(extractSizeLabels(text).map(normalizeSize))].filter(
    (size) => !allowedSizes.has(size),
  );

  return {
    ok: foreignNumbers.length === 0 && foreignSizes.length === 0,
    foreignNumbers,
    foreignSizes,
  };
}

/**
 * Menyeragamkan label ukuran agar `1"`, `1`, dan `1 ` dibandingkan setara — tetapi
 * TIDAK menghapus pemisah bilangan campuran: `2 1/2` menjadi `2-1/2`, bukan `21/2`,
 * supaya ia tidak pernah bertabrakan dengan ukuran lain.
 */
function normalizeSize(label: string): string {
  const cleaned = label.replace(/["”]/g, '').trim();
  return cleaned.replace(/\s+/g, '-');
}
