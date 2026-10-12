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
}
export interface DrainageLoadResult {
  /** Beban jalur air kotor (kloset). */
  readonly soilDfu: number;
  /** Beban jalur air bekas (shower/floor drain, wastafel, bak cuci). */
  readonly wasteDfu: number;
}

export const ENG_601: RuleVersion<DrainageLoadInput, DrainageLoadResult> = {
  ruleId: 'ENG-601',
  version: 1,
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
    };
  },
  compute: (i) => ({
    soilDfu: i.waterClosets * i.dfuWaterCloset,
    wasteDfu:
      i.showers * i.dfuShower + i.lavatories * i.dfuLavatory + i.kitchenSinks * i.dfuKitchenSink,
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
      },
      expected: { soilDfu: 12, wasteDfu: 10 },
    },
  ],
  explain: (i, o, locale) => {
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
    const wasteId = terms(['shower/floor drain', 'wastafel', 'bak cuci dapur']);
    const wasteEn = terms(['showers/floor drains', 'basins', 'kitchen sinks']);
    return localized(locale, {
      id: [
        i.waterClosets > 0
          ? `Beban air kotor ${o.soilDfu} = ${i.waterClosets} kloset × ${i.dfuWaterCloset}.`
          : '',
        wasteId ? `Beban air bekas ${o.wasteDfu} = ${wasteId}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      en: [
        i.waterClosets > 0
          ? `Soil load ${o.soilDfu} = ${i.waterClosets} toilets × ${i.dfuWaterCloset}.`
          : '',
        wasteEn ? `Waste load ${o.wasteDfu} = ${wasteEn}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  },
};

// ── ENG-602 · Ukuran jalur pembuangan dan ventilasinya ──────────────────────

export interface DrainLineInput {
  readonly dfu: number;
  /** Ukuran minimum dari alat terbesar di jalur ini (mis. kloset 4"). */
  readonly minimumSize: DrainSize;
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
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const minimumSize = o['minimumSize'];
    if (!DRAIN_SIZES.includes(minimumSize as DrainSize)) {
      throw new Error(`ENG-602: minimumSize tidak dikenal: ${String(minimumSize)}`);
    }
    return {
      dfu: requireNumber('ENG-602', 'dfu', o['dfu'], { min: 0, max: 840 }),
      minimumSize: minimumSize as DrainSize,
    };
  },
  compute: (i) => {
    const capacitySize = (Object.entries(DRAIN_CAPACITY_DFU_2PCT) as [DrainSize, number][]).find(
      ([, cap]) => cap >= i.dfu,
    )![0];
    const size = larger(capacitySize, i.minimumSize);
    const half = inches(size) / 2;
    const ventSize = DRAIN_SIZES.find((s) => inches(s) >= Math.max(1.25, half))!;
    return { capacitySize, size, capacityDfu: DRAIN_CAPACITY_DFU_2PCT[size] ?? 0, ventSize };
  },
  sourceReference:
    'Kapasitas saluran mendatar pada kemiringan 2 %, IPC Tabel 710.1(1): 2" 21, 2½" 24, 3" 42, 4" 216, 5" 480, 6" 840 DFU; ukuran tidak di bawah alat terbesar; ventilasi ≥ ½ diameter jalur, minimal 1¼" (IPC 906.2)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'air kotor 12 DFU, minimum kloset 4" → 4", ventilasi 2"',
      input: { dfu: 12, minimumSize: '4"' },
      expected: { capacitySize: '2"', size: '4"', capacityDfu: 216, ventSize: '2"' },
    },
    {
      name: 'air bekas 30 DFU, minimum 2" → 3" dari kapasitas, ventilasi 1½"',
      input: { dfu: 30, minimumSize: '2"' },
      expected: { capacitySize: '3"', size: '3"', capacityDfu: 42, ventSize: '1½"' },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id:
        `Beban ${i.dfu} cukup dialirkan pipa ${o.capacitySize} pada kemiringan 2 %` +
        (o.size !== o.capacitySize
          ? `, tetapi alat terbesar di jalur ini butuh minimal ${i.minimumSize}, jadi jalurnya ${o.size}`
          : `, jadi jalurnya ${o.size}`) +
        ` (kapasitas ${o.capacityDfu}). Pipa ventilasinya ${o.ventSize}, setengah diameter jalur dan tidak kurang dari 1¼".`,
      en:
        `A load of ${i.dfu} fits a ${o.capacitySize} pipe at 2 % slope` +
        (o.size !== o.capacitySize
          ? `, but the largest fixture on this line needs at least ${i.minimumSize}, so the line is ${o.size}`
          : `, so the line is ${o.size}`) +
        ` (capacity ${o.capacityDfu}). Its vent pipe is ${o.ventSize}, half the line diameter and not under 1¼".`,
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
}
export interface DrainLengthResult {
  /** Air kotor: panjang rumah + turun dari lantai teratas; `null` bila tidak ada kloset. */
  readonly soilNetM: number | null;
  /** Air bekas: panjang rumah; `null` bila tidak ada alat air bekas. */
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
  version: 1,
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
    };
  },
  compute: (i) => {
    const vent = round1(i.floors * i.floorHeightM + i.ventAboveRoofM);
    return {
      soilNetM: i.hasSoil ? round1(i.planLengthM + i.floorHeightM * (i.floors - 1)) : null,
      wasteNetM: i.hasWaste ? round1(i.planLengthM) : null,
      soilVentNetM: i.hasSoil ? vent : null,
      wasteVentNetM: i.hasWaste ? vent : null,
    };
  },
  sourceReference:
    'Perkiraan tanpa denah: air kotor = panjang rumah + tinggi lantai × (lantai − 1); air bekas = panjang rumah; ventilasi = lantai × tinggi lantai + tinggi di atas atap',
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
      },
      expected: { soilNetM: 15.5, wasteNetM: 12, soilVentNetM: 8, wasteVentNetM: 8 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: [
        o.soilNetM !== null
          ? `Air kotor = panjang rumah ${i.planLengthM} m + ${i.floorHeightM} m × (${i.floors} − 1) lantai = ${o.soilNetM} m.`
          : '',
        o.wasteNetM !== null ? `Air bekas = panjang rumah ${o.wasteNetM} m.` : '',
        `Ventilasi = ${i.floors} lantai × ${i.floorHeightM} m + ${i.ventAboveRoofM} m di atas atap = ${round1(i.floors * i.floorHeightM + i.ventAboveRoofM)} m per jalur.`,
        'Perkiraan sampai denahnya ada.',
      ]
        .filter(Boolean)
        .join(' '),
      en: [
        o.soilNetM !== null
          ? `Soil line = house length ${i.planLengthM} m + ${i.floorHeightM} m × (${i.floors} − 1) floors = ${o.soilNetM} m.`
          : '',
        o.wasteNetM !== null ? `Waste line = house length ${o.wasteNetM} m.` : '',
        `Vent = ${i.floors} floors × ${i.floorHeightM} m + ${i.ventAboveRoofM} m above the roof = ${round1(i.floors * i.floorHeightM + i.ventAboveRoofM)} m per line.`,
        'An estimate until the floor plan is known.',
      ]
        .filter(Boolean)
        .join(' '),
    }),
};

export const GROUP_J = [ENG_601, ENG_602, ENG_603] as const;
