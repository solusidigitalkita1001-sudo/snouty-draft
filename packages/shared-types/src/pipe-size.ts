/**
 * PipeSize — ukuran pipa sebagai value object, bukan string bebas.
 *
 * Desain memakai penulisan campuran yang disengaja: di bawah 1 inci memakai
 * garis miring (`1/2"`, `3/4"`), dari 1 inci ke atas memakai pecahan unicode
 * (`1¼"`, `1½"`, `2½"`). Menyimpan ukuran sebagai string mentah berarti
 * `1.25"` dan `1¼"` akan dianggap dua ukuran berbeda, dan matcher akan
 * meleset tanpa ada yang menyadarinya.
 *
 * Karena itu: perbandingan selalu atas nilai numerik, tampilan selalu memakai
 * label kanonik. docs/DOMAIN_MODEL.md §2.
 */

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

/** Toleransi perbandingan: cukup untuk membedakan 1/8", jauh dari galat floating point. */
const EPSILON = 1e-6;

export class PipeSize {
  private constructor(readonly inches: number) {}

  /**
   * Membaca ukuran dari berbagai penulisan yang mungkin muncul di katalog atau
   * dari pengguna: `3/4`, `3/4"`, `0.75`, `1 1/4"`, `1¼`, `1.25"`.
   * Mengembalikan `null` bila tidak terbaca — memaksakan nilai default di sini
   * akan menjadi tebakan diam-diam (SPEC §5 Policy 2).
   */
  static parse(input: string): PipeSize | null {
    const raw = input.trim().replace(/["”″]/g, '').replace(/\s+/g, ' ').trim();
    if (raw === '') return null;

    // Bentuk campuran: "1 1/4" atau "1 ¼"
    const mixed = /^(\d+)\s+(?:(\d+)\/(\d+)|([¼½¾⅛⅜⅝⅞]))$/.exec(raw);
    if (mixed) {
      const whole = Number(mixed[1]);
      const frac = mixed[4] ? VULGAR[mixed[4]] : Number(mixed[2]) / Number(mixed[3]);
      return frac === undefined || !Number.isFinite(frac) ? null : PipeSize.of(whole + frac);
    }

    // Bentuk melekat: "1¼"
    const attached = /^(\d+)([¼½¾⅛⅜⅝⅞])$/.exec(raw);
    if (attached) {
      const frac = VULGAR[attached[2]!];
      return frac === undefined ? null : PipeSize.of(Number(attached[1]) + frac);
    }

    // Pecahan tunggal: "3/4"
    const fraction = /^(\d+)\/(\d+)$/.exec(raw);
    if (fraction) {
      const denominator = Number(fraction[2]);
      if (denominator === 0) return null;
      return PipeSize.of(Number(fraction[1]) / denominator);
    }

    // Glif tunggal: "½"
    if (raw in VULGAR) return PipeSize.of(VULGAR[raw]!);

    // Desimal atau bulat: "1.25", "2"
    const decimal = /^\d+(?:\.\d+)?$/.exec(raw);
    if (decimal) return PipeSize.of(Number(raw));

    return null;
  }

  static of(inches: number): PipeSize | null {
    if (!Number.isFinite(inches) || inches <= 0 || inches > 100) return null;
    return new PipeSize(inches);
  }

  /**
   * Label kanonik, mengikuti penulisan desain: garis miring di bawah 1 inci,
   * pecahan unicode dari 1 inci ke atas.
   */
  get label(): string {
    const whole = Math.floor(this.inches + EPSILON);
    const frac = Number((this.inches - whole).toFixed(3));

    if (frac < EPSILON) return `${whole}"`;

    const glyph = FRACTION_GLYPH[String(frac)];
    if (whole === 0) {
      // Di bawah 1 inci desain memakai "1/2", bukan "½".
      const [n, d] = PipeSize.toSimpleFraction(frac);
      return `${n}/${d}"`;
    }
    return glyph ? `${whole}${glyph}"` : `${this.inches}"`;
  }

  equals(other: PipeSize): boolean {
    return Math.abs(this.inches - other.inches) < EPSILON;
  }

  isLargerThan(other: PipeSize): boolean {
    return this.inches - other.inches > EPSILON;
  }

  static compare(a: PipeSize, b: PipeSize): number {
    return a.inches - b.inches;
  }

  /** Urut menaik — dipakai untuk daftar "UKURAN TERSEDIA" di drawer produk. */
  static sort(sizes: readonly PipeSize[]): PipeSize[] {
    return [...sizes].sort(PipeSize.compare);
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
