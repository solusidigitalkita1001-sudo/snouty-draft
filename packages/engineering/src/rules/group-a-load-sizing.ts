/**
 * Kelompok A — beban, sizing, kelas tekanan. docs/ENGINEERING_RULES.md §3.
 *
 * Semua `REQUIRES_DOMAIN_VALIDATION`. ENG-002 (ambang "unit beban ≥ 8 → 1"") dihapus 2026-10-12:
 * ukuran pipa utama kini dari debit puncak dan hidraulik (Kelompok K + F). ID-nya tidak dipakai ulang;
 * trace rekomendasi lama yang memuatnya tetap terbaca lewat judul langkahnya.
 */

import { localized, requireInt, RuleInputError, type RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

export interface FixtureCounts {
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
}

export interface LoadResult {
  /** "Titik air" di UI. */
  readonly outletCount: number;
  /** Unit beban fixture. */
  readonly loadUnits: number;
}

function parseFixtures(ruleId: string) {
  return (raw: unknown): FixtureCounts => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      bathrooms: requireInt(ruleId, 'bathrooms', o['bathrooms'], { max: 200 }),
      basins: requireInt(ruleId, 'basins', o['basins'], { max: 200 }),
      kitchens: requireInt(ruleId, 'kitchens', o['kitchens'], { max: 100 }),
    };
  };
}

/**
 * ENG-001 · Unit beban fixture dan jumlah titik air.
 *
 * Bobot 2 untuk kamar mandi berasal dari ENG-012 (1 kamar mandi = shower + kloset);
 * keduanya harus divalidasi bersama, karena kalau isi kamar mandi berbeda, bobotnya
 * ikut salah.
 */
export const ENG_001: RuleVersion<FixtureCounts, LoadResult> = {
  ruleId: 'ENG-001',
  version: 2,
  category: 'load_sizing',
  parseInput: parseFixtures('ENG-001'),
  compute: (input) => ({
    // Kamar mandi = shower + kloset: dua titik air (ENG-012), bukan satu (koreksi 2026-10-12).
    outletCount: input.bathrooms * 2 + input.basins + input.kitchens,
    loadUnits: input.bathrooms * 2 + input.basins + input.kitchens,
  }),
  sourceReference:
    'Prototipe baru SNOUTY; contoh board 3 KM + 4 wastafel + 1 dapur = 8 titik, 11 unit',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'contoh board: 3 kamar mandi (6 titik), 4 wastafel, 1 dapur',
      input: { bathrooms: 3, basins: 4, kitchens: 1 },
      expected: { outletCount: 11, loadUnits: 11 },
    },
    {
      name: 'tanpa dapur sama sekali',
      input: { bathrooms: 1, basins: 1, kitchens: 0 },
      expected: { outletCount: 3, loadUnits: 3 },
    },
  ],
  explain: (input, output, locale) =>
    localized(locale, {
      id:
        `Titik air dihitung ${input.bathrooms} kamar mandi × 2 (shower dan kloset) + ${input.basins} wastafel + ${input.kitchens} dapur = ${output.outletCount} titik. ` +
        `Unit beban memakai bobot kamar mandi 2 (shower + kloset), wastafel 1, dapur 1 = ${output.loadUnits} unit.`,
      en:
        `Water outlets counted as ${input.bathrooms} bathrooms × 2 (shower and toilet) + ${input.basins} basins + ${input.kitchens} kitchens = ${output.outletCount} outlets. ` +
        `Load units use weights of bathroom 2 (shower + toilet), basin 1, kitchen 1 = ${output.loadUnits} units.`,
    }),
};

/**
 * ENG-003 · Cabang per lantai, maksimum 4 titik air per cabang.
 *
 * v2 (temuan laporan SNTY-2026-10-0002): cabang dihitung PER LANTAI — satu cabang tidak melayani dua
 * lantai. Lantai yang punya titik air mendapat minimal satu cabang; batas 4 titik berlaku di dalam
 * satu lantai. v1 menghitung ⌈semua titik ÷ 4⌉ sehingga 3 titik di dua lantai menjadi "1 cabang".
 */
export const ENG_003: RuleVersion<
  { readonly outletsPerFloor: readonly number[] },
  { readonly maxOutletsPerBranch: number; readonly branchCount: number }
> = {
  ruleId: 'ENG-003',
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const value = (raw as Record<string, unknown>)?.['outletsPerFloor'];
    if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
      throw new RuleInputError('ENG-003', 'outletsPerFloor');
    }
    return {
      outletsPerFloor: value.map((n, i) =>
        requireInt('ENG-003', `outletsPerFloor[${i}]`, n, { max: 1_000 }),
      ),
    };
  },
  compute: (input) => ({
    maxOutletsPerBranch: 4,
    branchCount: input.outletsPerFloor.reduce((sum, n) => sum + Math.ceil(n / 4), 0),
  }),
  sourceReference:
    'Kedua prototipe ("maksimal 4 titik air per cabang"); v2: dihitung per lantai, satu cabang tidak melayani dua lantai',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'kasus SNTY-2026-10-0002: lantai 2 = 4 titik, lantai 1 = 3 titik → 2 cabang',
      input: { outletsPerFloor: [4, 3] },
      expected: { maxOutletsPerBranch: 4, branchCount: 2 },
    },
    {
      name: '9 titik di satu lantai → 3 cabang',
      input: { outletsPerFloor: [9] },
      expected: { maxOutletsPerBranch: 4, branchCount: 3 },
    },
    {
      name: 'lantai tanpa titik air tidak mendapat cabang',
      input: { outletsPerFloor: [0, 2] },
      expected: { maxOutletsPerBranch: 4, branchCount: 1 },
    },
  ],
  explain: (input, output, locale) => {
    const floors = input.outletsPerFloor.filter((n) => n > 0).length;
    const total = input.outletsPerFloor.reduce((a, b) => a + b, 0);
    return localized(locale, {
      id:
        floors > 1
          ? `Tiap lantai punya cabangnya sendiri, masing-masing paling banyak 4 titik air, sehingga ${total} titik di ${floors} lantai memerlukan ${output.branchCount} cabang.`
          : `Cabang dibatasi maksimal 4 titik air agar penurunan tekanan tetap wajar, sehingga ${total} titik memerlukan ${output.branchCount} cabang.`,
      en:
        floors > 1
          ? `Each floor has its own branch, each serving at most 4 outlets, so ${total} outlets on ${floors} floors need ${output.branchCount} branches.`
          : `Each branch serves at most 4 outlets to keep the pressure drop reasonable, so ${total} outlets need ${output.branchCount} branches.`,
    });
  },
};

/**
 * ENG-005 · Ukuran sambungan fixture.
 *
 * Di desain, baris ini sudah ditandai **ASUMSI** bahkan di mockup — satu-satunya baris
 * tabel sistem yang begitu, jadi provenance-nya memang tampil sejak gambar.
 */
export const ENG_005: RuleVersion<
  Record<string, never>,
  { readonly fixtureConnectionSize: '1/2"' }
> = {
  ruleId: 'ENG-005',
  version: 1,
  category: 'load_sizing',
  parseInput: () => ({}),
  compute: () => ({ fixtureConnectionSize: '1/2"' }),
  sourceReference: 'Kedua prototipe; sudah bertanda ASUMSI di mockup',
  validationStatus: PENDING,
  testCases: [{ name: 'selalu 1/2 inci', input: {}, expected: { fixtureConnectionSize: '1/2"' } }],
  explain: (_input, _output, locale) =>
    localized(locale, {
      id: 'Sambungan ke setiap fixture diasumsikan 1/2 inci.',
      en: 'The connection to each fixture is assumed to be 1/2 inch.',
    }),
};

/**
 * ENG-010 · Kecepatan aliran target.
 *
 * Hanya dikutip sebagai penjelasan; batas kecepatan yang dipakai menghitung ada di registry
 * asumsi (Kelompok F).
 */
export const ENG_010: RuleVersion<
  Record<string, never>,
  { readonly minMs: number; readonly maxMs: number }
> = {
  ruleId: 'ENG-010',
  version: 1,
  category: 'load_sizing',
  parseInput: () => ({}),
  compute: () => ({ minMs: 1, maxMs: 2 }),
  sourceReference: 'Teks "DETAIL TEKNIS" prototipe',
  validationStatus: PENDING,
  testCases: [{ name: 'rentang 1–2 m/s', input: {}, expected: { minMs: 1, maxMs: 2 } }],
  explain: (_input, output, locale) =>
    localized(locale, {
      id: `Kecepatan aliran target ${output.minMs}–${output.maxMs} m/s.`,
      en: `Target flow velocity ${output.minMs}–${output.maxMs} m/s.`,
    }),
};

export type PressureClass = 'AW' | 'D';

/**
 * ENG-013 · Panduan kelas tekanan. Aturan **pemilihan material**, bukan sizing —
 * dipakai Product Matcher (Fase 7).
 */
export const ENG_013: RuleVersion<
  { readonly installationType: 'clean_water' | 'drainage' | 'both' },
  { readonly classes: readonly PressureClass[] }
> = {
  ruleId: 'ENG-013',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const value = (raw as Record<string, unknown>)?.['installationType'];
    if (value !== 'clean_water' && value !== 'drainage' && value !== 'both') {
      throw new Error(`ENG-013: installationType tidak dikenal: ${String(value)}`);
    }
    return { installationType: value };
  },
  compute: (input) => {
    if (input.installationType === 'clean_water') return { classes: ['AW'] };
    if (input.installationType === 'drainage') return { classes: ['D'] };
    return { classes: ['AW', 'D'] };
  },
  sourceReference: 'Kartu kriteria board layar 08',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'air bersih bertekanan → AW',
      input: { installationType: 'clean_water' },
      expected: { classes: ['AW'] },
    },
    {
      name: 'pembuangan → D',
      input: { installationType: 'drainage' },
      expected: { classes: ['D'] },
    },
    {
      name: 'keduanya → AW dan D',
      input: { installationType: 'both' },
      expected: { classes: ['AW', 'D'] },
    },
  ],
  explain: (_input, output, locale) =>
    localized(locale, {
      id: `Kelas pipa yang sesuai: ${output.classes.join(' dan ')} (AW untuk air bersih bertekanan, D untuk pembuangan).`,
      en: `Suitable pipe class: ${output.classes.join(' and ')} (AW for pressurized clean water, D for drainage).`,
    }),
};

export const GROUP_A = [ENG_001, ENG_003, ENG_005, ENG_010, ENG_013];
