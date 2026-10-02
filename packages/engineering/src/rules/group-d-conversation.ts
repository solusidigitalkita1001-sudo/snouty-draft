/**
 * Kelompok D — alur percakapan. docs/ENGINEERING_RULES.md §3.
 *
 * Keduanya bukan aturan teknik dalam arti sempit, tetapi diberi ID karena memengaruhi
 * data apa yang tersedia saat perhitungan berjalan — dan karena nilainya disajikan
 * kepada pengguna sebagai asumsi, keduanya harus melewati proses validasi yang sama.
 *
 * Implementasinya sudah hidup di Context Engine (Fase 4: `clarification.ts` dan
 * `requirement-defaults.ts`). Entri di sini adalah **pencatatan registry**, supaya
 * keduanya ikut terdaftar sebagai aturan yang menunggu validasi ahli — bukan salinan
 * kedua yang bisa menyimpang. Nilainya sengaja sama dan diuji di kedua tempat.
 */

import type { RuleVersion } from '../rule.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

/** ENG-007 · Urutan prioritas klarifikasi (board layar 03 memakai urutan berbeda — OQ-23). */
export const ENG_007: RuleVersion<Record<string, never>, { readonly order: readonly string[] }> = {
  ruleId: 'ENG-007',
  version: 1,
  category: 'conversation',
  parseInput: () => ({}),
  compute: () => ({
    order: ['water.source', 'water.installationType', 'building.floors', 'fixtures.bathrooms'],
  }),
  sourceReference: 'Prototipe baru SNOUTY (OQ-23: board layar 03 berbeda)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'sumber air lebih dulu — tanpa itu tidak ada yang bisa dihitung',
      input: {},
      expected: {
        order: ['water.source', 'water.installationType', 'building.floors', 'fixtures.bathrooms'],
      },
    },
  ],
  explain: (_input, output) => `Urutan pertanyaan: ${output.order.join(' → ')}.`,
};

/** ENG-014 · Default "Belum tahu". */
export const ENG_014: RuleVersion<
  Record<string, never>,
  { readonly defaults: readonly { readonly field: string; readonly value: string }[] }
> = {
  ruleId: 'ENG-014',
  version: 1,
  category: 'conversation',
  parseInput: () => ({}),
  compute: () => ({
    defaults: [
      { field: 'water.source', value: 'rooftop_tank' },
      { field: 'water.installationType', value: 'clean_water' },
    ],
  }),
  sourceReference: 'Prototipe baru SNOUTY; disajikan kepada pengguna sebagai asumsi',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'toren atap dan air bersih',
      input: {},
      expected: {
        defaults: [
          { field: 'water.source', value: 'rooftop_tank' },
          { field: 'water.installationType', value: 'clean_water' },
        ],
      },
    },
  ],
  explain: () =>
    'Bila sumber air atau jenis instalasi tidak diberikan, sistem memakai toren atap dan air bersih, ' +
    'dan menandainya sebagai asumsi.',
};

export const GROUP_D = [ENG_007, ENG_014];
