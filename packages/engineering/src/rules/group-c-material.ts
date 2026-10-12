/**
 * Kelompok C — material. docs/ENGINEERING_RULES.md §3.
 *
 * ENG-009 (rumus material prototipe "2 + lantai batang", "3 × kamar mandi elbow", reducer
 * mainSize→3/4") dihapus 2026-10-12 (temuan laporan SNTY-2026-10-0002): angkanya dikarang tanpa
 * panjang jalur. Material rumah kini panjang jalur ÷ panjang batang katalog (lapisan tampilan API).
 * ENG-006 ("kuantitas di lapangan berbeda 10–15 %") dihapus 2026-10-12 (TC-H-01): tercetak di dasar
 * perhitungan tetapi tidak mengubah angka apa pun.
 */

import { localized, type RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

/**
 * ENG-012 · Isi kamar mandi.
 *
 * Dasar "kamar mandi = 2 titik" pada ENG-001 dan beban kloset + shower di ENG-701/601; keduanya
 * harus divalidasi bersama, karena kalau isi kamar mandi berbeda, hitungannya ikut salah.
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

export const GROUP_C = [ENG_012];
