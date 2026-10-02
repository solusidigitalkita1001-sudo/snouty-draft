/**
 * Anatomi sebuah aturan teknik. docs/ENGINEERING_RULES.md §2.
 *
 * Empat sifat yang membuat ini bekerja, dan masing-masing ditegakkan bentuknya:
 *
 * **`compute` murni.** Tanpa I/O, tanpa `Date.now()`, tanpa acak — masukan sama
 * selalu menghasilkan keluaran sama, sehingga laporan bisa dibuat ulang identik
 * bertahun kemudian.
 *
 * **Versi, bukan edit.** Mengubah formula berarti versi baru. Rekomendasi lama tetap
 * menunjuk versi yang dipakai saat itu, jadi laporan lama tetap bisa dijelaskan meski
 * aturannya sudah berubah.
 *
 * **`explain` menempel pada aturan.** Kolom "DASAR PERHITUNGAN" dirender dari fungsi
 * ini, bukan dari prosa LLM. Penjelasan dan perhitungan tidak akan pernah berbeda
 * karena keduanya keluar dari sumber yang sama.
 *
 * **Test case wajib.** Registry menolak aturan tanpa tes (invarian R-1).
 *
 * Catatan tentang validasi masukan (OQ-42): `ENGINEERING_RULES.md` §2 menyebut skema
 * zod, tetapi paket ini sengaja bebas dependensi runtime — properti itulah yang
 * membuat "engine tidak pernah memanggil LLM" benar secara struktural. Karena itu
 * masukan dijaga `parseInput`, guard TypeScript murni; validasi zod tetap ada di tepi
 * (`apps/api`), tempat keluaran ekstraksi memang sudah divalidasi.
 */

export type RuleValidationStatus = 'REQUIRES_DOMAIN_VALIDATION' | 'VALIDATED' | 'REJECTED';

export type RuleCategory = 'load_sizing' | 'geometry' | 'material' | 'conversation';

export interface TestCase<I, O> {
  readonly name: string;
  readonly input: I;
  readonly expected: O;
}

export interface RuleVersion<I, O> {
  readonly ruleId: string;
  /** Naik saat formula berubah; tidak pernah diedit di tempat. */
  readonly version: number;
  readonly category: RuleCategory;
  /** Guard masukan — melempar `RuleInputError` bila tak sah. */
  readonly parseInput: (raw: unknown) => I;
  /** Murni: tanpa I/O, tanpa jam, tanpa acak. */
  readonly compute: (input: I) => O;
  readonly sourceReference?: string;
  readonly validationStatus: RuleValidationStatus;
  readonly validatedBy?: string;
  readonly validatedAt?: string;
  /** Minimal satu — aturan tanpa tes tidak bisa didaftarkan (invarian R-1). */
  readonly testCases: readonly TestCase<I, O>[];
  /** Teks kolom "DASAR PERHITUNGAN". */
  readonly explain: (input: I, output: O) => string;
}

/**
 * Aturan apa pun, masukan dan keluaran dilupakan.
 *
 * Registry dan orkestrator memang menyimpan aturan **bertipe campur** — tipe payung
 * ini membuat kenyataan itu eksplisit alih-alih disebar sebagai `as any` di pemanggil.
 * Keamanan tipenya tetap ada di tempat yang penting: `compute` setiap aturan diketik
 * ketat pada definisinya, dan `parseInput` adalah gerbang yang memastikan masukan
 * sungguhan sesuai sebelum `compute` menyentuhnya.
 */
export type AnyRule = RuleVersion<never, unknown>;

export class RuleInputError extends Error {
  constructor(
    readonly ruleId: string,
    readonly detail: string,
  ) {
    super(`masukan tidak sah untuk ${ruleId}: ${detail}`);
    this.name = 'RuleInputError';
  }
}

export class RuleRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleRegistrationError';
  }
}

/**
 * Registry aturan. Menolak pendaftaran yang melanggar invarian R-1 (tanpa tes) atau
 * mendaftarkan `(ruleId, version)` yang sama dua kali — versi yang sama dengan isi
 * berbeda akan membuat laporan lama tidak bisa dijelaskan ulang.
 */
export class RuleRegistry {
  private readonly rules = new Map<string, AnyRule>();

  register<I, O>(rule: RuleVersion<I, O>): void {
    if (rule.testCases.length === 0) {
      throw new RuleRegistrationError(
        `${rule.ruleId} tidak punya test case — invarian R-1 melarang pendaftarannya`,
      );
    }

    const key = keyOf(rule.ruleId, rule.version);
    if (this.rules.has(key)) {
      throw new RuleRegistrationError(
        `${key} sudah terdaftar — naikkan versinya, jangan ganti isinya`,
      );
    }

    this.rules.set(key, rule as unknown as AnyRule);
  }

  get(ruleId: string, version: number): AnyRule | null {
    return this.rules.get(keyOf(ruleId, version)) ?? null;
  }

  /** Versi tertinggi sebuah aturan — yang dipakai perhitungan baru. */
  latest(ruleId: string): AnyRule | null {
    let found: AnyRule | null = null;
    for (const rule of this.rules.values()) {
      if (rule.ruleId !== ruleId) continue;
      if (!found || rule.version > found.version) found = rule;
    }
    return found;
  }

  all(): readonly AnyRule[] {
    return [...this.rules.values()];
  }

  /** Aturan yang belum ditandatangani ahli domain — daftar kerja untuk OQ-06. */
  awaitingValidation(): readonly AnyRule[] {
    return this.all().filter((rule) => rule.validationStatus === 'REQUIRES_DOMAIN_VALIDATION');
  }
}

function keyOf(ruleId: string, version: number): string {
  return `${ruleId}@v${version}`;
}

/** Guard angka bulat positif — dipakai banyak aturan, jadi satu tempat. */
export function requireInt(
  ruleId: string,
  field: string,
  raw: unknown,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new RuleInputError(
      ruleId,
      `${field} harus bilangan bulat ${min}–${max}, bukan ${String(raw)}`,
    );
  }
  return raw;
}

/** Guard angka desimal dalam rentang. */
export function requireNumber(
  ruleId: string,
  field: string,
  raw: unknown,
  { min, max }: { min: number; max: number },
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) {
    throw new RuleInputError(ruleId, `${field} harus angka ${min}–${max}, bukan ${String(raw)}`);
  }
  return raw;
}
