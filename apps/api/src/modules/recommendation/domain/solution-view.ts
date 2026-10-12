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
/** Isi satu cabang dalam kata-kata: "2 kamar mandi", "1 kamar mandi + 1 bak cuci dapur". */
function branchContent(
  b: { readonly bathrooms: number; readonly basins: number; readonly kitchens: number },
  en: boolean,
): string {
  return [
    b.bathrooms > 0
      ? `${b.bathrooms} ${en ? (b.bathrooms > 1 ? 'bathrooms' : 'bathroom') : 'kamar mandi'}`
      : '',
    b.basins > 0 ? `${b.basins} ${en ? (b.basins > 1 ? 'basins' : 'basin') : 'wastafel'}` : '',
    b.kitchens > 0 ? `${b.kitchens} ${en ? 'kitchen sink' : 'bak cuci dapur'}` : '',
  ]
    .filter(Boolean)
    .join(' + ');
}

/**
 * Cabang per ukuran (ENG-707 + ENG-102 per cabang, temuan laporan 0009). Satu ukuran → satu baris
 * "Cabang" seperti sebelumnya; beberapa ukuran → satu baris per ukuran, dinamai menurut isinya.
 */
function branchLines(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale,
): readonly SystemLine[] {
  const en = locale === 'en';
  const fill = traces.find((t) => t.ruleId === 'ENG-707');
  const sizing = traces.filter((t) => t.ruleId === 'ENG-102');
  const groups = solution.branchGroups;
  return groups.map((group) => {
    const own = sizing.filter((t) => (t.output as { mainSize?: string }).mainSize === group.size);
    const ids = [...(fill ? [fill.id] : []), ...own.map((t) => t.id)];
    const contents = [...new Set(group.branches.map((b) => branchContent(b, en)))].join(' / ');
    const single = groups.length === 1;
    return {
      name: single ? (en ? 'Branch' : 'Cabang') : en ? `Branch: ${contents}` : `Cabang ${contents}`,
      path: single
        ? en
          ? `Main → water outlets (${group.count} branches)`
          : `Pipa utama → titik air (${group.count} cabang)`
        : en
          ? `Main → ${contents} (${group.count} branches)`
          : `Pipa utama → ${contents} (${group.count} cabang)`,
      size: group.size,
      reason: [fill?.explanation ?? '', own[0]?.explanation ?? ''].filter(Boolean).join(' '),
      provenance: provenanceFor(traces, ids),
      traceIds: ids,
      role: 'branch' as const,
    };
  });
}

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
  const fixtureTraces = traceIdsFor(traces, 'ENG-005');
  const sourceTraces = traceIdsFor(traces, 'ENG-702', 'ENG-204', 'ENG-206', 'ENG-703');
  const supply = solution.supply;
  const num = (n: number) => n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

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
    ...branchLines(solution, traces, locale),
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

  // Toren atap: pipa pengisi dari meteran / pompa di depan tanah (ENG-706, P16-63).
  if (solution.tankFill !== null) {
    const fillTraces = traceIdsFor(traces, 'ENG-706');
    lines.push({
      name: en ? 'Tank fill pipe' : 'Pipa pengisi toren',
      path: en ? 'Meter / pump → roof tank' : 'Meteran / pompa → toren atap',
      size: solution.tankFill.size,
      reason: explanationFor(traces, 'ENG-706'),
      provenance: provenanceFor(traces, fillTraces),
      traceIds: fillTraces,
      role: 'main',
    });
  }

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
            name: en
              ? 'Pressure needed at the water meter'
              : 'Tekanan yang dibutuhkan di meteran PDAM',
            size: `${num(supply.requiredSourcePressureBar)} bar`,
            reason: en
              ? `${explanationFor(traces, 'ENG-204')} If the mains pressure is lower, feed a tank first and pump from it.`
              : `${explanationFor(traces, 'ENG-204')} Kalau tekanan PDAM di bawah itu, tampung dulu di toren lalu pakai pompa.`,
          }
        : pump
          ? {
              name: en ? 'Pump (duty point)' : 'Pompa (titik kerja)',
              size: `${num(pump.flowM3h)} ${en ? 'm³/h' : 'm³/jam'} @ ${num(pump.headM)} m`,
              reason:
                `${explanationFor(traces, 'ENG-204')} ${explanationFor(traces, 'ENG-206')}`.trim(),
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

/** Produk katalog terpilih per jalur rumah — sumber panjang batang dan identitas baris material. */
export interface HouseStocks {
  readonly branch?: StockLength | null;
  readonly fixture?: StockLength | null;
  /**
   * Fitting tempat cabang keluar per ukuran cabang (tee sama sisi, tee reduksi, atau tee + reducer).
   * Kosong → satu baris tee tanpa `productId` (jumlahnya tetap diketahui).
   */
  readonly teeFor?: (branchSize: string) => readonly TeeBom[];
  /** Produk cabang per ukuran (cabang bisa berbeda ukuran, ENG-707). */
  readonly branchFor?: (size: string) => StockLength | null;
  /** Pipa pengisi toren atap (ENG-706). */
  readonly fill?: StockLength | null;
}

/**
 * Material rumah. Pipa utama dari jalur yang disebut atau dari ukuran rumah; cabang, sambungan ke
 * alat, dan tee dari perkiraan ENG-704 — hanya bila ukuran rumah diketahui (keputusan pemilik
 * 2026-10-12, P16-60: dihitung dengan rumus baku bertanda asumsi, bukan "menyusul"). Jumlah beli
 * memakai panjang batang produk katalog terpilih per jalur.
 */
/** Satu fitting cabang untuk BOM. */
export interface TeeBom {
  readonly productId: string;
  readonly kind: 'tee' | 'reducing_tee' | 'reducer';
  /** "1 1/4"" atau "1 1/4" × 3/4"". */
  readonly size: string;
}

export function bomItemsFrom(
  solution: SolutionResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
  stock: StockLength | null = null,
  stocks: HouseStocks = {},
): readonly BomItem[] {
  if (solution.mainRunNetM === null) return [];
  const en = locale === 'en';
  const ids = traceIdsFor(traces, 'ENG-702');
  const pipeRow = (
    size: string,
    netM: number,
    detail: string,
    rowStock: StockLength | null,
    rowIds: readonly string[],
  ): BomItem => {
    const purchase = pipePurchase(netM, detail, rowStock, locale);
    return {
      item: bomItemName('Pipa PVC AW', locale),
      size,
      ...(purchase.productId ? { productId: purchase.productId } : {}),
      quantity: purchase.quantity,
      unit: bomUnitLabel(purchase.unit, locale),
      basis: purchase.basis,
      provenance: provenanceFor(traces, rowIds),
      traceIds: rowIds,
    };
  };
  const rows: BomItem[] = [
    pipeRow(
      solution.mainSize,
      solution.mainRunNetM,
      solution.supply.routeBasis === 'stated'
        ? en
          ? 'the stated run'
          : 'jalur yang disebut'
        : en
          ? 'house length + width and the height to the highest outlet'
          : 'panjang + lebar bangunan dan beda tinggi ke titik air tertinggi',
      stock,
      ids,
    ),
  ];

  if (solution.tankFill !== null) {
    rows.push(
      pipeRow(
        solution.tankFill.size,
        solution.tankFill.netM,
        en
          ? 'tank fill: yard + along the building + up to the tank'
          : 'pengisi toren: halaman + sepanjang bangunan + naik ke toren',
        stocks.fill ?? null,
        traceIdsFor(traces, 'ENG-706'),
      ),
    );
  }

  const layout = solution.branchLayout;
  if (layout === null) return rows;
  const layoutIds = traceIdsFor(traces, 'ENG-704');
  rows.push(
    ...layout.bySize.map((branch) =>
      pipeRow(
        branch.size,
        branch.netM,
        en
          ? `${branch.count} branches × building length`
          : `${branch.count} cabang × panjang bangunan`,
        stocks.branchFor?.(branch.size) ?? stocks.branch ?? null,
        layoutIds,
      ),
    ),
    pipeRow(
      solution.fixtureConnectionSize,
      layout.fixtureNetM,
      en
        ? `${solution.outletCount} outlets × connection length`
        : `${solution.outletCount} titik air × panjang sambungan`,
      stocks.fixture ?? null,
      layoutIds,
    ),
  );
  // Sambungan cabang per ukuran cabang: satu tee (sama sisi atau reduksi), atau tee + reducer, per
  // cabang (temuan laporan 0009). Tanpa produk katalog jumlahnya tetap diketahui.
  const ITEM: Readonly<Record<TeeBom['kind'], { id: string; en: string }>> = {
    tee: { id: 'Tee cabang', en: 'Branch tee' },
    reducing_tee: { id: 'Tee reduksi cabang', en: 'Reducing branch tee' },
    reducer: { id: 'Reducer cabang', en: 'Branch reducer' },
  };
  for (const branch of layout.bySize) {
    const fittings = stocks.teeFor?.(branch.size) ?? [];
    const basis = en
      ? `One per branch on the main line: ${branch.count} branches of ${branch.size}.`
      : `Satu per cabang di pipa utama: ${branch.count} cabang ${branch.size}.`;
    const fitRows: BomItem[] =
      fittings.length > 0
        ? fittings.map((f) => ({
            item: en ? ITEM[f.kind].en : ITEM[f.kind].id,
            size: f.size,
            productId: f.productId,
            quantity: branch.count,
            unit: 'pcs',
            basis,
            provenance: provenanceFor(traces, layoutIds),
            traceIds: layoutIds,
          }))
        : [
            {
              item: en ? ITEM.tee.en : ITEM.tee.id,
              size:
                branch.size === solution.mainSize
                  ? solution.mainSize
                  : `${solution.mainSize} × ${branch.size}`,
              quantity: branch.count,
              unit: 'pcs',
              basis,
              provenance: provenanceFor(traces, layoutIds),
              traceIds: layoutIds,
            },
          ];
    rows.push(...fitRows);
  }
  return rows;
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
        ? 'The building size is not known yet, so pipe quantities are not counted; give the building length × width (and the land size if it is larger) to get them.'
        : 'Ukuran bangunan belum diketahui, jadi jumlah pipanya belum dihitung; isi panjang × lebar bangunan (dan ukuran tanah bila lebih luas) supaya bisa dihitung.',
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
    solution.floorHeightM,
    solution.maxOutletsPerBranch,
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
    ...solution.branchGroups.map((g) => g.size),
    solution.fixtureConnectionSize,
    ...bom.map((item) => item.size),
  ];
}
