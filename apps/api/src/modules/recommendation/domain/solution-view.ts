/**
 * Menerjemahkan hasil engine + trace menjadi apa yang dilihat pengguna di layar 06.
 * docs/DOMAIN_MODEL.md §7. **Fungsi murni.**
 *
 * Invarian T-1 ditegakkan di sini: setiap `SystemLine` dan `BomItem` membawa
 * `traceIds`, dan kolom "DASAR PERHITUNGAN" (`basis`) diambil dari `explanation`
 * trace — **bukan** dari prosa LLM. Penjelasan dan perhitungan karena itu tidak bisa
 * berbeda: keduanya keluar dari aturan yang sama.
 */

import type {
  Assumption,
  BomItem,
  BomUnit,
  Provenance,
  RecommendationStats,
  SystemLine,
} from '@snouty/shared-types';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import {
  applyAssumption,
  assumptionDescription,
  type CalculationTrace,
  type SolutionResult,
} from '@snouty/engineering';
import { pipePurchase, type StockLength } from './pipe-quantity.js';

/** Trace yang sudah punya id basis data — pemanggil memberi id sebelum memakai ini. */
export interface IdentifiedTrace extends CalculationTrace {
  readonly id: string;
}

const BOM_ITEMS_EN: Readonly<Record<string, string>> = {
  'Katup / stop kran': 'Valve / stop cock',
  'Sok drat / water mur (pipa tegak kuras)':
    'Threaded socket / bulkhead fitting (vertical drain pipe)',
  'Lem PVC': 'PVC solvent cement',
};
const BOM_UNITS_EN: Readonly<Record<string, string>> = {
  batang: 'rods',
  kaleng: 'cans',
  meter: 'm',
};

/** Nama baris BOM dari engine (Indonesia) → bahasa tampilan; nama tak dikenal lewat apa adanya. */
export function bomItemName(item: string, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'id') return item;
  const pipe = /^Pipa (.+)$/.exec(item);
  return pipe ? `${pipe[1]!} pipe` : (BOM_ITEMS_EN[item] ?? item);
}

/**
 * Satuan BOM. `BomUnit` di shared-types masih union Indonesia — cast di sini sampai tipenya
 * dilebarkan; klien hanya merendernya sebagai teks.
 */
export function bomUnitLabel(unit: string, locale: Locale = DEFAULT_LOCALE): BomUnit {
  return (locale === 'id' ? unit : (BOM_UNITS_EN[unit] ?? unit)) as BomUnit;
}

function traceIdsFor(traces: readonly IdentifiedTrace[], ...ruleIds: string[]): readonly string[] {
  return traces.filter((trace) => ruleIds.includes(trace.ruleId)).map((trace) => trace.id);
}

function explanationFor(traces: readonly IdentifiedTrace[], ruleId: string): string {
  return traces.find((trace) => trace.ruleId === ruleId)?.explanation ?? '';
}

/** Provenance paling lemah di antara trace yang mendasari sebuah baris. */
function provenanceFor(traces: readonly IdentifiedTrace[], ids: readonly string[]): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  let worst: Provenance = 'VERIFIED';
  for (const trace of traces) {
    if (!ids.includes(trace.id)) continue;
    if (order.indexOf(trace.provenance) > order.indexOf(worst)) worst = trace.provenance;
  }
  return worst;
}

export function statsFrom(solution: SolutionResult, productCount: number): RecommendationStats {
  return {
    outletCount: solution.outletCount,
    mainSize: solution.mainSize,
    branchCount: solution.branchCount,
    fixtureConnectionSize: solution.fixtureConnectionSize,
    productCount,
  };
}

/** Baris tabel "Rekomendasi Sistem" (layar 06). */
export function systemLinesFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const mainTraces = traceIdsFor(
    traces,
    'ENG-001',
    'ENG-701',
    'ENG-702',
    'ENG-205',
    'ENG-201',
    'ENG-202',
    'ENG-203',
    'ENG-204',
    'ENG-703',
  );
  const branchTraces = traceIdsFor(traces, 'ENG-003', 'ENG-102');
  const fixtureTraces = traceIdsFor(traces, 'ENG-005');
  const sourceTraces = traceIdsFor(traces, 'ENG-702', 'ENG-204', 'ENG-206', 'ENG-703');
  const supply = solution.supply;
  const num = (n: number) =>
    n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

  const lines: SystemLine[] = [
    {
      name: en ? 'Main distribution pipe' : 'Pipa distribusi utama',
      path: en ? 'Source → highest outlet' : 'Sumber → titik air tertinggi',
      size: solution.mainSize,
      reason: [
        explanationFor(traces, 'ENG-701'),
        explanationFor(traces, 'ENG-702'),
        explanationFor(traces, 'ENG-205'),
      ]
        .filter(Boolean)
        .join(' '),
      provenance: provenanceFor(traces, mainTraces),
      traceIds: mainTraces,
      role: 'main',
    },
    {
      name: en ? 'Branch' : 'Cabang',
      path: en
        ? `Main → water outlets (${solution.branchCount} branches)`
        : `Pipa utama → titik air (${solution.branchCount} cabang)`,
      size: solution.branchSize,
      reason: [explanationFor(traces, 'ENG-003'), explanationFor(traces, 'ENG-102')]
        .filter(Boolean)
        .join(' '),
      provenance: provenanceFor(traces, branchTraces),
      traceIds: branchTraces,
      role: 'branch',
    },
    {
      name: en ? 'Fixture connection' : 'Sambungan fixture',
      path: en ? 'Branch → fixture' : 'Cabang → fixture',
      size: solution.fixtureConnectionSize,
      reason: explanationFor(traces, 'ENG-005'),
      provenance: provenanceFor(traces, fixtureTraces),
      traceIds: fixtureTraces,
      role: 'fixture',
    },
  ];

  // Sumber air: yang perlu disiapkan supaya titik tertinggi mendapat tekanan.
  const pump = supply.main.pumpDuty;
  const source =
    supply.gravityResidualBar !== null
      ? {
          name: en ? 'Pressure from the roof tank' : 'Tekanan dari toren atap',
          size: `${num(supply.gravityResidualBar)} bar`,
          reason: explanationFor(traces, 'ENG-703'),
        }
      : supply.requiredSourcePressureBar !== null
        ? {
            name: en ? 'Pressure needed at the water meter' : 'Tekanan yang dibutuhkan di meteran PDAM',
            size: `${num(supply.requiredSourcePressureBar)} bar`,
            reason: en
              ? `${explanationFor(traces, 'ENG-204')} If the mains pressure is lower, feed a tank first and pump from it.`
              : `${explanationFor(traces, 'ENG-204')} Kalau tekanan PDAM di bawah itu, tampung dulu di toren lalu pakai pompa.`,
          }
        : pump
          ? {
              name: en ? 'Pump (duty point)' : 'Pompa (titik kerja)',
              size: `${num(pump.flowM3h)} ${en ? 'm³/h' : 'm³/jam'} @ ${num(pump.headM)} m`,
              reason: `${explanationFor(traces, 'ENG-204')} ${explanationFor(traces, 'ENG-206')}`.trim(),
            }
          : null;
  if (source !== null) {
    lines.push({
      ...source,
      path: en ? 'Water source' : 'Sumber air',
      provenance: provenanceFor(traces, sourceTraces),
      traceIds: sourceTraces,
      role: 'fitting',
    });
  }
  return lines;
}

/**
 * Material rumah. Hanya pipa utama yang punya panjang — dari jalur yang disebut atau dari ukuran
 * rumah — dan jumlah belinya memakai panjang batang produk katalog terpilih. Cabang, sambungan,
 * dan fitting mengikuti tata letak, jadi tidak diberi angka (koreksi 2026-10-12: rumus prototipe
 * "2 + lantai batang", "3 × kamar mandi elbow" dikarang tanpa panjang jalur).
 */
export function bomItemsFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
  stock: StockLength | null = null,
): readonly BomItem[] {
  if (solution.mainRunNetM === null) return [];
  const en = locale === 'en';
  const ids = traceIdsFor(traces, 'ENG-702');
  const purchase = pipePurchase(
    solution.mainRunNetM,
    solution.supply.routeBasis === 'stated'
      ? en
        ? 'the stated run'
        : 'jalur yang disebut'
      : en
        ? 'house length + width and the height to the highest outlet'
        : 'panjang + lebar rumah dan beda tinggi ke titik air tertinggi',
    stock,
    locale,
  );
  return [
    {
      item: bomItemName('Pipa PVC AW', locale),
      size: solution.mainSize,
      quantity: purchase.quantity,
      unit: bomUnitLabel(purchase.unit, locale),
      basis: purchase.basis,
      provenance: provenanceFor(traces, ids),
      traceIds: ids,
    },
  ];
}

/**
 * Daftar asumsi. `fieldPath` membuat "Perbaiki asumsi ini →" bisa membuka field yang
 * tepat; tanpa itu tombol tersebut hanya bisa melempar pengguna ke awal percakapan.
 */
export function assumptionsFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  requirementAssumptions: readonly Assumption[],
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
  const en = locale === 'en';
  const fromRules: Assumption[] = [
    {
      text: en
        ? 'How it is worked out: every fixture adds to the supply load, the load gives the peak flow (not every tap runs at once), and the main pipe is the smallest size that keeps the water speed and pressure loss within limits over the route from the source to the highest outlet. For a roof tank the pressure left at the highest outlet is checked too.'
        : 'Cara hitungnya: tiap alat menambah beban suplai, beban itu memberi debit puncak (tidak semua keran dibuka bersamaan), lalu pipa utama dipilih ukuran terkecil yang kecepatan air dan kehilangan tekanannya masih dalam batas sepanjang jalur dari sumber ke titik air tertinggi. Untuk toren atap, sisa tekanan di titik tertinggi ikut dicek.',
      fieldPath: '',
      ruleId: 'ENG-701',
    },
  ];

  // Tinggi lantai hanya menjadi asumsi bila ENG-004 benar-benar berjalan.
  if (traces.some((trace) => trace.ruleId === 'ENG-004')) {
    fromRules.push({
      text: explanationFor(traces, 'ENG-004'),
      fieldPath: 'building.floorHeightM',
      ruleId: 'ENG-004',
    });
  }

  if (solution.mainRunNetM === null) {
    fromRules.push({
      text: en
        ? 'The house size is not known yet, so pipe quantities are not counted; tell me the length × width of the house to get them.'
        : 'Ukuran rumah belum diketahui, jadi jumlah pipanya belum dihitung; sebutkan panjang × lebar rumahnya supaya bisa dihitung.',
      fieldPath: 'building.dimensions',
      ruleId: 'ENG-702',
    });
  }

  for (const id of solution.appliedAssumptionIds) {
    fromRules.push({
      text: assumptionDescription(id, locale),
      fieldPath: applyAssumption(id).parameter,
      ruleId: 'ENG-701',
      assumptionId: id,
    });
  }

  // Asumsi kebutuhan (dari Context Engine) lebih dulu: itu yang pengguna kenali
  // sebagai jawabannya sendiri, dan yang paling mungkin ingin diperbaiki.
  return [...requirementAssumptions, ...fromRules];
}

/** Semua angka yang sah muncul di prosa — masukan pemeriksa REC-1. */
export function allowedNumbersFrom(
  stats: RecommendationStats,
  bom: readonly BomItem[],
  solution: SolutionResult,
): readonly number[] {
  const s = solution.supply;
  return [
    stats.outletCount,
    stats.branchCount,
    stats.productCount,
    solution.loadUnits,
    solution.floorHeightM,
    solution.maxOutletsPerBranch,
    solution.variancePercent.min,
    solution.variancePercent.max,
    solution.targetVelocityMs.min,
    solution.targetVelocityMs.max,
    s.wsfu,
    Math.round(s.peakFlowLs * 100) / 100,
    s.routeLengthM,
    s.main.velocityMs,
    s.main.frictionLossM,
    s.main.totalDynamicHeadM,
    ...(s.gravityResidualBar !== null ? [s.gravityResidualBar] : []),
    ...(s.requiredSourcePressureBar !== null ? [s.requiredSourcePressureBar] : []),
    ...solution.floorsPlan.map((floor) => floor.floor),
    ...solution.floorsPlan.map((floor) => floor.elevationM),
    ...bom.map((item) => item.quantity),
  ];
}

/** Semua label ukuran yang sah muncul di prosa. */
export function allowedSizesFrom(
  solution: SolutionResult,
  bom: readonly BomItem[],
): readonly string[] {
  return [
    solution.mainSize,
    solution.branchSize,
    solution.fixtureConnectionSize,
    ...bom.map((item) => item.size),
  ];
}
