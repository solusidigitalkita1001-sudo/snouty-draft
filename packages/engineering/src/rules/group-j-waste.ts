/**
 * Kelompok J — pembuangan rumah dan bangunan kecil (laporan pemilik 2026-10-12: "kok ngga mau
 * ngitung … malah nyuruh ngubungin org teknis"). Sebelumnya setiap instalasi pembuangan diteruskan
 * ke tim teknis (Policy 5, OQ-17).
 *
 * Metode unit beban alat plambing untuk pembuangan (drainage fixture unit, DFU): tiap alat diberi
 * beban, beban dijumlah per jalur, lalu ukuran pipa dipilih dari kapasitas beban per diameter.
 * Dua jalur dipisah seperti lazimnya rumah di Indonesia: air kotor (kloset → septic tank) dan air
 * bekas (floor drain/shower, wastafel, bak cuci dapur → saluran atau sumur resapan). Nilai beban,
 * kapasitas, dan ukuran minimum adalah nilai acuan dari International Plumbing Code (IPC) —
 * bukan SNI yang sudah divalidasi tim teknis Pralon — jadi semuanya `REQUIRES_DOMAIN_VALIDATION`
 * dan nilai bebannya ada di registry asumsi supaya bisa diperbaiki.
 */

import { localized, requireInt, requireNumber, type RuleVersion } from '../rule.js';
import { round1 } from '../units.js';
import type { EngineeringLocale } from '../parameters/locale.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;

/** Ukuran pipa buangan yang dicoba, urut naik (seri PVC D di katalog Pralon: 1¼"–12"). */
export const DRAIN_SIZES = ['1¼"', '1½"', '2"', '2½"', '3"', '4"', '5"', '6"'] as const;
export type DrainSize = (typeof DRAIN_SIZES)[number];

/**
 * Beban maksimum per diameter untuk saluran bangunan mendatar pada kemiringan 2 % (¼ inci per
 * kaki) — IPC Tabel 710.1(1). 1¼" dan 1½" tidak dipakai sebagai saluran utama.
 */
const DRAIN_CAPACITY_DFU_2PCT: Readonly<Partial<Record<DrainSize, number>>> = {
  '2"': 21,
  '2½"': 24,
  '3"': 42,
  '4"': 216,
  '5"': 480,
  '6"': 840,
};

/**
 * Cabang mendatar per lantai dan pipa tegak (stack) — IPC 2021 Tabel 710.1(2) "Horizontal fixture
 * branches and stacks" (tidak mencakup cabang saluran bangunan, yang ada di Tabel 710.1(1)).
 * Kolom: total cabang mendatar; total buangan ke satu interval cabang; total stack ≤ 3 interval;
 * total stack > 3 interval. Tabel dimulai dari 1½" — 1¼" tidak dipakai sebagai cabang atau stack.
 * Dicek 2026-10-12 terhadap salinan IPC 2021 (Connecticut State Building Code 2022, UpCodes).
 */
interface BranchStackCapacity {
  readonly branch: number;
  readonly interval: number;
  readonly stack3: number;
  readonly stackMore: number;
}
const BRANCH_STACK_DFU: Readonly<Partial<Record<DrainSize, BranchStackCapacity>>> = {
  '1½"': { branch: 3, interval: 2, stack3: 4, stackMore: 8 },
  '2"': { branch: 6, interval: 6, stack3: 10, stackMore: 24 },
  '2½"': { branch: 12, interval: 9, stack3: 20, stackMore: 42 },
  '3"': { branch: 20, interval: 20, stack3: 48, stackMore: 72 },
  '4"': { branch: 160, interval: 90, stack3: 240, stackMore: 500 },
  '5"': { branch: 360, interval: 200, stack3: 540, stackMore: 1100 },
  '6"': { branch: 620, interval: 350, stack3: 960, stackMore: 1900 },
};

const indexOf = (size: DrainSize) => DRAIN_SIZES.indexOf(size);
const larger = (a: DrainSize, b: DrainSize): DrainSize => (indexOf(a) >= indexOf(b) ? a : b);

// ── ENG-601 · Beban pembuangan ──────────────────────────────────────────────

export interface DrainageLoadInput {
  readonly waterClosets: number;
  readonly showers: number;
  readonly lavatories: number;
  readonly kitchenSinks: number;
  readonly dfuWaterCloset: number;
  readonly dfuShower: number;
  readonly dfuLavatory: number;
  readonly dfuKitchenSink: number;
  /** Talang wudhu (ENG-803), masuk jalur air bekas; 0 bukan tempat ibadah. */
  readonly wudhuDfu: number;
  /** Urinoir toilet umum — masuk jalur air kotor bersama kloset. */
  readonly urinals: number;
  readonly dfuUrinal: number;
}
export interface DrainageLoadResult {
  /** Beban jalur air kotor (kloset). */
  readonly soilDfu: number;
  /** Beban jalur air bekas (shower/floor drain, wastafel, bak cuci). */
  readonly wasteDfu: number;
}

export const ENG_601: RuleVersion<DrainageLoadInput, DrainageLoadResult> = {
  ruleId: 'ENG-601',
  // v2 (2026-10-12, tempat ibadah): talang wudhu ikut beban air bekas, urinoir ikut air kotor.
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const count = (f: string) => requireInt('ENG-601', f, o[f], { min: 0, max: 500 });
    const dfu = (f: string) => requireNumber('ENG-601', f, o[f], { min: 0, max: 20 });
    return {
      waterClosets: count('waterClosets'),
      showers: count('showers'),
      lavatories: count('lavatories'),
      kitchenSinks: count('kitchenSinks'),
      dfuWaterCloset: dfu('dfuWaterCloset'),
      dfuShower: dfu('dfuShower'),
      dfuLavatory: dfu('dfuLavatory'),
      dfuKitchenSink: dfu('dfuKitchenSink'),
      wudhuDfu:
        o['wudhuDfu'] === undefined
          ? 0
          : requireNumber('ENG-601', 'wudhuDfu', o['wudhuDfu'], { min: 0, max: 1000 }),
      urinals: o['urinals'] === undefined ? 0 : count('urinals'),
      dfuUrinal: o['dfuUrinal'] === undefined ? 0 : dfu('dfuUrinal'),
    };
  },
  compute: (i) => ({
    soilDfu: i.waterClosets * i.dfuWaterCloset + i.urinals * i.dfuUrinal,
    wasteDfu:
      i.showers * i.dfuShower +
      i.lavatories * i.dfuLavatory +
      i.kitchenSinks * i.dfuKitchenSink +
      i.wudhuDfu,
  }),
  sourceReference:
    'Unit beban alat plambing pembuangan (DFU), IPC Tabel 709.1: kloset 4, shower 2, wastafel 1, bak cuci dapur 2',
  validationStatus: PENDING,
  testCases: [
    {
      name: '3 kamar mandi (kloset + shower), 2 wastafel, 1 dapur → air kotor 12, air bekas 10',
      input: {
        waterClosets: 3,
        showers: 3,
        lavatories: 2,
        kitchenSinks: 1,
        dfuWaterCloset: 4,
        dfuShower: 2,
        dfuLavatory: 1,
        dfuKitchenSink: 2,
        wudhuDfu: 0,
        urinals: 0,
        dfuUrinal: 4,
      },
      expected: { soilDfu: 12, wasteDfu: 10 },
    },
    {
      name: 'masjid: 4 KM (floor drain), 3 urinoir, 2 talang wudhu 13 + 13 → air kotor 28, air bekas 34',
      input: {
        waterClosets: 4,
        showers: 4,
        lavatories: 0,
        kitchenSinks: 0,
        dfuWaterCloset: 4,
        dfuShower: 2,
        dfuLavatory: 1,
        dfuKitchenSink: 2,
        wudhuDfu: 26,
        urinals: 3,
        dfuUrinal: 4,
      },
      expected: { soilDfu: 28, wasteDfu: 34 },
    },
  ],
  explain: (i, o, locale) =>
    [drainLoadSentence(i, o, 'soil', locale), drainLoadSentence(i, o, 'waste', locale)]
      .filter(Boolean)
      .join(' '),
};

/**
 * Kalimat beban satu jalur (TC-H-07): baris air kotor hanya menyebut beban kloset, baris air bekas
 * hanya alat air bekas. Kosong bila jalurnya tidak punya alat. Dipakai juga oleh `ENG_601.explain`.
 */
export function drainLoadSentence(
  i: DrainageLoadInput,
  o: DrainageLoadResult,
  line: 'soil' | 'waste',
  locale?: EngineeringLocale,
): string {
  if (line === 'soil') {
    if (i.waterClosets <= 0 && (i.urinals ?? 0) <= 0) return '';
    const urinal = (label: string) =>
      (i.urinals ?? 0) > 0 ? ` + ${i.urinals} ${label} × ${i.dfuUrinal}` : '';
    return localized(locale, {
      id: `Beban air kotor ${o.soilDfu} = ${i.waterClosets} kloset × ${i.dfuWaterCloset}${urinal('urinoir')}.`,
      en: `Soil load ${o.soilDfu} = ${i.waterClosets} toilets × ${i.dfuWaterCloset}${urinal('urinals')}.`,
    });
  }
  // Hanya alat yang ada disebut — "0 wastafel × 1" bukan informasi.
  const terms = (labels: readonly [string, string, string]) =>
    (
      [
        [i.showers, labels[0], i.dfuShower],
        [i.lavatories, labels[1], i.dfuLavatory],
        [i.kitchenSinks, labels[2], i.dfuKitchenSink],
      ] as const
    )
      .filter(([n]) => n > 0)
      .map(([n, label, dfu]) => `${n} ${label} × ${dfu}`)
      .join(' + ');
  const wudhu = (label: string) => ((i.wudhuDfu ?? 0) > 0 ? [`${label} ${i.wudhuDfu}`] : []);
  const id = [terms(['shower/floor drain', 'wastafel', 'bak cuci dapur']), ...wudhu('talang wudhu')]
    .filter(Boolean)
    .join(' + ');
  if (!id) return '';
  const en = [
    terms(['showers/floor drains', 'basins', 'kitchen sinks']),
    ...wudhu('ablution troughs'),
  ]
    .filter(Boolean)
    .join(' + ');
  return localized(locale, {
    id: `Beban air bekas ${o.wasteDfu} = ${id}.`,
    en: `Waste load ${o.wasteDfu} = ${en}.`,
  });
}

// ── ENG-602 · Ukuran jalur pembuangan dan ventilasinya ──────────────────────

export interface DrainLineInput {
  readonly dfu: number;
  /** Ukuran minimum dari alat terbesar di jalur ini (mis. kloset 4"). */
  readonly minimumSize: DrainSize;
  /** Ukuran minimum dari cabang mendatar per lantai dan pipa tegak (ENG-604); `null` = tidak dicek. */
  readonly branchStackSize: DrainSize | null;
}
export interface DrainLineResult {
  /** Ukuran terkecil yang kapasitasnya cukup untuk beban ini. */
  readonly capacitySize: DrainSize;
  readonly size: DrainSize;
  readonly capacityDfu: number;
  /** Pipa ventilasi: minimal setengah diameter jalur, tidak kurang dari 1¼" (IPC 906.2). */
  readonly ventSize: DrainSize;
}

function inches(size: DrainSize): number {
  return { '1¼"': 1.25, '1½"': 1.5, '2"': 2, '2½"': 2.5, '3"': 3, '4"': 4, '5"': 5, '6"': 6 }[size];
}

export const ENG_602: RuleVersion<DrainLineInput, DrainLineResult> = {
  ruleId: 'ENG-602',
  // v2 (2026-10-12, temuan laporan 0009): ukuran juga tidak di bawah cabang/stack (ENG-604).
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const minimumSize = o['minimumSize'];
    if (!DRAIN_SIZES.includes(minimumSize as DrainSize)) {
      throw new Error(`ENG-602: minimumSize tidak dikenal: ${String(minimumSize)}`);
    }
    const branchStack = o['branchStackSize'] ?? null;
    if (branchStack !== null && !DRAIN_SIZES.includes(branchStack as DrainSize)) {
      throw new Error(`ENG-602: branchStackSize tidak dikenal: ${String(branchStack)}`);
    }
    return {
      dfu: requireNumber('ENG-602', 'dfu', o['dfu'], { min: 0, max: 840 }),
      minimumSize: minimumSize as DrainSize,
      branchStackSize: branchStack as DrainSize | null,
    };
  },
  compute: (i) => {
    const capacitySize = (Object.entries(DRAIN_CAPACITY_DFU_2PCT) as [DrainSize, number][]).find(
      ([, cap]) => cap >= i.dfu,
    )![0];
    const size = larger(larger(capacitySize, i.minimumSize), i.branchStackSize ?? capacitySize);
    const half = inches(size) / 2;
    const ventSize = DRAIN_SIZES.find((s) => inches(s) >= Math.max(1.25, half))!;
    return { capacitySize, size, capacityDfu: DRAIN_CAPACITY_DFU_2PCT[size] ?? 0, ventSize };
  },
  sourceReference:
    'Kapasitas saluran mendatar pada kemiringan 2 %, IPC Tabel 710.1(1): 2" 21, 2½" 24, 3" 42, 4" 216, 5" 480, 6" 840 DFU; ukuran tidak di bawah alat terbesar dan tidak di bawah cabang mendatar / pipa tegak (ENG-604, IPC 710.1(2)); ventilasi ≥ ½ diameter jalur, minimal 1¼" (IPC 906.2)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'air kotor 12 DFU, minimum kloset 4" → 4", ventilasi 2"',
      input: { dfu: 12, minimumSize: '4"', branchStackSize: null },
      expected: { capacitySize: '2"', size: '4"', capacityDfu: 216, ventSize: '2"' },
    },
    {
      name: 'air bekas 30 DFU, minimum 2" → 3" dari kapasitas, ventilasi 1½"',
      input: { dfu: 30, minimumSize: '2"', branchStackSize: null },
      expected: { capacitySize: '3"', size: '3"', capacityDfu: 42, ventSize: '1½"' },
    },
    {
      name: 'air bekas 16 DFU, cabang/stack menuntut 2½" → 2½", ventilasi 1¼"',
      input: { dfu: 16, minimumSize: '2"', branchStackSize: '2½"' },
      expected: { capacitySize: '2"', size: '2½"', capacityDfu: 24, ventSize: '1¼"' },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id:
        `Beban ${i.dfu} cukup dialirkan pipa ${o.capacitySize} pada kemiringan 2 %` +
        (o.size === o.capacitySize
          ? `, jadi jalurnya ${o.size}`
          : o.size === i.branchStackSize && o.size !== i.minimumSize
            ? `, tetapi cabang per lantai dan pipa tegaknya butuh minimal ${o.size}, jadi jalurnya ${o.size}`
            : `, tetapi alat terbesar di jalur ini butuh minimal ${i.minimumSize}, jadi jalurnya ${o.size}`) +
        ` (kapasitas ${o.capacityDfu}). Pipa ventilasinya ${o.ventSize}, setengah diameter jalur dan tidak kurang dari 1¼".`,
      en:
        `A load of ${i.dfu} fits a ${o.capacitySize} pipe at 2 % slope` +
        (o.size === o.capacitySize
          ? `, so the line is ${o.size}`
          : o.size === i.branchStackSize && o.size !== i.minimumSize
            ? `, but the branch per floor and the stack need at least ${o.size}, so the line is ${o.size}`
            : `, but the largest fixture on this line needs at least ${i.minimumSize}, so the line is ${o.size}`) +
        ` (capacity ${o.capacityDfu}). Its vent pipe is ${o.ventSize}, half the line diameter and not under 1¼".`,
    }),
};

const TABULATED = DRAIN_SIZES.filter((s) => BRANCH_STACK_DFU[s] !== undefined);

/** Cabang mendatar terkecil untuk beban ini — IPC 710.1(2), kolom cabang (talang wudhu, ENG-803). */
export function branchSizeForDfu(dfu: number): DrainSize {
  return (
    TABULATED.find((s) => BRANCH_STACK_DFU[s]!.branch >= dfu) ?? TABULATED[TABULATED.length - 1]!
  );
}

// ── ENG-604 · Cabang mendatar per lantai dan pipa tegak ────────────────────

export interface BranchStackInput {
  /** Beban jalur ini per lantai (DFU), satu angka per lantai yang punya alat di jalur ini. */
  readonly floorDfu: readonly number[];
}
export interface BranchStackResult {
  /** Cabang mendatar terkecil yang menampung lantai terberat. */
  readonly branchSize: DrainSize;
  readonly branchDfu: number;
  /** Pipa tegak (≥ 2 lantai): total semua lantai dan buangan per interval; `null` 1 lantai. */
  readonly stackSize: DrainSize | null;
  readonly stackDfu: number;
  /** Ukuran minimum jalur dari cabang dan stack. */
  readonly size: DrainSize;
}

/**
 * Temuan laporan 0009: ukuran jalur hanya dicek terhadap saluran bangunan (710.1(1)); cabang
 * mendatar per lantai dan pipa tegak punya batas lebih kecil (710.1(2)). Setiap lantai dianggap
 * satu interval cabang yang masuk ke pipa tegak — anggapan konservatif untuk lantai dasar, yang
 * bisa juga langsung ke saluran bangunan.
 */
export const ENG_604: RuleVersion<BranchStackInput, BranchStackResult> = {
  ruleId: 'ENG-604',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const floors = o['floorDfu'];
    if (!Array.isArray(floors) || floors.length === 0 || floors.length > 50) {
      throw new Error('ENG-604: floorDfu harus berisi 1–50 lantai');
    }
    return {
      floorDfu: floors.map((v, i) =>
        requireNumber('ENG-604', `floorDfu[${i}]`, v, { min: 0, max: 1900 }),
      ),
    };
  },
  compute: (i) => {
    const heaviest = Math.max(...i.floorDfu);
    const total = i.floorDfu.reduce((a, b) => a + b, 0);
    const last = TABULATED[TABULATED.length - 1]!;
    const branchSize = TABULATED.find((s) => BRANCH_STACK_DFU[s]!.branch >= heaviest) ?? last;
    const intervals = i.floorDfu.length;
    const stackSize =
      intervals > 1
        ? (TABULATED.find((s) => {
            const t = BRANCH_STACK_DFU[s]!;
            const stackCap = intervals <= 3 ? t.stack3 : t.stackMore;
            return stackCap >= total && t.interval >= heaviest;
          }) ?? last)
        : null;
    return {
      branchSize,
      branchDfu: heaviest,
      stackSize,
      stackDfu: total,
      size: stackSize === null ? branchSize : larger(branchSize, stackSize),
    };
  },
  sourceReference:
    'IPC 2021 Tabel 710.1(2): cabang mendatar 1½" 3, 2" 6, 2½" 12, 3" 20, 4" 160, 5" 360, 6" 620 DFU; per interval cabang 2/6/9/20/90/200/350; stack ≤ 3 interval 4/10/20/48/240/540/960; > 3 interval 8/24/42/72/500/1100/1900',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'air bekas 2 lantai × 8 DFU (2 floor drain + 4 wastafel) → cabang 2½", stack 16 DFU → 2½"',
      input: { floorDfu: [8, 8] },
      expected: { branchSize: '2½"', branchDfu: 8, stackSize: '2½"', stackDfu: 16, size: '2½"' },
    },
    {
      name: 'air bekas rumah 2 lantai 4 + 4 DFU → 2"',
      input: { floorDfu: [4, 4] },
      expected: { branchSize: '2"', branchDfu: 4, stackSize: '2"', stackDfu: 8, size: '2"' },
    },
    {
      name: '1 lantai 5 DFU → cabang 2", tanpa stack',
      input: { floorDfu: [5] },
      expected: { branchSize: '2"', branchDfu: 5, stackSize: null, stackDfu: 5, size: '2"' },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id:
        `Cabang mendatar lantai terberat ${o.branchDfu} beban → ${o.branchSize}` +
        (o.stackSize !== null
          ? `; pipa tegak ${i.floorDfu.length} lantai, total ${o.stackDfu} beban → ${o.stackSize}`
          : '') +
        ` (IPC 710.1(2)). Jalur ini minimal ${o.size}.`,
      en:
        `Horizontal branch on the heaviest floor ${o.branchDfu} units → ${o.branchSize}` +
        (o.stackSize !== null
          ? `; stack over ${i.floorDfu.length} floors, total ${o.stackDfu} units → ${o.stackSize}`
          : '') +
        ` (IPC 710.1(2)). This line is at least ${o.size}.`,
    }),
};

// ── ENG-603 · Perkiraan panjang jalur pembuangan dari ukuran rumah ──────────

export interface DrainLengthInput {
  readonly planLengthM: number;
  readonly floors: number;
  readonly floorHeightM: number;
  readonly ventAboveRoofM: number;
  readonly hasSoil: boolean;
  readonly hasWaste: boolean;
  /** Halaman dari bangunan ke depan tanah (ENG-705): septic tank dan saluran di depan. */
  readonly yardM: number;
}
export interface DrainLengthResult {
  /** Air kotor: panjang bangunan + turun dari lantai teratas; `null` bila tidak ada kloset. */
  readonly soilNetM: number | null;
  /** Air bekas: panjang bangunan + turun dari lantai teratas; `null` bila tidak ada alat air bekas. */
  readonly wasteNetM: number | null;
  /** Ventilasi tiap jalur: tinggi bangunan + di atas atap. */
  readonly soilVentNetM: number | null;
  readonly wasteVentNetM: number | null;
}

/**
 * Tanpa denah, panjang jalur pembuangan diperkirakan dari ukuran rumah (keputusan pemilik
 * 2026-10-12, P16-60). Hanya dijalankan bila ukuran rumah diketahui.
 */
export const ENG_603: RuleVersion<DrainLengthInput, DrainLengthResult> = {
  ruleId: 'ENG-603',
  // v2 (2026-10-12): jalur air kotor dan air bekas melewati halaman ke depan tanah.
  // v3 (laporan 0009): air bekas juga turun dari lantai atas, seperti air kotor.
  version: 3,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      planLengthM: requireNumber('ENG-603', 'planLengthM', o['planLengthM'], { min: 1, max: 500 }),
      floors: requireInt('ENG-603', 'floors', o['floors'], { min: 1, max: 50 }),
      floorHeightM: requireNumber('ENG-603', 'floorHeightM', o['floorHeightM'], {
        min: 2,
        max: 10,
      }),
      ventAboveRoofM: requireNumber('ENG-603', 'ventAboveRoofM', o['ventAboveRoofM'], {
        min: 0,
        max: 5,
      }),
      hasSoil: o['hasSoil'] === true,
      hasWaste: o['hasWaste'] === true,
      yardM: requireNumber('ENG-603', 'yardM', o['yardM'] ?? 0, { min: 0, max: 1000 }),
    };
  },
  compute: (i) => {
    const vent = round1(i.floors * i.floorHeightM + i.ventAboveRoofM);
    return {
      soilNetM: i.hasSoil
        ? round1(i.planLengthM + i.floorHeightM * (i.floors - 1) + i.yardM)
        : null,
      wasteNetM: i.hasWaste
        ? round1(i.planLengthM + i.floorHeightM * (i.floors - 1) + i.yardM)
        : null,
      soilVentNetM: i.hasSoil ? vent : null,
      wasteVentNetM: i.hasWaste ? vent : null,
    };
  },
  sourceReference:
    'Perkiraan tanpa denah: air kotor = panjang bangunan + tinggi lantai × (lantai − 1) + halaman; air bekas = panjang bangunan + tinggi lantai × (lantai − 1) + halaman; ventilasi = lantai × tinggi lantai + tinggi di atas atap',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'rumah 12 m, 2 lantai × 3,5 m, ventilasi 1 m di atas atap',
      input: {
        planLengthM: 12,
        floors: 2,
        floorHeightM: 3.5,
        ventAboveRoofM: 1,
        hasSoil: true,
        hasWaste: true,
        yardM: 0,
      },
      expected: { soilNetM: 15.5, wasteNetM: 15.5, soilVentNetM: 8, wasteVentNetM: 8 },
    },
    {
      name: 'sama, tanah 20 m → halaman 8 m: air kotor dan air bekas 12 + 3,5 + 8 = 23,5 m',
      input: {
        planLengthM: 12,
        floors: 2,
        floorHeightM: 3.5,
        ventAboveRoofM: 1,
        hasSoil: true,
        hasWaste: true,
        yardM: 8,
      },
      expected: { soilNetM: 23.5, wasteNetM: 23.5, soilVentNetM: 8, wasteVentNetM: 8 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: [
        o.soilNetM !== null
          ? `Air kotor = panjang bangunan ${i.planLengthM} m + ${i.floorHeightM} m × (${i.floors} − 1) lantai${i.yardM > 0 ? ` + halaman ${i.yardM} m` : ''} = ${o.soilNetM} m.`
          : '',
        o.wasteNetM !== null
          ? `Air bekas = panjang bangunan ${i.planLengthM} m + ${i.floorHeightM} m × (${i.floors} − 1) lantai${i.yardM > 0 ? ` + halaman ${i.yardM} m` : ''} = ${o.wasteNetM} m.`
          : '',
        `Ventilasi = ${i.floors} lantai × ${i.floorHeightM} m + ${i.ventAboveRoofM} m di atas atap = ${round1(i.floors * i.floorHeightM + i.ventAboveRoofM)} m per jalur.`,
        'Perkiraan sampai denahnya ada.',
      ]
        .filter(Boolean)
        .join(' '),
      en: [
        o.soilNetM !== null
          ? `Soil line = building length ${i.planLengthM} m + ${i.floorHeightM} m × (${i.floors} − 1) floors${i.yardM > 0 ? ` + yard ${i.yardM} m` : ''} = ${o.soilNetM} m.`
          : '',
        o.wasteNetM !== null
          ? `Waste line = building length ${i.planLengthM} m + ${i.floorHeightM} m × (${i.floors} − 1) floors${i.yardM > 0 ? ` + yard ${i.yardM} m` : ''} = ${o.wasteNetM} m.`
          : '',
        `Vent = ${i.floors} floors × ${i.floorHeightM} m + ${i.ventAboveRoofM} m above the roof = ${round1(i.floors * i.floorHeightM + i.ventAboveRoofM)} m per line.`,
        'An estimate until the floor plan is known.',
      ]
        .filter(Boolean)
        .join(' '),
    }),
};

export interface DrainFittingInput {
  readonly soilFixtures: number;
  readonly wasteFixtures: number;
  readonly hasSoil: boolean;
  readonly hasWaste: boolean;
  readonly floors: number;
  readonly yPerFixture: number;
  readonly yPerUpperFloor: number;
  readonly stackBaseElbows45: number;
  readonly cleanoutsPerLine: number;
}

export interface DrainLineFittings {
  readonly fixtureY: number;
  readonly stackY: number;
  readonly elbows45: number;
  readonly cleanouts: number;
}

export interface DrainFittingResult {
  readonly soil: DrainLineFittings | null;
  readonly waste: DrainLineFittings | null;
}

/**
 * Fitting pembuangan rumah (P18-01, keputusan pemilik 2026-10-13): Y-branch per alat, Y masuk pipa
 * tegak per lantai atas, elbow 45° di kaki pipa tegak, clean out per jalur. Angka dari registry
 * asumsi; tanpa cadangan; tidak butuh ukuran bangunan.
 */
export const ENG_605: RuleVersion<DrainFittingInput, DrainFittingResult> = {
  ruleId: 'ENG-605',
  version: 1,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const count = (f: string, max = 1000) => requireInt('ENG-605', f, o[f], { min: 0, max });
    return {
      soilFixtures: count('soilFixtures'),
      wasteFixtures: count('wasteFixtures'),
      hasSoil: o['hasSoil'] === true,
      hasWaste: o['hasWaste'] === true,
      floors: requireInt('ENG-605', 'floors', o['floors'], { min: 1, max: 50 }),
      yPerFixture: count('yPerFixture', 20),
      yPerUpperFloor: count('yPerUpperFloor', 20),
      stackBaseElbows45: count('stackBaseElbows45', 20),
      cleanoutsPerLine: count('cleanoutsPerLine', 20),
    };
  },
  compute: (i) => {
    const line = (fixtures: number): DrainLineFittings => ({
      fixtureY: fixtures * i.yPerFixture,
      stackY: (i.floors - 1) * i.yPerUpperFloor,
      elbows45: i.stackBaseElbows45,
      cleanouts: i.cleanoutsPerLine,
    });
    return {
      soil: i.hasSoil ? line(i.soilFixtures) : null,
      waste: i.hasWaste ? line(i.wasteFixtures) : null,
    };
  },
  sourceReference:
    'Perkiraan kebiasaan pemasangan rumah tanpa denah: Y per alat, Y per lantai atas di pipa tegak, elbow 45° di kaki pipa tegak, clean out per jalur (asumsi FITTING_*)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'rumah 2 lantai: 3 kloset; 3 shower + 4 wastafel + 1 dapur',
      input: {
        soilFixtures: 3,
        wasteFixtures: 8,
        hasSoil: true,
        hasWaste: true,
        floors: 2,
        yPerFixture: 1,
        yPerUpperFloor: 1,
        stackBaseElbows45: 2,
        cleanoutsPerLine: 1,
      },
      expected: {
        soil: { fixtureY: 3, stackY: 1, elbows45: 2, cleanouts: 1 },
        waste: { fixtureY: 8, stackY: 1, elbows45: 2, cleanouts: 1 },
      },
    },
  ],
  explain: (i, o, locale) => {
    const part = (
      name: { id: string; en: string },
      f: DrainLineFittings | null,
      fixtures: number,
      en: boolean,
    ) =>
      f === null
        ? ''
        : en
          ? `${name.en}: ${f.fixtureY} Y-branches for ${fixtures} fixtures, ${f.stackY} into the stack, ${f.elbows45} × 45° elbows and ${f.cleanouts} clean-out. `
          : `${name.id}: ${f.fixtureY} Y-branch untuk ${fixtures} alat, ${f.stackY} masuk pipa tegak, ${f.elbows45} elbow 45° dan ${f.cleanouts} clean out. `;
    const soil = { id: 'Air kotor', en: 'Soil' };
    const waste = { id: 'Air bekas', en: 'Waste' };
    return localized(locale, {
      id: `${part(soil, o.soil, i.soilFixtures, false)}${part(waste, o.waste, i.wasteFixtures, false)}Perkiraan sampai denahnya ada.`,
      en: `${part(soil, o.soil, i.soilFixtures, true)}${part(waste, o.waste, i.wasteFixtures, true)}An estimate until the floor plan is known.`,
    });
  },
};

export const GROUP_J = [ENG_601, ENG_602, ENG_603, ENG_604, ENG_605] as const;
