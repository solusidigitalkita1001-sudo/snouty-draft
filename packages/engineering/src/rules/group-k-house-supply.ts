/**
 * Kelompok K — air bersih rumah (laporan pemilik 2026-10-12: "koreksi itungannya udh bener
 * belom"). Menggantikan ambang prototipe ENG-002 ("unit beban ≥ 8 → 1", selain itu 3/4"") yang
 * tidak memperhitungkan debit, panjang jalur, tinggi, maupun sumber air.
 *
 *   ENG-701  kebutuhan puncak: unit beban suplai (WSFU) tiap alat → debit puncak lewat kurva
 *            Hunter untuk sistem kloset tangki (IPC Lampiran E, Tabel E103.3(2) dan E103.3(3));
 *   ENG-702  jalur dan elevasi: dari sumber ke titik air tertinggi, menurut ukuran rumah, jumlah
 *            lantai, dan jenis sumber;
 *   ENG-703  tekanan di titik tertinggi untuk toren atap (gravitasi): tinggi toren − kehilangan.
 *
 * Ukuran pipanya dipilih Kelompok F (kecepatan + kehilangan tekanan) dengan debit dan jalur ini.
 * Semua `REQUIRES_DOMAIN_VALIDATION`: nilai IPC menunggu padanan SNI 8153 dari tim teknis Pralon.
 */

import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';
import { barToHeadM, headMToBar, round1, round2, round3 } from '../units.js';

const PENDING = 'REQUIRES_DOMAIN_VALIDATION' as const;
const GPM_TO_LS = 0.0630902;

/**
 * Kurva Hunter, sistem dengan kloset tangki — IPC Tabel E103.3(3): WSFU → debit (gpm).
 * Di antara titik tabel dipakai interpolasi linear.
 */
const HUNTER_FLUSH_TANK: readonly (readonly [number, number])[] = [
  [1, 3.0],
  [2, 5.0],
  [3, 6.5],
  [4, 8.0],
  [5, 9.4],
  [6, 10.7],
  [7, 11.8],
  [8, 12.8],
  [9, 13.7],
  [10, 14.6],
  [11, 15.4],
  [12, 16.0],
  [13, 16.5],
  [14, 17.0],
  [15, 17.5],
  [16, 18.0],
  [17, 18.4],
  [18, 18.8],
  [19, 19.2],
  [20, 19.6],
  [25, 21.5],
  [30, 23.3],
  [35, 24.9],
  [40, 26.3],
  [45, 27.7],
  [50, 29.1],
  [60, 32.0],
  [70, 35.0],
  [80, 38.0],
  [90, 41.0],
  [100, 43.5],
];
const HUNTER_MAX_WSFU = 100;

export function hunterGpm(wsfu: number): number {
  if (wsfu <= 0) return 0;
  const first = HUNTER_FLUSH_TANK[0]!;
  if (wsfu <= first[0]) return first[1] * (wsfu / first[0]);
  for (let k = 1; k < HUNTER_FLUSH_TANK.length; k++) {
    const [x1, y1] = HUNTER_FLUSH_TANK[k]!;
    const [x0, y0] = HUNTER_FLUSH_TANK[k - 1]!;
    if (wsfu <= x1) return y0 + ((y1 - y0) * (wsfu - x0)) / (x1 - x0);
  }
  return HUNTER_FLUSH_TANK.at(-1)![1];
}

// ── ENG-701 · Kebutuhan puncak dari unit beban suplai ───────────────────────

export interface SupplyDemandInput {
  readonly waterClosets: number;
  readonly showers: number;
  readonly lavatories: number;
  readonly kitchenSinks: number;
  readonly wsfuWaterCloset: number;
  readonly wsfuShower: number;
  readonly wsfuLavatory: number;
  readonly wsfuKitchenSink: number;
}
export interface SupplyDemandResult {
  readonly wsfu: number;
  readonly peakFlowGpm: number;
  readonly peakFlowLs: number;
}

export const ENG_701: RuleVersion<SupplyDemandInput, SupplyDemandResult> = {
  ruleId: 'ENG-701',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const count = (f: string) => requireInt('ENG-701', f, o[f], { min: 0, max: 200 });
    const unit = (f: string) => requireNumber('ENG-701', f, o[f], { min: 0, max: 10 });
    return {
      waterClosets: count('waterClosets'),
      showers: count('showers'),
      lavatories: count('lavatories'),
      kitchenSinks: count('kitchenSinks'),
      wsfuWaterCloset: unit('wsfuWaterCloset'),
      wsfuShower: unit('wsfuShower'),
      wsfuLavatory: unit('wsfuLavatory'),
      wsfuKitchenSink: unit('wsfuKitchenSink'),
    };
  },
  compute: (i) => {
    const wsfu =
      i.waterClosets * i.wsfuWaterCloset +
      i.showers * i.wsfuShower +
      i.lavatories * i.wsfuLavatory +
      i.kitchenSinks * i.wsfuKitchenSink;
    if (wsfu > HUNTER_MAX_WSFU) {
      // Di atas tabel bukan lagi rumah: kasus gedung bertingkat punya metodenya sendiri.
      throw new RuleInputError('ENG-701', `wsfu ${round1(wsfu)} > ${HUNTER_MAX_WSFU}`);
    }
    const gpm = hunterGpm(wsfu);
    return { wsfu: round1(wsfu), peakFlowGpm: round1(gpm), peakFlowLs: round3(gpm * GPM_TO_LS) };
  },
  sourceReference:
    'IPC Lampiran E: WSFU air dingin, pemakaian pribadi (Tabel E103.3(2)); debit puncak dari kurva Hunter untuk kloset tangki (Tabel E103.3(3)), interpolasi linear; 1 gpm = 0,0631 l/s',
  validationStatus: PENDING,
  testCases: [
    {
      name: '3 kamar mandi + 1 dapur: 3 × (2,2 + 1,0) + 1,0 = 10,6 WSFU → 15,1 gpm',
      input: {
        waterClosets: 3,
        showers: 3,
        lavatories: 0,
        kitchenSinks: 1,
        wsfuWaterCloset: 2.2,
        wsfuShower: 1,
        wsfuLavatory: 0.5,
        wsfuKitchenSink: 1,
      },
      expected: { wsfu: 10.6, peakFlowGpm: 15.1, peakFlowLs: 0.951 },
    },
  ],
  explain: (i, o, locale) => {
    const parts = (
      [
        [i.waterClosets, i.wsfuWaterCloset, 'kloset', 'toilets'],
        [i.showers, i.wsfuShower, 'shower', 'showers'],
        [i.lavatories, i.wsfuLavatory, 'wastafel', 'basins'],
        [i.kitchenSinks, i.wsfuKitchenSink, 'bak cuci dapur', 'kitchen sinks'],
      ] as const
    ).filter(([n]) => n > 0);
    return localized(locale, {
      id: `Beban suplai ${o.wsfu} unit = ${parts.map(([n, u, l]) => `${n} ${l} × ${u}`).join(' + ')}. Karena tidak semua alat dipakai bersamaan, debit puncaknya ${round2(o.peakFlowLs)} l/s (${o.peakFlowGpm} gpm) menurut kurva Hunter.`,
      en: `Supply load ${o.wsfu} units = ${parts.map(([n, u, , l]) => `${n} ${l} × ${u}`).join(' + ')}. Because not every fixture runs at once, the peak flow is ${round2(o.peakFlowLs)} l/s (${o.peakFlowGpm} gpm) from the Hunter curve.`,
    });
  },
};

// ── ENG-702 · Jalur dan elevasi ─────────────────────────────────────────────

export type HouseSource = 'rooftop_tank' | 'ground_tank' | 'pump' | 'municipal';
export type RouteBasis = 'stated' | 'plan' | 'assumed';

export interface HouseRouteInput {
  readonly source: HouseSource;
  readonly floors: number;
  readonly floorHeightM: number;
  /** Panjang jalur datar terjauh: dari yang disebut, dari denah (panjang + lebar), atau asumsi. */
  readonly horizontalRunM: number;
  readonly routeBasis: RouteBasis;
  /** Tinggi titik air tertinggi di atas lantainya (shower). */
  readonly outletHeightM: number;
  /** Tinggi muka air toren di atas atap; hanya untuk toren atap. */
  readonly tankStandM: number;
  /**
   * Jarak halaman dari pagar depan ke bangunan (ENG-705) — meteran PDAM / pompa di depan tanah.
   * Toren atap ada di bangunan, jadi halaman tidak masuk jalurnya. 0 bila ukuran tanah tidak ada.
   */
  readonly yardM: number;
}
export interface HouseRouteResult {
  readonly highestOutletM: number;
  /** Muka air toren atap; `null` untuk sumber di bawah. */
  readonly tankLevelM: number | null;
  /** Positif = air harus diangkat; negatif = toren lebih tinggi (gravitasi). */
  readonly staticHeadM: number;
  readonly routeLengthM: number;
}

export const ENG_702: RuleVersion<HouseRouteInput, HouseRouteResult> = {
  ruleId: 'ENG-702',
  // v2 (2026-10-12): jarak halaman dari ukuran tanah ikut jalur sumber di bawah.
  version: 2,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const source = o['source'];
    if (!['rooftop_tank', 'ground_tank', 'pump', 'municipal'].includes(source as string)) {
      throw new RuleInputError('ENG-702', `source ${String(source)}`);
    }
    const basis = o['routeBasis'];
    if (!['stated', 'plan', 'assumed'].includes(basis as string)) {
      throw new RuleInputError('ENG-702', `routeBasis ${String(basis)}`);
    }
    return {
      source: source as HouseSource,
      floors: requireInt('ENG-702', 'floors', o['floors'], { min: 1, max: 50 }),
      floorHeightM: requireNumber('ENG-702', 'floorHeightM', o['floorHeightM'], {
        min: 2,
        max: 10,
      }),
      horizontalRunM: requireNumber('ENG-702', 'horizontalRunM', o['horizontalRunM'], {
        min: 1,
        max: 1000,
      }),
      routeBasis: basis as RouteBasis,
      outletHeightM: requireNumber('ENG-702', 'outletHeightM', o['outletHeightM'], {
        min: 0,
        max: 3,
      }),
      tankStandM: requireNumber('ENG-702', 'tankStandM', o['tankStandM'], { min: 0, max: 15 }),
      yardM: requireNumber('ENG-702', 'yardM', o['yardM'] ?? 0, { min: 0, max: 1000 }),
    };
  },
  compute: (i) => {
    const highestOutletM = (i.floors - 1) * i.floorHeightM + i.outletHeightM;
    if (i.source === 'rooftop_tank') {
      const tankLevelM = i.floors * i.floorHeightM + i.tankStandM;
      return {
        highestOutletM: round2(highestOutletM),
        tankLevelM: round2(tankLevelM),
        staticHeadM: round2(highestOutletM - tankLevelM),
        routeLengthM: round1(tankLevelM - highestOutletM + i.horizontalRunM),
      };
    }
    return {
      highestOutletM: round2(highestOutletM),
      tankLevelM: null,
      staticHeadM: round2(highestOutletM),
      routeLengthM: round1(highestOutletM + i.horizontalRunM + i.yardM),
    };
  },
  sourceReference:
    'Titik tertinggi = (lantai − 1) × tinggi lantai + tinggi titik air; toren atap di atas atap (lantai × tinggi lantai + tinggi dudukan); jalur = beda tinggi + jalur datar terjauh (+ halaman untuk sumber di depan tanah)',
  validationStatus: PENDING,
  testCases: [
    {
      name: '2 lantai × 3,5 m, toren atap 1 m, shower 2 m, jalur datar 23 m',
      input: {
        source: 'rooftop_tank',
        floors: 2,
        floorHeightM: 3.5,
        horizontalRunM: 23,
        routeBasis: 'plan',
        outletHeightM: 2,
        tankStandM: 1,
        yardM: 0,
      },
      expected: { highestOutletM: 5.5, tankLevelM: 8, staticHeadM: -2.5, routeLengthM: 25.5 },
    },
    {
      name: 'PDAM, 2 lantai × 3,5 m, bangunan 8 × 12 m, halaman 8 m → 5,5 + 20 + 8 = 33,5 m',
      input: {
        source: 'municipal',
        floors: 2,
        floorHeightM: 3.5,
        horizontalRunM: 20,
        routeBasis: 'plan',
        outletHeightM: 2,
        tankStandM: 0,
        yardM: 8,
      },
      expected: { highestOutletM: 5.5, tankLevelM: null, staticHeadM: 5.5, routeLengthM: 33.5 },
    },
  ],
  explain: (i, o, locale) => {
    const run = {
      stated: { id: 'yang disebut', en: 'as stated' },
      plan: { id: 'panjang + lebar bangunan', en: 'building length + width' },
      assumed: {
        id: 'perkiraan, ukuran bangunan belum disebut',
        en: 'estimated, building size not given',
      },
    }[i.routeBasis];
    return o.tankLevelM !== null
      ? localized(locale, {
          id: `Muka air toren di ${o.tankLevelM} m (atap ${i.floors} × ${i.floorHeightM} m + dudukan ${i.tankStandM} m), titik air tertinggi di ${o.highestOutletM} m — toren ${round2(-o.staticHeadM)} m lebih tinggi. Jalur ke titik itu ${o.routeLengthM} m, termasuk ${i.horizontalRunM} m mendatar (${run.id}).`,
          en: `Tank water level at ${o.tankLevelM} m (roof ${i.floors} × ${i.floorHeightM} m + stand ${i.tankStandM} m), highest outlet at ${o.highestOutletM} m — the tank is ${round2(-o.staticHeadM)} m higher. The run to it is ${o.routeLengthM} m, including ${i.horizontalRunM} m horizontal (${run.en}).`,
        })
      : localized(locale, {
          id: `Air naik ${o.highestOutletM} m dari sumber di bawah ke titik air tertinggi; jalurnya ${o.routeLengthM} m, termasuk ${i.horizontalRunM} m mendatar (${run.id})${i.yardM > 0 ? ` dan ${i.yardM} m halaman dari depan tanah` : ''}.`,
          en: `Water rises ${o.highestOutletM} m from the source below to the highest outlet; the run is ${o.routeLengthM} m, including ${i.horizontalRunM} m horizontal (${run.en})${i.yardM > 0 ? ` and ${i.yardM} m of yard from the front of the plot` : ''}.`,
        });
  },
};

// ── ENG-703 · Tekanan di titik tertinggi dari toren atap ────────────────────

export interface GravityPressureInput {
  readonly availableHeadM: number;
  readonly lossM: number;
  readonly minimumBar: number;
}
export interface GravityPressureResult {
  readonly residualBar: number;
  readonly boosterNeeded: boolean;
}

export const ENG_703: RuleVersion<GravityPressureInput, GravityPressureResult> = {
  ruleId: 'ENG-703',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      availableHeadM: requireNumber('ENG-703', 'availableHeadM', o['availableHeadM'], {
        min: -100,
        max: 100,
      }),
      lossM: requireNumber('ENG-703', 'lossM', o['lossM'], { min: 0, max: 1000 }),
      minimumBar: requireNumber('ENG-703', 'minimumBar', o['minimumBar'], { min: 0, max: 5 }),
    };
  },
  compute: (i) => {
    const residualBar = round2(headMToBar(i.availableHeadM - i.lossM));
    return { residualBar, boosterNeeded: residualBar < i.minimumBar };
  },
  sourceReference:
    'Tekanan sisa = (beda tinggi toren − kehilangan gesek dan sambungan) ÷ 10,197 m/bar; di bawah minimum → pompa pendorong',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'toren 2,5 m di atas shower, kehilangan 1,2 m, minimum 0,3 bar → 0,13 bar, perlu pendorong',
      input: { availableHeadM: 2.5, lossM: 1.2, minimumBar: 0.3 },
      expected: { residualBar: 0.13, boosterNeeded: true },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Dari toren atap, titik air tertinggi mendapat ${o.residualBar} bar (${round2(i.availableHeadM)} m beda tinggi − ${round2(i.lossM)} m kehilangan). ${o.boosterNeeded ? `Itu di bawah ${i.minimumBar} bar, jadi perlu pompa pendorong atau toren yang lebih tinggi.` : `Itu cukup (minimal ${i.minimumBar} bar), tanpa pompa pendorong.`}`,
      en: `From the roof tank the highest outlet gets ${o.residualBar} bar (${round2(i.availableHeadM)} m height difference − ${round2(i.lossM)} m loss). ${o.boosterNeeded ? `That is below ${i.minimumBar} bar, so a booster pump or a higher tank is needed.` : `That is enough (at least ${i.minimumBar} bar), with no booster pump.`}`,
    }),
};

/** Tinggi kolom air dari tekanan minimum, untuk memilih ukuran pipa jalur gravitasi. */
export function minimumHeadM(bar: number): number {
  return barToHeadM(bar);
}

// ── ENG-705 · Jarak halaman dari ukuran tanah ───────────────────────────────

export interface YardInput {
  readonly landSideM: number;
  readonly buildingSideM: number;
}
export interface YardResult {
  readonly yardM: number;
}

/**
 * Tanah lebih panjang dari bangunan → pipa dari meteran PDAM di depan tanah, dan pipa buangan ke
 * saluran depan / septic tank, melewati halaman dulu (permintaan pemilik 2026-10-12: "bedain luas
 * tanah sama luas bangunan … rumus di-adjust"). Bangunan dianggap di belakang, halaman di depan:
 * jarak terjauh yang mungkin, supaya pipa tidak kurang.
 */
export const ENG_705: RuleVersion<YardInput, YardResult> = {
  ruleId: 'ENG-705',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      landSideM: requireNumber('ENG-705', 'landSideM', o['landSideM'], { min: 1, max: 1000 }),
      buildingSideM: requireNumber('ENG-705', 'buildingSideM', o['buildingSideM'], {
        min: 1,
        max: 500,
      }),
    };
  },
  compute: (i) => ({ yardM: round1(Math.max(0, i.landSideM - i.buildingSideM)) }),
  sourceReference:
    'Halaman = sisi terpanjang tanah − sisi terpanjang bangunan (bangunan di belakang, meteran dan saluran di depan tanah)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'tanah 10 × 20 m, bangunan 8 × 12 m → halaman 8 m',
      input: { landSideM: 20, buildingSideM: 12 },
      expected: { yardM: 8 },
    },
    {
      name: 'bangunan memenuhi tanah → tanpa halaman',
      input: { landSideM: 12, buildingSideM: 12 },
      expected: { yardM: 0 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Halaman = sisi terpanjang tanah ${i.landSideM} m − sisi terpanjang bangunan ${i.buildingSideM} m = ${o.yardM} m. Meteran PDAM dan saluran dianggap di depan tanah, bangunan di belakangnya.`,
      en: `Yard = longest land side ${i.landSideM} m − longest building side ${i.buildingSideM} m = ${o.yardM} m. The water meter and the street drain are taken to be at the front of the plot, with the building behind.`,
    }),
};

// ── ENG-707 · Isi tiap cabang air bersih ───────────────────────────────────

export interface BranchFillInput {
  /** Alat per lantai (sebaran ENG-008); `floor` = nomor lantai. */
  readonly floors: readonly {
    readonly floor: number;
    readonly bathrooms: number;
    readonly basins: number;
    readonly kitchens: number;
    /** Urinoir toilet umum (tempat ibadah); 0 untuk rumah. */
    readonly urinals: number;
  }[];
  readonly maxOutletsPerBranch: number;
  readonly wsfuWaterCloset: number;
  readonly wsfuShower: number;
  readonly wsfuLavatory: number;
  readonly wsfuKitchenSink: number;
  readonly wsfuUrinal: number;
}
export interface FilledBranch {
  readonly floor: number;
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
  readonly urinals: number;
  readonly outlets: number;
  readonly wsfu: number;
}
export interface BranchFillResult {
  readonly branches: readonly FilledBranch[];
  readonly branchCount: number;
  readonly maxOutletsPerBranch: number;
}

/**
 * Temuan laporan 0009: debit cabang dari rata-rata (WSFU total ÷ jumlah cabang) membuat cabang
 * berisi 2 kamar mandi kekecilan. Titik air tiap lantai diisi ke cabang berurutan — kamar mandi
 * (2 titik, tidak dipisah), lalu wastafel, lalu bak cuci dapur — paling banyak N titik per cabang;
 * beban tiap cabang dijumlah dari isinya. Pengelompokan ini asumsi sampai denahnya ada.
 */
export const ENG_707: RuleVersion<BranchFillInput, BranchFillResult> = {
  ruleId: 'ENG-707',
  // v2 (2026-10-12, tempat ibadah): urinoir ikut mengisi cabang setelah wastafel.
  version: 2,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const floors = o['floors'];
    if (!Array.isArray(floors) || floors.length === 0 || floors.length > 50) {
      throw new RuleInputError('ENG-707', 'floors');
    }
    const n = (f: string) => requireNumber('ENG-707', f, o[f], { min: 0, max: 20 });
    return {
      floors: floors.map((raw, i) => {
        const f = (raw ?? {}) as Record<string, unknown>;
        const c = (k: string) =>
          requireInt('ENG-707', `floors[${i}].${k}`, f[k], { min: 0, max: 500 });
        return {
          floor: c('floor'),
          bathrooms: c('bathrooms'),
          basins: c('basins'),
          kitchens: c('kitchens'),
          urinals: f['urinals'] === undefined ? 0 : c('urinals'),
        };
      }),
      maxOutletsPerBranch: requireInt('ENG-707', 'maxOutletsPerBranch', o['maxOutletsPerBranch'], {
        min: 2,
        max: 20,
      }),
      wsfuWaterCloset: n('wsfuWaterCloset'),
      wsfuShower: n('wsfuShower'),
      wsfuLavatory: n('wsfuLavatory'),
      wsfuKitchenSink: n('wsfuKitchenSink'),
      wsfuUrinal: o['wsfuUrinal'] === undefined ? 0 : n('wsfuUrinal'),
    };
  },
  compute: (i) => {
    const branches: FilledBranch[] = [];
    for (const floor of i.floors) {
      const items = [
        ...Array.from({ length: floor.bathrooms }, () => ({
          kind: 'bathrooms' as const,
          outlets: 2,
          wsfu: i.wsfuWaterCloset + i.wsfuShower,
        })),
        ...Array.from({ length: floor.basins }, () => ({
          kind: 'basins' as const,
          outlets: 1,
          wsfu: i.wsfuLavatory,
        })),
        ...Array.from({ length: floor.urinals }, () => ({
          kind: 'urinals' as const,
          outlets: 1,
          wsfu: i.wsfuUrinal,
        })),
        ...Array.from({ length: floor.kitchens }, () => ({
          kind: 'kitchens' as const,
          outlets: 1,
          wsfu: i.wsfuKitchenSink,
        })),
      ];
      let open: {
        bathrooms: number;
        basins: number;
        kitchens: number;
        urinals: number;
        outlets: number;
        wsfu: number;
      } | null = null;
      const close = () => {
        if (open !== null && open.outlets > 0)
          branches.push({ floor: floor.floor, ...open, wsfu: round2(open.wsfu) });
        open = null;
      };
      for (const item of items) {
        if (open === null || open.outlets + item.outlets > i.maxOutletsPerBranch) {
          close();
          open = { bathrooms: 0, basins: 0, kitchens: 0, urinals: 0, outlets: 0, wsfu: 0 };
        }
        open[item.kind] += 1;
        open.outlets += item.outlets;
        open.wsfu += item.wsfu;
      }
      close();
    }
    return { branches, branchCount: branches.length, maxOutletsPerBranch: i.maxOutletsPerBranch };
  },
  sourceReference:
    'Pengelompokan tanpa denah: kamar mandi (tidak dipisah), lalu wastafel, urinoir, lalu bak cuci dapur, maks 4 titik per cabang, cabang per lantai; beban cabang = jumlah WSFU isinya (IPC Tabel E103.3(2))',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'masjid 0009: tiap lantai 2 KM + 4 wastafel → cabang 2 KM (6,4 WSFU) dan cabang 4 wastafel (2 WSFU)',
      input: {
        floors: [
          { floor: 2, bathrooms: 2, basins: 4, kitchens: 0, urinals: 0 },
          { floor: 1, bathrooms: 2, basins: 4, kitchens: 0, urinals: 0 },
        ],
        maxOutletsPerBranch: 4,
        wsfuWaterCloset: 2.2,
        wsfuShower: 1,
        wsfuLavatory: 0.5,
        wsfuKitchenSink: 1,
        wsfuUrinal: 3,
      },
      expected: {
        branches: [
          { floor: 2, bathrooms: 2, basins: 0, kitchens: 0, urinals: 0, outlets: 4, wsfu: 6.4 },
          { floor: 2, bathrooms: 0, basins: 4, kitchens: 0, urinals: 0, outlets: 4, wsfu: 2 },
          { floor: 1, bathrooms: 2, basins: 0, kitchens: 0, urinals: 0, outlets: 4, wsfu: 6.4 },
          { floor: 1, bathrooms: 0, basins: 4, kitchens: 0, urinals: 0, outlets: 4, wsfu: 2 },
        ],
        branchCount: 4,
        maxOutletsPerBranch: 4,
      },
    },
    {
      name: 'rumah 0002: lantai 2 = 2 KM, lantai 1 = 1 KM + dapur → 2 cabang',
      input: {
        floors: [
          { floor: 2, bathrooms: 2, basins: 0, kitchens: 0, urinals: 0 },
          { floor: 1, bathrooms: 1, basins: 0, kitchens: 1, urinals: 0 },
        ],
        maxOutletsPerBranch: 4,
        wsfuWaterCloset: 2.2,
        wsfuShower: 1,
        wsfuLavatory: 0.5,
        wsfuKitchenSink: 1,
        wsfuUrinal: 3,
      },
      expected: {
        branches: [
          { floor: 2, bathrooms: 2, basins: 0, kitchens: 0, urinals: 0, outlets: 4, wsfu: 6.4 },
          { floor: 1, bathrooms: 1, basins: 0, kitchens: 1, urinals: 0, outlets: 3, wsfu: 4.2 },
        ],
        branchCount: 2,
        maxOutletsPerBranch: 4,
      },
    },
  ],
  explain: (i, o, locale) => {
    const describe = (b: FilledBranch, en: boolean) =>
      [
        b.bathrooms > 0 ? `${b.bathrooms} ${en ? 'bathroom' : 'kamar mandi'}` : '',
        b.basins > 0 ? `${b.basins} ${en ? 'basin' : 'wastafel'}` : '',
        b.urinals > 0 ? `${b.urinals} ${en ? 'urinal' : 'urinoir'}` : '',
        b.kitchens > 0 ? `${b.kitchens} ${en ? 'kitchen sink' : 'bak cuci dapur'}` : '',
      ]
        .filter(Boolean)
        .join(' + ');
    const list = (en: boolean) =>
      o.branches
        .map(
          (b) =>
            `${en ? 'floor' : 'lantai'} ${b.floor}: ${describe(b, en)} (${b.wsfu} ${en ? 'units' : 'unit'})`,
        )
        .join('; ');
    return localized(locale, {
      id: `Titik air tiap lantai dibagi ke cabang berisi paling banyak ${i.maxOutletsPerBranch} titik — kamar mandi tidak dipisah, lalu wastafel, lalu dapur: ${list(false)}. ${o.branchCount} cabang.`,
      en: `Each floor's outlets are split into branches of at most ${i.maxOutletsPerBranch} outlets — bathrooms kept whole, then basins, then kitchen: ${list(true)}. ${o.branchCount} branches.`,
    });
  },
};

// ── ENG-706 · Pipa pengisi toren atap ───────────────────────────────────────

export interface TankFillInput {
  readonly yardM: number;
  readonly buildingSideM: number;
  readonly tankLevelM: number;
  /** Ukuran pipa pengisi dalam inci (asumsi TANK_FILL_PIPE_3_4IN). */
  readonly sizeInches: number;
}
export interface TankFillResult {
  readonly fillNetM: number;
  readonly size: string;
}

const INCH_LABEL: Readonly<Record<string, string>> = {
  '0.5': '1/2"',
  '0.75': '3/4"',
  '1': '1"',
  '1.25': '1 1/4"',
  '1.5': '1 1/2"',
};

/**
 * Toren atap diisi dari meteran PDAM atau pompa di depan tanah (2026-10-12, P16-63): pipanya
 * melewati halaman, menyusuri bangunan (sisi terpanjang — posisi toren belum diketahui), lalu naik
 * ke muka air toren. Hanya bila ukuran bangunan diketahui.
 */
export const ENG_706: RuleVersion<TankFillInput, TankFillResult> = {
  ruleId: 'ENG-706',
  version: 1,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const sizeInches = requireNumber('ENG-706', 'sizeInches', o['sizeInches'], {
      min: 0.5,
      max: 1.5,
    });
    if (INCH_LABEL[String(sizeInches)] === undefined) {
      throw new RuleInputError('ENG-706', `ukuran ${sizeInches} inci tidak dikenal`);
    }
    return {
      yardM: requireNumber('ENG-706', 'yardM', o['yardM'], { min: 0, max: 1000 }),
      buildingSideM: requireNumber('ENG-706', 'buildingSideM', o['buildingSideM'], {
        min: 1,
        max: 500,
      }),
      tankLevelM: requireNumber('ENG-706', 'tankLevelM', o['tankLevelM'], { min: 1, max: 200 }),
      sizeInches,
    };
  },
  compute: (i) => ({
    fillNetM: round1(i.yardM + i.buildingSideM + i.tankLevelM),
    size: INCH_LABEL[String(i.sizeInches)]!,
  }),
  sourceReference:
    'Perkiraan tanpa denah: pipa pengisi = halaman + sisi terpanjang bangunan + tinggi muka air toren; ukuran asumsi',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'halaman 8 m, bangunan 12 m, toren 8 m → 28 m, 3/4"',
      input: { yardM: 8, buildingSideM: 12, tankLevelM: 8, sizeInches: 0.75 },
      expected: { fillNetM: 28, size: '3/4"' },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Pipa pengisi toren ${o.size} dari meteran atau pompa di depan tanah: halaman ${i.yardM} m + sepanjang bangunan ${i.buildingSideM} m + naik ke toren ${i.tankLevelM} m = ${o.fillNetM} m.`,
      en: `Tank fill pipe ${o.size} from the meter or pump at the front of the plot: yard ${i.yardM} m + along the building ${i.buildingSideM} m + up to the tank ${i.tankLevelM} m = ${o.fillNetM} m.`,
    }),
};

// ── ENG-704 · Perkiraan panjang cabang dan sambungan dari ukuran rumah ──────

export interface HouseBranchLengthInput {
  readonly planLengthM: number;
  readonly branchCount: number;
  readonly outletCount: number;
  readonly fixtureDropM: number;
}
export interface HouseBranchLengthResult {
  readonly branchNetM: number;
  readonly fixtureNetM: number;
  readonly teeCount: number;
}

/**
 * Tanpa denah, panjang cabang dan sambungan diperkirakan dari ukuran rumah (keputusan pemilik
 * 2026-10-12, P16-60): tiap cabang menyusuri panjang rumah, tiap titik air disambung 1,5 m dari
 * cabangnya, satu tee per cabang di pipa utama/riser. Hanya dijalankan bila ukuran rumah diketahui.
 */
export const ENG_704: RuleVersion<HouseBranchLengthInput, HouseBranchLengthResult> = {
  ruleId: 'ENG-704',
  // v2 (review laporan 0015): cabang terakhir di ujung pipa utama disambung elbow, bukan tee.
  version: 2,
  category: 'geometry',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      planLengthM: requireNumber('ENG-704', 'planLengthM', o['planLengthM'], { min: 1, max: 500 }),
      branchCount: requireInt('ENG-704', 'branchCount', o['branchCount'], { min: 1, max: 200 }),
      outletCount: requireInt('ENG-704', 'outletCount', o['outletCount'], { min: 0, max: 1000 }),
      fixtureDropM: requireNumber('ENG-704', 'fixtureDropM', o['fixtureDropM'], {
        min: 0.1,
        max: 20,
      }),
    };
  },
  compute: (i) => ({
    branchNetM: round1(i.branchCount * i.planLengthM),
    fixtureNetM: round1(i.outletCount * i.fixtureDropM),
    teeCount: Math.max(0, i.branchCount - 1),
  }),
  sourceReference:
    'Perkiraan tanpa denah: cabang = jumlah cabang × panjang bangunan; sambungan = titik air × panjang sambungan; tee = 1 per cabang kecuali cabang di ujung pipa utama (elbow)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'rumah 12 m, 2 cabang, 7 titik, sambungan 1,5 m → cabang 24 m, sambungan 10,5 m, 1 tee (ujung pipa utama elbow)',
      input: { planLengthM: 12, branchCount: 2, outletCount: 7, fixtureDropM: 1.5 },
      expected: { branchNetM: 24, fixtureNetM: 10.5, teeCount: 1 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Cabang ${i.branchCount} × panjang bangunan ${i.planLengthM} m = ${o.branchNetM} m; sambungan ke alat ${i.outletCount} titik × ${i.fixtureDropM} m = ${o.fixtureNetM} m; ${o.teeCount} tee, satu per cabang kecuali cabang di ujung pipa utama yang disambung elbow. Perkiraan sampai denahnya ada.`,
      en: `Branches ${i.branchCount} × building length ${i.planLengthM} m = ${o.branchNetM} m; fixture connections ${i.outletCount} outlets × ${i.fixtureDropM} m = ${o.fixtureNetM} m; ${o.teeCount} tees, one per branch except the branch at the end of the main, which takes an elbow. An estimate until the floor plan is known.`,
    }),
};

export interface HouseSupplyFittingInput {
  readonly branchesBySize: readonly { readonly size: string; readonly count: number }[];
  /** Ukuran pipa utama dan cabang di ujungnya (terjauh dari sumber) — v2. */
  readonly mainSize?: string;
  readonly endBranchSize?: string;
  readonly outletCount: number;
  readonly hasTankFill: boolean;
  readonly mainElbows: number;
  readonly tankFillElbows: number;
  readonly elbowsPerBranch: number;
  readonly elbowsPerOutlet: number;
  readonly faucetElbowsPerOutlet: number;
}

export interface HouseSupplyFittingResult {
  readonly mainElbows: number;
  /** Elbow di ujung pipa utama, menggantikan tee cabang terakhir (v2). */
  readonly endElbows: number;
  /** Reducer di ujung pipa utama bila cabang terakhir lebih kecil: ukuran cabangnya; `null` bila sama. */
  readonly endReducer: string | null;
  readonly tankFillElbows: number;
  readonly branchElbows: readonly { readonly size: string; readonly count: number }[];
  readonly outletElbows: number;
  readonly faucetElbows: number;
}

/**
 * Fitting air bersih rumah (P18-01, keputusan pemilik 2026-10-13): jumlah elbow dan faucet elbow
 * dari banyaknya jalur, cabang, dan titik air — bukan dari denah. Angka per jalur dari registry
 * asumsi; tanpa cadangan. Tidak butuh ukuran bangunan, jadi dihitung meski panjang pipa belum.
 */
export const ENG_708: RuleVersion<HouseSupplyFittingInput, HouseSupplyFittingResult> = {
  ruleId: 'ENG-708',
  // v2 (review laporan 0015): ujung pipa utama memakai elbow (+ reducer bila cabangnya lebih kecil).
  version: 2,
  category: 'material',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const count = (f: string, max = 1000) => requireInt('ENG-708', f, o[f], { min: 0, max });
    const groups = o['branchesBySize'];
    if (!Array.isArray(groups)) throw new RuleInputError('ENG-708', 'branchesBySize harus daftar');
    return {
      branchesBySize: groups.map((g: { size?: unknown; count?: unknown }, i) => {
        if (typeof g.size !== 'string')
          throw new RuleInputError('ENG-708', `branchesBySize[${i}].size`);
        return {
          size: g.size,
          count: requireInt('ENG-708', `branchesBySize[${i}].count`, g.count, { min: 0, max: 200 }),
        };
      }),
      outletCount: count('outletCount'),
      hasTankFill: o['hasTankFill'] === true,
      ...(typeof o['mainSize'] === 'string' ? { mainSize: o['mainSize'] } : {}),
      ...(typeof o['endBranchSize'] === 'string' ? { endBranchSize: o['endBranchSize'] } : {}),
      mainElbows: count('mainElbows', 20),
      tankFillElbows: count('tankFillElbows', 20),
      elbowsPerBranch: count('elbowsPerBranch', 20),
      elbowsPerOutlet: count('elbowsPerOutlet', 20),
      faucetElbowsPerOutlet: count('faucetElbowsPerOutlet', 20),
    };
  },
  compute: (i) => ({
    mainElbows: i.mainElbows,
    endElbows: i.endBranchSize !== undefined ? 1 : 0,
    endReducer:
      i.endBranchSize !== undefined && i.mainSize !== undefined && i.endBranchSize !== i.mainSize
        ? i.endBranchSize
        : null,
    tankFillElbows: i.hasTankFill ? i.tankFillElbows : 0,
    branchElbows: i.branchesBySize.map((b) => ({
      size: b.size,
      count: b.count * i.elbowsPerBranch,
    })),
    outletElbows: i.outletCount * i.elbowsPerOutlet,
    faucetElbows: i.outletCount * i.faucetElbowsPerOutlet,
  }),
  sourceReference:
    'Perkiraan kebiasaan pemasangan rumah tanpa denah: elbow pipa utama, elbow (+ reducer) di ujung pipa utama, elbow pengisi toren, elbow per cabang, elbow dan faucet elbow per titik air (asumsi FITTING_*)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'rumah contoh: cabang 1"×1, 3/4"×1, 1/2"×2; 11 titik; toren atap',
      input: {
        branchesBySize: [
          { size: '1"', count: 1 },
          { size: '3/4"', count: 1 },
          { size: '1/2"', count: 2 },
        ],
        outletCount: 11,
        hasTankFill: true,
        mainElbows: 2,
        tankFillElbows: 2,
        elbowsPerBranch: 1,
        elbowsPerOutlet: 1,
        faucetElbowsPerOutlet: 1,
      },
      expected: {
        mainElbows: 2,
        endElbows: 0,
        endReducer: null,
        tankFillElbows: 2,
        branchElbows: [
          { size: '1"', count: 1 },
          { size: '3/4"', count: 1 },
          { size: '1/2"', count: 2 },
        ],
        outletElbows: 11,
        faucetElbows: 11,
      },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Fitting air bersih diperkirakan dari jumlah jalur: pipa utama ${o.mainElbows} elbow${o.endElbows > 0 ? ` + ${o.endElbows} elbow di ujungnya${o.endReducer ? ` dengan reducer ke ${o.endReducer}` : ''}` : ''}${i.hasTankFill ? `, pengisi toren ${o.tankFillElbows} elbow` : ''}, ${i.elbowsPerBranch} elbow per cabang, dan tiap titik air ${i.elbowsPerOutlet} elbow + ${i.faucetElbowsPerOutlet} faucet elbow (${i.outletCount} titik). Perkiraan sampai denahnya ada.`,
      en: `Clean-water fittings are estimated from the number of runs: main ${o.mainElbows} elbows${o.endElbows > 0 ? ` + ${o.endElbows} elbow at its end${o.endReducer ? ` with a reducer to ${o.endReducer}` : ''}` : ''}${i.hasTankFill ? `, tank fill ${o.tankFillElbows} elbows` : ''}, ${i.elbowsPerBranch} elbow per branch, and per outlet ${i.elbowsPerOutlet} elbow + ${i.faucetElbowsPerOutlet} faucet elbow (${i.outletCount} outlets). An estimate until the floor plan is known.`,
    }),
};

export const GROUP_K = [
  ENG_701,
  ENG_702,
  ENG_703,
  ENG_704,
  ENG_705,
  ENG_706,
  ENG_707,
  ENG_708,
] as const;
