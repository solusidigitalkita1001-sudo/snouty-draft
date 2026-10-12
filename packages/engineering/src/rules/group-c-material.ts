/**
 * Kelompok C — material. docs/ENGINEERING_RULES.md §3.
 *
 * ENG-009 (rumus material prototipe "2 + lantai batang", "3 × kamar mandi elbow", reducer
 * mainSize→3/4") dihapus 2026-10-12 (temuan laporan SNTY-2026-10-0002): angkanya dikarang tanpa
 * panjang jalur. Material rumah kini panjang jalur ÷ panjang batang katalog (lapisan tampilan API).
 */

import { localized, type RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

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

export const GROUP_C = [ENG_006, ENG_012];
