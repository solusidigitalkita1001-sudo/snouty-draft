/**
 * Kelompok C — material. docs/ENGINEERING_RULES.md §3.
 *
 * Tidak satu pun formula BOM memakai panjang jalur sebenarnya. Karena itu seluruh
 * baris BOM berstatus `ESTIMATED` selama `building.dimensions` kosong — persis seperti
 * tag desain "ESTIMASI · DIMENSI BELUM LENGKAP". Keputusan itu diambil gerbang
 * provenance, bukan di sini: aturan menghitung, gerbang menilai seberapa jauh
 * hasilnya bisa dipertanggungjawabkan.
 */

import { localized, requireInt, type RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

export interface BomInput {
  readonly floors: number;
  readonly bathrooms: number;
  readonly mainSize: '1"' | '3/4"';
}

export interface BomLine {
  readonly item: string;
  readonly size: string;
  readonly quantity: number;
  readonly unit: 'batang' | 'pcs' | 'kaleng';
}

export interface BomResult {
  readonly lines: readonly BomLine[];
}

/**
 * ENG-009 · Formula kuantitas BOM.
 *
 * **Lubang yang diketahui:** laporan dua halaman menambahkan satu baris yang tidak ada
 * di prototipe — Lem PVC, 100 gr, 2 kaleng. Belum ada formulanya, jadi ia TIDAK
 * dikarang di sini; barisnya menyusul bersama ahli domain (OQ-06). Mengarang formula
 * untuk mengisi tabel adalah cara halus berhalusinasi.
 */
export const ENG_009: RuleVersion<BomInput, BomResult> = {
  ruleId: 'ENG-009',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const mainSize = o['mainSize'];
    if (mainSize !== '1"' && mainSize !== '3/4"') {
      throw new Error(`ENG-009: mainSize tidak dikenal: ${String(mainSize)}`);
    }
    return {
      floors: requireInt('ENG-009', 'floors', o['floors'], { min: 1, max: 50 }),
      bathrooms: requireInt('ENG-009', 'bathrooms', o['bathrooms'], { max: 200 }),
      mainSize,
    };
  },
  compute: (input) => ({
    lines: [
      { item: 'Pipa PVC AW', size: input.mainSize, quantity: 2 + input.floors, unit: 'batang' },
      { item: 'Pipa PVC AW', size: '3/4"', quantity: 3 + input.bathrooms, unit: 'batang' },
      { item: 'Tee', size: '3/4"', quantity: input.bathrooms + 2, unit: 'pcs' },
      { item: 'Elbow 90°', size: '3/4"', quantity: input.bathrooms * 3, unit: 'pcs' },
      { item: 'Reducer', size: `${input.mainSize}→3/4"`, quantity: input.floors, unit: 'pcs' },
    ],
  }),
  sourceReference: 'Prototipe baru SNOUTY; tidak memakai panjang jalur sebenarnya',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'contoh board: 2 lantai, 3 kamar mandi, jalur utama 1"',
      input: { floors: 2, bathrooms: 3, mainSize: '1"' },
      expected: {
        lines: [
          { item: 'Pipa PVC AW', size: '1"', quantity: 4, unit: 'batang' },
          { item: 'Pipa PVC AW', size: '3/4"', quantity: 6, unit: 'batang' },
          { item: 'Tee', size: '3/4"', quantity: 5, unit: 'pcs' },
          { item: 'Elbow 90°', size: '3/4"', quantity: 9, unit: 'pcs' },
          { item: 'Reducer', size: '1"→3/4"', quantity: 2, unit: 'pcs' },
        ],
      },
    },
  ],
  explain: (input, _output, locale) =>
    localized(locale, {
      id:
        `Kuantitas diperkirakan dari ${input.floors} lantai dan ${input.bathrooms} kamar mandi. ` +
        'Panjang jalur sebenarnya belum diketahui, sehingga jumlah ini perkiraan perencanaan.',
      en:
        `Quantities are estimated from ${input.floors} floors and ${input.bathrooms} bathrooms. ` +
        'The actual run lengths are not known yet, so these figures are a planning estimate.',
    }),
};

/** ENG-006 · Selisih lapangan — catatan kaki tabel material. */
export const ENG_006: RuleVersion<
  Record<string, never>,
  { readonly minPercent: number; readonly maxPercent: number }
> = {
  ruleId: 'ENG-006',
  version: 1,
  category: 'material',
  parseInput: () => ({}),
  compute: () => ({ minPercent: 10, maxPercent: 15 }),
  sourceReference: 'Kedua prototipe, catatan kaki tabel material',
  validationStatus: PENDING,
  testCases: [{ name: 'selisih 10–15%', input: {}, expected: { minPercent: 10, maxPercent: 15 } }],
  explain: (_input, output, locale) =>
    localized(locale, {
      id: `Kuantitas di lapangan biasanya berbeda ${output.minPercent}–${output.maxPercent}% dari perkiraan.`,
      en: `On-site quantities usually differ by ${output.minPercent}–${output.maxPercent}% from the estimate.`,
    }),
};

/**
 * ENG-012 · Isi kamar mandi.
 *
 * Aturan inilah yang menjadi dasar bobot 2 pada ENG-001; keduanya harus divalidasi
 * bersama, karena kalau isi kamar mandi berbeda, bobotnya ikut salah.
 */
export const ENG_012: RuleVersion<
  Record<string, never>,
  { readonly fixturesPerBathroom: readonly string[]; readonly loadWeight: number }
> = {
  ruleId: 'ENG-012',
  version: 1,
  category: 'material',
  parseInput: () => ({}),
  compute: () => ({ fixturesPerBathroom: ['shower', 'kloset'], loadWeight: 2 }),
  sourceReference: 'Kartu asumsi prototipe',
  validationStatus: PENDING,
  testCases: [
    {
      name: '1 kamar mandi = shower + kloset, bobot 2',
      input: {},
      expected: { fixturesPerBathroom: ['shower', 'kloset'], loadWeight: 2 },
    },
  ],
  explain: (_input, output, locale) =>
    localized(locale, {
      id: `Setiap kamar mandi diasumsikan berisi ${output.fixturesPerBathroom.join(' dan ')}, sehingga bobot bebannya ${output.loadWeight}.`,
      en: `Each bathroom is assumed to contain a ${output.fixturesPerBathroom.map((f) => FIXTURE_EN[f] ?? f).join(' and a ')}, so its load weight is ${output.loadWeight}.`,
    }),
};

/** Nama fixture keluaran ENG-012 (data Indonesia) untuk penjelasan Inggris. */
const FIXTURE_EN: Readonly<Record<string, string>> = { shower: 'shower', kloset: 'toilet' };

export const GROUP_C = [ENG_009, ENG_006, ENG_012];
