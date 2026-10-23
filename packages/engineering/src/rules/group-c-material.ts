/**
 * Kelompok C — material. docs/ENGINEERING_RULES.md §3.
 *
 * ENG-009 (rumus material prototipe "2 + lantai batang", "3 × kamar mandi elbow", reducer
 * mainSize→3/4") dihapus 2026-10-12 (temuan laporan SNTY-2026-10-0002): angkanya dikarang tanpa
 * panjang jalur. Material rumah kini panjang jalur ÷ panjang batang katalog (lapisan tampilan API).
 * ENG-006 ("kuantitas di lapangan berbeda 10–15 %") dihapus 2026-10-12 (TC-H-01): tercetak di dasar
 * perhitungan tetapi tidak mengubah angka apa pun.
 */

import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';

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

// ── ENG-015 · Sok sambungan antar batang pipa ──────────────────────────────
//
// Masukan Leo (2026-10-22): "ngitungnya pipa sisa itu di asumsikan bisa langsung nyambung ya?,
// kan butuh socket buat nyambungnya lagi". Benar — jumlah batang dihitung dari panjang jalur
// dibagi panjang batang, tetapi batang yang disambung ujung ke ujung butuh sok di tiap
// sambungannya, dan sampai sekarang jumlahnya ditulis "dihitung saat pemasangan".
//
// Satu jalur menerus sepanjang L yang dirakit dari batang sepanjang R membutuhkan
// ceil(L / R) − 1 sambungan pipa-ke-pipa. Fitting di jalur (elbow, tee) punya bell-nya sendiri
// dan tidak dihitung lagi di sini; karena potongan tidak selalu jatuh pas di fitting, angka ini
// perkiraan atas — aman untuk BOQ perencanaan, dan bisa berkurang di lapangan.

/** Satu kelompok jalur menerus dengan panjang bersih yang sama. */
export interface PipeRunGroup {
  /** Panjang bersih satu jalur menerus (m). */
  readonly lengthM: number;
  /** Berapa jalur sepanjang itu. */
  readonly count: number;
}

export interface PipeJointInput {
  readonly runs: readonly PipeRunGroup[];
  /** Panjang satu batang dari katalog (m). */
  readonly stockLengthM: number;
}

export interface PipeJointResult {
  /** Sambungan pipa-ke-pipa per satu jalur, per kelompok. */
  readonly perRun: readonly number[];
  /** Total sok yang dibutuhkan. */
  readonly sockets: number;
}

/** Sambungan batang untuk satu jalur menerus; dipakai juga di luar engine (BOQ). */
export function pipeJointsPerRun(lengthM: number, stockLengthM: number): number {
  if (stockLengthM <= 0) return 0;
  return Math.max(0, Math.ceil(lengthM / stockLengthM) - 1);
}

export const ENG_015: RuleVersion<PipeJointInput, PipeJointResult> = {
  ruleId: 'ENG-015',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const list = o['runs'];
    if (!Array.isArray(list)) throw new RuleInputError('ENG-015', 'runs harus daftar');
    return {
      runs: list.map((raw_, index) => {
        const r = (raw_ ?? {}) as Record<string, unknown>;
        return {
          lengthM: requireNumber('ENG-015', `runs[${index}].lengthM`, r['lengthM'], {
            min: 0,
            max: 100_000,
          }),
          count: requireInt('ENG-015', `runs[${index}].count`, r['count'], { min: 0, max: 5_000 }),
        };
      }),
      stockLengthM: requireNumber('ENG-015', 'stockLengthM', o['stockLengthM'], {
        min: 0.5,
        max: 100,
      }),
    };
  },
  compute: (i) => {
    const perRun = i.runs.map((r) => pipeJointsPerRun(r.lengthM, i.stockLengthM));
    return {
      perRun,
      sockets: i.runs.reduce((sum, r, index) => sum + r.count * perRun[index]!, 0),
    };
  },
  sourceReference:
    'Praktik lapangan: tiap sambungan pipa-ke-pipa memakai satu sok; sambungan per jalur = ceil(panjang jalur ÷ panjang batang) − 1',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'jalur utama 27,5 m dari batang 4 m → 6 sok',
      input: { runs: [{ lengthM: 27.5, count: 1 }], stockLengthM: 4 },
      expected: { perRun: [6], sockets: 6 },
    },
    {
      name: '2 cabang 12 m dari batang 4 m → 2 sok per cabang',
      input: { runs: [{ lengthM: 12, count: 2 }], stockLengthM: 4 },
      expected: { perRun: [2], sockets: 4 },
    },
    {
      name: 'sambungan ke alat 1,5 m lebih pendek dari batang → tanpa sok',
      input: { runs: [{ lengthM: 1.5, count: 6 }], stockLengthM: 4 },
      expected: { perRun: [0], sockets: 0 },
    },
  ],
  explain: (i, o, locale) => {
    const parts = i.runs
      .map((r, index) =>
        locale === 'en'
          ? `${r.count} × ${r.lengthM} m → ${o.perRun[index]} joints each`
          : `${r.count} jalur ${r.lengthM} m → ${o.perRun[index]} sambungan tiap jalur`,
      )
      .join('; ');
    return localized(locale, {
      id: `Batang ${i.stockLengthM} m yang disambung ujung ke ujung butuh satu sok tiap sambungan: ${parts} — ${o.sockets} sok. Fitting di jalur punya sambungannya sendiri dan tidak dihitung lagi.`,
      en: `Rods of ${i.stockLengthM} m joined end to end need one socket per joint: ${parts} — ${o.sockets} sockets. Fittings on the route have their own joints and are not counted again.`,
    });
  },
};

export const GROUP_C = [ENG_012, ENG_015];
