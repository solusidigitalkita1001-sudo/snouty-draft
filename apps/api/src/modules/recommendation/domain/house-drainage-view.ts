/**
 * Pembuangan rumah di layar solusi (laporan pemilik 2026-10-12): jalur air kotor, air bekas,
 * ventilasi, dan sambungan tiap alat dari `computeHouseDrainage` — setiap angka dari hasil
 * hitungan, setiap baris menunjuk trace-nya. Digabung ke rekomendasi air bersih rumah ("Keduanya"),
 * atau berdiri sendiri bila yang diminta hanya pembuangan.
 */
import {
  applyAssumption,
  assumptionDescription,
  DRAIN_SIZES,
  type HouseDrainageResult,
} from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  type Assumption,
  type BomItem,
  type BomUnit,
  type Locale,
  type Provenance,
  type Recommendation,
  type SelectedProduct,
  type SystemLine,
} from '@snouty/shared-types';
import { pipePurchase, type StockLength } from './pipe-quantity.js';
import type { IdentifiedTrace } from './solution-view.js';

/** Pipa buangan memakai kelas gravitasi. */
export const DRAINAGE_FAMILY = 'PVC D';

function worst(traces: readonly IdentifiedTrace[]): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  return traces.reduce<Provenance>(
    (w, t) => (order.indexOf(t.provenance) > order.indexOf(w) ? t.provenance : w),
    'VERIFIED',
  );
}

/** Trace per bagian, urut seperti `computeHouseDrainage` menjalankannya. */
function parts(result: HouseDrainageResult, traces: readonly IdentifiedTrace[]) {
  // [beban, (cabang/stack?, ukuran) air kotor?, (cabang/stack?, ukuran) air bekas?, panjang?] —
  // urutan eksekusi `computeHouseDrainage`; ENG-604 hanya ada untuk bangunan bertingkat.
  let at = 1;
  const line = (): IdentifiedTrace[] => {
    const own: IdentifiedTrace[] = [];
    if (traces[at]?.ruleId === 'ENG-604') own.push(traces[at++]!);
    if (traces[at]?.ruleId === 'ENG-602') own.push(traces[at++]!);
    return own;
  };
  const load = traces.slice(0, 1);
  const soil = result.soil ? line() : [];
  const waste = result.waste ? line() : [];
  return { load, soil, waste };
}

const FIXTURE_LABEL = {
  water_closet: { id: 'kloset', en: 'toilet' },
  shower: { id: 'floor drain/shower', en: 'floor drain/shower' },
  lavatory: { id: 'wastafel', en: 'basin' },
  kitchen_sink: { id: 'bak cuci dapur', en: 'kitchen sink' },
} as const;

export function drainageSystemLines(
  result: HouseDrainageResult,
  traces: readonly IdentifiedTrace[],
  locale: Locale = DEFAULT_LOCALE,
): readonly SystemLine[] {
  const en = locale === 'en';
  const p = parts(result, traces);
  const lines: SystemLine[] = [];
  const line = (
    name: string,
    path: string,
    size: string,
    own: readonly IdentifiedTrace[],
    role: SystemLine['role'],
  ): SystemLine => ({
    name,
    path,
    size,
    reason: [...p.load, ...own].map((t) => t.explanation).join(' '),
    provenance: worst([...p.load, ...own]),
    traceIds: [...p.load, ...own].map((t) => t.id),
    role,
  });
  if (result.soil) {
    lines.push(
      line(
        en ? `${DRAINAGE_FAMILY} soil pipe` : `Pipa air kotor ${DRAINAGE_FAMILY}`,
        en ? 'Toilets → septic tank' : 'Kloset → septic tank',
        result.soil.size,
        p.soil,
        'main',
      ),
      line(
        en ? 'Soil vent pipe' : 'Pipa ventilasi air kotor',
        en ? 'Soil line → above the roof' : 'Jalur kloset → atas atap',
        result.soil.ventSize,
        p.soil,
        'branch',
      ),
    );
  }
  if (result.waste) {
    lines.push(
      line(
        en ? `${DRAINAGE_FAMILY} waste pipe` : `Pipa air bekas ${DRAINAGE_FAMILY}`,
        en
          ? 'Floor drains, basins, kitchen → drain or soakaway'
          : 'Floor drain, wastafel, dapur → saluran atau sumur resapan',
        result.waste.size,
        p.waste,
        'branch',
      ),
      line(
        en ? 'Waste vent pipe' : 'Pipa ventilasi air bekas',
        en ? 'Waste line → above the roof' : 'Jalur air bekas → atas atap',
        result.waste.ventSize,
        p.waste,
        'branch',
      ),
    );
  }
  const fixtures = result.fixtures
    .map((f) => `${f.count} ${FIXTURE_LABEL[f.fixture][en ? 'en' : 'id']} ${f.size}`)
    .join(' · ');
  const sizes = DRAIN_SIZES.filter((size) => result.fixtures.some((f) => f.size === size));
  lines.push({
    ...line(
      en ? 'Fixture drain connections' : 'Sambungan buangan tiap alat',
      fixtures,
      sizes.length === 1 ? sizes[0]! : `${sizes[0]}–${sizes.at(-1)}`,
      [...p.soil, ...p.waste],
      'fixture',
    ),
    reason: en
      ? 'Minimum connection per fixture: toilet as its soil line, floor drain/shower 2", kitchen sink 1½", basin 1¼".'
      : 'Sambungan minimum tiap alat: kloset mengikuti jalur air kotornya, floor drain/shower 2", bak cuci dapur 1½", wastafel 1¼".',
  });
  return lines;
}

export function drainageAssumptions(
  result: HouseDrainageResult,
  locale: Locale = DEFAULT_LOCALE,
): readonly Assumption[] {
  const en = locale === 'en';
  return [
    {
      text: en
        ? 'How the drainage is worked out: each fixture carries a drainage load, the loads are added per line, and each line takes the smallest pipe that can carry that load at a 2 % fall, never smaller than its largest fixture. Toilets drain to the septic tank, the rest to the drain or soakaway, each line with its own vent. ' +
          (result.lengths
            ? 'Each route length is estimated from the building size until the floor plan is known.'
            : 'The route length is not known yet, so the number of pipes is counted once the building size is given.')
        : 'Cara hitung pembuangannya: tiap alat punya beban buangan, bebannya dijumlah per jalur, lalu tiap jalur memakai pipa terkecil yang sanggup mengalirkan beban itu pada kemiringan 2 %, dan tidak lebih kecil dari alat terbesarnya. Kloset ke septic tank, sisanya ke saluran atau sumur resapan, masing-masing dengan ventilasi. ' +
          (result.lengths
            ? 'Panjang tiap jalur diperkirakan dari ukuran bangunan sampai denahnya ada.'
            : 'Panjang jalurnya belum diketahui, jadi jumlah batang dihitung setelah ukuran bangunannya disebut.'),
      fieldPath: '',
      ruleId: 'ENG-602',
    },
    ...result.appliedAssumptionIds.map((aid) => ({
      text: assumptionDescription(aid, locale),
      fieldPath: applyAssumption(aid).parameter,
      ruleId: 'ENG-601',
      assumptionId: aid,
    })),
  ];
}

/** Alat air bekas yang memang ada ("floor drain/shower dan bak cuci dapur"). */
function wasteFixtures(result: HouseDrainageResult, lang: 'id' | 'en'): string {
  const names = result.fixtures
    .filter((f) => f.fixture !== 'water_closet')
    .map((f) => FIXTURE_LABEL[f.fixture][lang]);
  const and = lang === 'en' ? 'and' : 'dan';
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`;
}

/** Satu kalimat ringkasan — angka dari hasil hitungan. */
export function drainageSentence(result: HouseDrainageResult, locale: Locale): string {
  const en = locale === 'en';
  const parts: string[] = [];
  if (result.soil) {
    parts.push(
      en
        ? `toilets drain to the septic tank through ${DRAINAGE_FAMILY} ${result.soil.size} (vent ${result.soil.ventSize})`
        : `kloset dibuang ke septic tank lewat ${DRAINAGE_FAMILY} ${result.soil.size} (ventilasi ${result.soil.ventSize})`,
    );
  }
  if (result.waste) {
    parts.push(
      en
        ? `${wasteFixtures(result, 'en')} through ${result.waste.size} (vent ${result.waste.ventSize})`
        : `${wasteFixtures(result, 'id')} lewat ${result.waste.size} (ventilasi ${result.waste.ventSize})`,
    );
  }
  if (parts.length === 0) return '';
  const joined = parts.join(en ? ', and ' : ', sedangkan ');
  return en ? `For drainage, ${joined}.` : `Untuk pembuangan, ${joined}.`;
}

/**
 * Gabungkan pembuangan ke rekomendasi rumah. `only` = yang diminta hanya pembuangan: jalur air
 * bersih tidak ditampilkan.
 */
/** Produk pipa buangan terpilih per jalur — sumber panjang batang baris material. */
export interface DrainStocks {
  readonly soil?: StockLength | null;
  readonly waste?: StockLength | null;
  readonly soilVent?: StockLength | null;
  readonly wasteVent?: StockLength | null;
}

/**
 * Material pembuangan dari perkiraan panjang ENG-603 (P16-60) — hanya bila ukuran rumah diketahui.
 * Jumlah beli memakai panjang batang produk PVC D terpilih per jalur.
 */
export function drainageBomFrom(
  result: HouseDrainageResult,
  traces: readonly IdentifiedTrace[],
  stocks: DrainStocks,
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const lengths = result.lengths;
  if (lengths === null) return [];
  const en = locale === 'en';
  const ids = traces.filter((t) => t.ruleId === 'ENG-603').map((t) => t.id);
  const provenance: Provenance = traces.some(
    (t) => t.ruleId === 'ENG-603' && t.provenance !== 'VERIFIED',
  )
    ? 'ASSUMED'
    : 'VERIFIED';
  const row = (size: string, netM: number | null, detail: string, stock: StockLength | null) => {
    if (netM === null) return null;
    const purchase = pipePurchase(netM, detail, stock, locale);
    const item: BomItem = {
      item: en ? `${DRAINAGE_FAMILY} pipe` : `Pipa ${DRAINAGE_FAMILY}`,
      size,
      ...(purchase.productId ? { productId: purchase.productId } : {}),
      quantity: purchase.quantity,
      unit: (en ? { batang: 'rods', meter: 'm' }[purchase.unit] : purchase.unit) as BomUnit,
      basis: purchase.basis,
      provenance,
      traceIds: ids,
    };
    return item;
  };
  return [
    result.soil &&
      row(
        result.soil.size,
        lengths.soilNetM,
        en ? 'soil line' : 'jalur air kotor',
        stocks.soil ?? null,
      ),
    result.waste &&
      row(
        result.waste.size,
        lengths.wasteNetM,
        en ? 'waste line' : 'jalur air bekas',
        stocks.waste ?? null,
      ),
    result.soil &&
      row(
        result.soil.ventSize,
        lengths.soilVentNetM,
        en ? 'soil line vent' : 'ventilasi air kotor',
        stocks.soilVent ?? null,
      ),
    result.waste &&
      row(
        result.waste.ventSize,
        lengths.wasteVentNetM,
        en ? 'waste line vent' : 'ventilasi air bekas',
        stocks.wasteVent ?? null,
      ),
  ].filter((r): r is BomItem => Boolean(r));
}

export function withHouseDrainage(
  base: Recommendation,
  result: HouseDrainageResult,
  traces: readonly IdentifiedTrace[],
  products: readonly SelectedProduct[],
  only: boolean,
  locale: Locale = DEFAULT_LOCALE,
  stocks: DrainStocks = {},
): Recommendation {
  const sentence = drainageSentence(result, locale);
  const lines = drainageSystemLines(result, traces, locale);
  const bom = drainageBomFrom(result, traces, stocks, locale);
  const en = locale === 'en';
  if (only) {
    return {
      ...base,
      headline: en
        ? `Drainage: soil ${result.soil?.size ?? '-'}, waste ${result.waste?.size ?? '-'}`
        : `Pembuangan: air kotor ${result.soil?.size ?? '-'}, air bekas ${result.waste?.size ?? '-'}`,
      body: `${sentence} ${en ? 'Initial estimate, not a final design.' : 'Perkiraan awal, bukan desain final.'}`,
      stats: {
        ...base.stats,
        mainSize: result.soil?.size ?? result.waste?.size ?? base.stats.mainSize,
        fixtureConnectionSize: result.waste?.size ?? base.stats.fixtureConnectionSize,
        branchCount: lines.length,
      },
      systemLines: lines,
      products,
      bom,
      assumptions: drainageAssumptions(result, locale),
      overallProvenance: worstOf(base.overallProvenance, result.overallProvenance),
    };
  }
  return {
    ...base,
    body: `${base.body} ${sentence}`.trim(),
    systemLines: [...base.systemLines, ...lines],
    bom: [...base.bom, ...bom],
    products: [
      ...base.products,
      // Satu SKU boleh punya beberapa peruntukan (TC-H-05); yang persis sama tidak diulang.
      ...products.filter(
        (p) => !base.products.some((b) => b.productId === p.productId && b.purpose === p.purpose),
      ),
    ],
    assumptions: [...base.assumptions, ...drainageAssumptions(result, locale)],
    overallProvenance: worstOf(base.overallProvenance, result.overallProvenance),
  };
}

function worstOf(a: Provenance, b: Provenance): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
