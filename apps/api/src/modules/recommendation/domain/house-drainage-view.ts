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
  type Locale,
  type Provenance,
  type Recommendation,
  type SelectedProduct,
  type SystemLine,
} from '@snouty/shared-types';
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
  let i = 1;
  const soil = result.soil ? traces.slice(i, ++i) : [];
  const waste = result.waste ? traces.slice(i, ++i) : [];
  return { load: traces.slice(0, 1), soil, waste };
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
        ? 'How the drainage is worked out: each fixture carries a drainage load, the loads are added per line, and each line takes the smallest pipe that can carry that load at a 2 % fall, never smaller than its largest fixture. Toilets drain to the septic tank, the rest to the drain or soakaway, each line with its own vent. The route length is not known yet, so the number of pipes is counted once the layout is known.'
        : 'Cara hitung pembuangannya: tiap alat punya beban buangan, bebannya dijumlah per jalur, lalu tiap jalur memakai pipa terkecil yang sanggup mengalirkan beban itu pada kemiringan 2 %, dan tidak lebih kecil dari alat terbesarnya. Kloset ke septic tank, sisanya ke saluran atau sumur resapan, masing-masing dengan ventilasi. Panjang jalurnya belum diketahui, jadi jumlah batang dihitung setelah denahnya ada.',
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
export function withHouseDrainage(
  base: Recommendation,
  result: HouseDrainageResult,
  traces: readonly IdentifiedTrace[],
  products: readonly SelectedProduct[],
  only: boolean,
  locale: Locale = DEFAULT_LOCALE,
): Recommendation {
  const sentence = drainageSentence(result, locale);
  const lines = drainageSystemLines(result, traces, locale);
  const en = locale === 'en';
  if (only) {
    return {
      ...base,
      headline: en
        ? `House drainage: soil ${result.soil?.size ?? '-'}, waste ${result.waste?.size ?? '-'}`
        : `Pembuangan rumah: air kotor ${result.soil?.size ?? '-'}, air bekas ${result.waste?.size ?? '-'}`,
      body: `${sentence} ${en ? 'Initial estimate, not a final design.' : 'Perkiraan awal, bukan desain final.'}`,
      stats: {
        ...base.stats,
        mainSize: result.soil?.size ?? result.waste?.size ?? base.stats.mainSize,
        fixtureConnectionSize: result.waste?.size ?? base.stats.fixtureConnectionSize,
        branchCount: lines.length,
      },
      systemLines: lines,
      products,
      bom: [],
      assumptions: drainageAssumptions(result, locale),
      overallProvenance: worstOf(base.overallProvenance, result.overallProvenance),
    };
  }
  return {
    ...base,
    body: `${base.body} ${sentence}`.trim(),
    systemLines: [...base.systemLines, ...lines],
    products: [
      ...base.products,
      ...products.filter((p) => !base.products.some((b) => b.productId === p.productId)),
    ],
    assumptions: [...base.assumptions, ...drainageAssumptions(result, locale)],
    overallProvenance: worstOf(base.overallProvenance, result.overallProvenance),
  };
}

function worstOf(a: Provenance, b: Provenance): Provenance {
  const order: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
