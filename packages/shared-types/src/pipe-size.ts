/**
 * PipeSize — ukuran pipa sebagai value object, bukan string bebas.
 *
 * Desain memakai penulisan campuran yang disengaja: di bawah 1 inci memakai
 * garis miring (`1/2"`, `3/4"`), dari 1 inci ke atas memakai pecahan unicode
 * (`1¼"`, `1½"`, `2½"`). Menyimpan ukuran sebagai string mentah berarti
 * `1.25"` dan `1¼"` akan dianggap dua ukuran berbeda, dan matcher akan
 * meleset tanpa ada yang menyadarinya.
 *
 * Sejak 2026-10-06 (docs/PIPE_SIZE_MM_EXTENSION.md): **satuan adalah bagian dari ukuran.**
 * Export ERP Pralon menulis HDPE, PVC seri ISO/SNI, dan fitting besar dalam milimeter
 * (`110 mm`), dan `110 mm` bukan `4"` — padanan dagang antar sistem standar bukan fakta
 * fisika, jadi tidak ada konversi mm ↔ inci di sini. Perbandingan hanya antar satuan yang
 * sama; tampilan selalu memakai label kanonik. docs/DOMAIN_MODEL.md §2.
 */

export type PipeSizeUnit = 'in' | 'mm';

const VULGAR: Readonly<Record<string, number>> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const FRACTION_GLYPH: Readonly<Record<string, string>> = {
  '0.125': '⅛',
  '0.25': '¼',
  '0.375': '⅜',
  '0.5': '½',
  '0.625': '⅝',
  '0.75': '¾',
  '0.875': '⅞',
};

/** Batas nilai × 1000 per satuan: ≤ 100" · ≤ 3000 mm. */
const LIMITS: Readonly<Record<PipeSizeUnit, number>> = { in: 100_000, mm: 3_000_000 };

/** Toleransi perbandingan inci: cukup untuk membedakan 1/8", jauh dari galat floating point. */
const EPSILON = 1e-6;

export class PipeSize {
  private constructor(
    readonly unit: PipeSizeUnit,
    /** in: 0.75" → 750 · mm: 110 mm → 110000, 12.5 mm → 12500. */
    readonly valueX1000: number,
  ) {}

  /**
   * Membaca ukuran dari berbagai penulisan yang mungkin muncul di katalog atau
   * dari pengguna: `3/4`, `3/4"`, `0.75`, `1 1/4"`, `1¼`, `1.25"`, `½` (inci) dan
   * `110 mm`, `110mm`, `12,5 mm` (milimeter). Tanpa satuan berarti inci.
   *
   * Mengembalikan `null` bila tidak terbaca — memaksakan nilai default di sini
   * akan menjadi tebakan diam-diam (SPEC §5 Policy 2). Pecahan yang pembilangnya
   * ≥ penyebut (`11/2`) ditolak sebagai ambigu: hampir pasti maksudnya `1 1/2`, dan
   * membacanya sebagai 5,5" adalah ukuran karangan.
   */
  static parse(input: string): PipeSize | null {
    const raw = input.trim().replace(/["”″]/g, '').replace(/\s+/g, ' ').trim();
    if (raw === '') return null;

    const millimetres = /^(\d+(?:[.,]\d+)?)\s*mm$/i.exec(raw);
    if (millimetres) return PipeSize.mm(Number(millimetres[1]!.replace(',', '.')));

    // Bentuk campuran: "1 1/4" atau "1 ¼"
    const mixed = /^(\d+)\s+(?:(\d+)\/(\d+)|([¼½¾⅛⅜⅝⅞]))$/.exec(raw);
    if (mixed) {
      const whole = Number(mixed[1]);
      const frac = mixed[4] ? VULGAR[mixed[4]] : properFraction(mixed[2]!, mixed[3]!);
      return frac === undefined || frac === null ? null : PipeSize.of(whole + frac);
    }

    // Bentuk melekat: "1¼"
    const attached = /^(\d+)([¼½¾⅛⅜⅝⅞])$/.exec(raw);
    if (attached) {
      const frac = VULGAR[attached[2]!];
      return frac === undefined ? null : PipeSize.of(Number(attached[1]) + frac);
    }

    // Pecahan tunggal: "3/4" — "11/2" ambigu, ditolak.
    const fraction = /^(\d+)\/(\d+)$/.exec(raw);
    if (fraction) {
      const frac = properFraction(fraction[1]!, fraction[2]!);
      return frac === null ? null : PipeSize.of(frac);
    }

    // Glif tunggal: "½"
    if (raw in VULGAR) return PipeSize.of(VULGAR[raw]!);

    // Desimal atau bulat: "1.25", "2"
    const decimal = /^\d+(?:\.\d+)?$/.exec(raw);
    if (decimal) return PipeSize.of(Number(raw));

    return null;
  }

  static of(inches: number): PipeSize | null {
    if (!Number.isFinite(inches) || inches <= 0) return null;
    const valueX1000 = Math.round(inches * 1000);
    if (valueX1000 <= 0 || valueX1000 > LIMITS.in) return null;
    return new PipeSize('in', valueX1000);
  }

  static mm(millimetres: number): PipeSize | null {
    if (!Number.isFinite(millimetres) || millimetres <= 0) return null;
    const valueX1000 = Math.round(millimetres * 1000);
    if (valueX1000 <= 0 || valueX1000 > LIMITS.mm) return null;
    return new PipeSize('mm', valueX1000);
  }

  /** Dari nilai tersimpan (`size_unit`, `size_value_x1000`); `null` bila di luar rentang. */
  static fromStored(unit: PipeSizeUnit, valueX1000: number): PipeSize | null {
    if (!Number.isInteger(valueX1000) || valueX1000 <= 0 || valueX1000 > LIMITS[unit]) return null;
    return new PipeSize(unit, valueX1000);
  }

  /** Nilai inci — hanya sah untuk ukuran inci; ukuran mm tidak punya padanan inci di sini. */
  get inches(): number {
    if (this.unit !== 'in') {
      throw new Error(`ukuran ${this.label} dalam mm tidak punya nilai inci (tidak ada konversi)`);
    }
    return this.valueX1000 / 1000;
  }

  /**
   * Label kanonik: inci mengikuti penulisan desain (garis miring di bawah 1 inci, pecahan
   * unicode dari 1 inci ke atas); mm = angka tanpa nol di belakang + ` mm`.
   */
  get label(): string {
    if (this.unit === 'mm') return `${trimZeros(this.valueX1000 / 1000)} mm`;

    const inches = this.valueX1000 / 1000;
    const whole = Math.floor(inches + EPSILON);
    const frac = Number((inches - whole).toFixed(3));

    if (frac < EPSILON) return `${whole}"`;

    const glyph = FRACTION_GLYPH[String(frac)];
    if (whole === 0) {
      // Di bawah 1 inci desain memakai "1/2", bukan "½".
      const [n, d] = PipeSize.toSimpleFraction(frac);
      return `${n}/${d}"`;
    }
    return glyph ? `${whole}${glyph}"` : `${inches}"`;
  }

  /** Sama = satuan sama dan nilai sama. `63 mm` dan `2"` tidak pernah sama. */
  equals(other: PipeSize): boolean {
    return this.unit === other.unit && this.valueX1000 === other.valueX1000;
  }

  /** Hanya antar satuan sama; membandingkan mm dengan inci adalah galat pemrograman. */
  isLargerThan(other: PipeSize): boolean {
    return PipeSize.compare(this, other) > 0;
  }

  static compare(a: PipeSize, b: PipeSize): number {
    if (a.unit !== b.unit) {
      throw new Error(`tidak bisa membandingkan ${a.label} dengan ${b.label}: satuan berbeda`);
    }
    return a.valueX1000 - b.valueX1000;
  }

  /** Urut menaik per satuan (inci dulu, lalu mm) — dipakai daftar "UKURAN TERSEDIA". */
  static sort(sizes: readonly PipeSize[]): PipeSize[] {
    return [...sizes].sort((a, b) =>
      a.unit === b.unit ? a.valueX1000 - b.valueX1000 : a.unit === 'in' ? -1 : 1,
    );
  }

  toString(): string {
    return this.label;
  }

  toJSON(): string {
    return this.label;
  }

  private static toSimpleFraction(value: number): [number, number] {
    for (const d of [2, 4, 8, 16]) {
      const n = value * d;
      if (Math.abs(n - Math.round(n)) < EPSILON) return [Math.round(n), d];
    }
    return [Math.round(value * 16), 16];
  }
}

/** `n/d` dengan 0 < n < d; selain itu `null` (ambigu atau tidak sah). */
function properFraction(numerator: string, denominator: string): number | null {
  const n = Number(numerator);
  const d = Number(denominator);
  if (d === 0 || n === 0 || n >= d) return null;
  return n / d;
}

function trimZeros(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** Fungsi bebas sesuai docs/PIPE_SIZE_MM_EXTENSION.md §3 — pembungkus tipis atas kelas. */
export function parsePipeSize(raw: string): PipeSize | null {
  return PipeSize.parse(raw);
}
export function comparePipeSize(a: PipeSize, b: PipeSize): number {
  return PipeSize.compare(a, b);
}
export function samePipeSize(a: PipeSize, b: PipeSize): boolean {
  return a.equals(b);
}

/**
 * Rentang ukuran yang belum bisa dipastikan, mis. `3"–4" ?` pada layar 07.
 *
 * Ini bukan "ukuran yang dipilih dengan ragu" — sistem menyatakan belum bisa
 * memilih. Karena itu ia tipe tersendiri, bukan PipeSize dengan flag, sehingga
 * tidak mungkin tanpa sengaja dipakai sebagai ukuran final.
 */
export class PipeSizeRange {
  constructor(
    readonly min: PipeSize,
    readonly max: PipeSize,
  ) {}

  /** Tanda tanya mengikuti desain: rentangnya memang belum ditentukan. */
  get label(): string {
    return `${this.min.label}–${this.max.label} ?`;
  }

  contains(size: PipeSize): boolean {
    return !size.isLargerThan(this.max) && !this.min.isLargerThan(size);
  }
}

/** Transisi ukuran untuk reducer, mis. `1" → 3/4"`. */
export class PipeSizeTransition {
  constructor(
    readonly from: PipeSize,
    readonly to: PipeSize,
  ) {}

  get label(): string {
    return `${this.from.label} → ${this.to.label}`;
  }
}
