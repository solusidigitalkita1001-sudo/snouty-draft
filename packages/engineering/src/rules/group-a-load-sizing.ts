/**
 * Kelompok A — beban, sizing, kelas tekanan. docs/ENGINEERING_RULES.md §3.
 *
 * Semua `REQUIRES_DOMAIN_VALIDATION`. ENG-002 adalah aturan paling berpengaruh di
 * sistem (ia menentukan angka terbesar di layar ringkasan) dan ambang tunggal tanpa
 * memperhitungkan panjang jalur, elevasi, atau kerugian gesek hampir pasti
 * penyederhanaan — validasi ahli di situ prioritas tertinggi.
 */

import { requireInt, type RuleVersion } from '../rule.js';

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
  version: 1,
  category: 'load_sizing',
  parseInput: parseFixtures('ENG-001'),
  compute: (input) => ({
    outletCount: input.bathrooms + input.basins + input.kitchens,
    loadUnits: input.bathrooms * 2 + input.basins + input.kitchens,
  }),
  sourceReference:
    'Prototipe baru SNOUTY; contoh board 3 KM + 4 wastafel + 1 dapur = 8 titik, 11 unit',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'contoh board: 3 kamar mandi, 4 wastafel, 1 dapur',
      input: { bathrooms: 3, basins: 4, kitchens: 1 },
      expected: { outletCount: 8, loadUnits: 11 },
    },
    {
      name: 'tanpa dapur sama sekali',
      input: { bathrooms: 1, basins: 1, kitchens: 0 },
      expected: { outletCount: 2, loadUnits: 3 },
    },
  ],
  explain: (input, output) =>
    `Titik air dihitung ${input.bathrooms} kamar mandi + ${input.basins} wastafel + ${input.kitchens} dapur = ${output.outletCount} titik. ` +
    `Unit beban memakai bobot kamar mandi 2 (shower + kloset), wastafel 1, dapur 1 = ${output.loadUnits} unit.`,
};

export interface MainSizeResult {
  readonly mainSize: '1"' | '3/4"';
}

/**
 * ENG-002 · Ambang ukuran jalur utama dan riser.
 *
 * **Perhatian (OQ-22):** prototipe lama dan SPEC §33b menyebut `fixtures >= 6` dengan
 * definisi `fixtures` yang juga berbeda. Contoh kerja di board cocok dengan versi baru
 * (`loadUnits >= 8`), dan itu yang dipakai di sini.
 */
export const ENG_002: RuleVersion<{ readonly loadUnits: number }, MainSizeResult> = {
  ruleId: 'ENG-002',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => ({
    loadUnits: requireInt('ENG-002', 'loadUnits', (raw as Record<string, unknown>)?.['loadUnits'], {
      max: 10_000,
    }),
  }),
  compute: (input) => ({ mainSize: input.loadUnits >= 8 ? '1"' : '3/4"' }),
  sourceReference: 'Prototipe baru SNOUTY (OQ-22: prototipe lama memakai ambang berbeda)',
  validationStatus: PENDING,
  testCases: [
    { name: 'tepat di ambang 8 unit', input: { loadUnits: 8 }, expected: { mainSize: '1"' } },
    { name: 'di bawah ambang', input: { loadUnits: 7 }, expected: { mainSize: '3/4"' } },
    { name: 'beban besar', input: { loadUnits: 24 }, expected: { mainSize: '1"' } },
  ],
  explain: (input, output) =>
    `Total ${input.loadUnits} unit beban ${input.loadUnits >= 8 ? 'mencapai' : 'belum mencapai'} ambang 8 unit, ` +
    `sehingga jalur utama dan riser memakai ukuran ${output.mainSize}.`,
};

/** ENG-003 · Maksimum titik air per cabang. */
export const ENG_003: RuleVersion<
  { readonly outletCount: number },
  { readonly maxOutletsPerBranch: number; readonly branchCount: number }
> = {
  ruleId: 'ENG-003',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => ({
    outletCount: requireInt(
      'ENG-003',
      'outletCount',
      (raw as Record<string, unknown>)?.['outletCount'],
      {
        max: 1_000,
      },
    ),
  }),
  compute: (input) => ({
    maxOutletsPerBranch: 4,
    branchCount: input.outletCount === 0 ? 0 : Math.ceil(input.outletCount / 4),
  }),
  sourceReference:
    'Kedua prototipe; muncul di UI sebagai "Melayani maksimal 4 titik air per cabang"',
  validationStatus: PENDING,
  testCases: [
    {
      name: '8 titik → 2 cabang',
      input: { outletCount: 8 },
      expected: { maxOutletsPerBranch: 4, branchCount: 2 },
    },
    {
      name: '9 titik → 3 cabang',
      input: { outletCount: 9 },
      expected: { maxOutletsPerBranch: 4, branchCount: 3 },
    },
    {
      name: 'tanpa titik air → tanpa cabang',
      input: { outletCount: 0 },
      expected: { maxOutletsPerBranch: 4, branchCount: 0 },
    },
  ],
  explain: (input, output) =>
    `Cabang dibatasi maksimal 4 titik air agar penurunan tekanan tetap wajar, sehingga ${input.outletCount} titik ` +
    `memerlukan ${output.branchCount} cabang.`,
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
  explain: () => 'Sambungan ke setiap fixture diasumsikan 1/2 inci.',
};

/**
 * ENG-010 · Kecepatan aliran target.
 *
 * Saat ini **hanya dikutip sebagai penjelasan**, belum dipakai menghitung apa pun.
 * Bila nanti sizing benar-benar berbasis kecepatan, ENG-002 kemungkinan besar
 * digantikan olehnya.
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
  explain: (_input, output) => `Kecepatan aliran target ${output.minMs}–${output.maxMs} m/s.`,
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
  explain: (_input, output) =>
    `Kelas pipa yang sesuai: ${output.classes.join(' dan ')} (AW untuk air bersih bertekanan, D untuk pembuangan).`,
};

export const GROUP_A = [ENG_001, ENG_002, ENG_003, ENG_005, ENG_010, ENG_013];
