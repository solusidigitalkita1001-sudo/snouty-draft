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
        id: 'perkiraan, ukuran rumah belum disebut',
        en: 'estimated, house size not given',
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
  version: 1,
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
    teeCount: i.branchCount,
  }),
  sourceReference:
    'Perkiraan tanpa denah: cabang = jumlah cabang × panjang rumah; sambungan = titik air × panjang sambungan; tee = 1 per cabang',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'rumah 12 m, 2 cabang, 7 titik, sambungan 1,5 m → cabang 24 m, sambungan 10,5 m, 2 tee',
      input: { planLengthM: 12, branchCount: 2, outletCount: 7, fixtureDropM: 1.5 },
      expected: { branchNetM: 24, fixtureNetM: 10.5, teeCount: 2 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Cabang ${i.branchCount} × panjang rumah ${i.planLengthM} m = ${o.branchNetM} m; sambungan ke alat ${i.outletCount} titik × ${i.fixtureDropM} m = ${o.fixtureNetM} m; ${o.teeCount} tee, satu per cabang. Perkiraan sampai denahnya ada.`,
      en: `Branches ${i.branchCount} × house length ${i.planLengthM} m = ${o.branchNetM} m; fixture connections ${i.outletCount} outlets × ${i.fixtureDropM} m = ${o.fixtureNetM} m; ${o.teeCount} tees, one per branch. An estimate until the floor plan is known.`,
    }),
};

export const GROUP_K = [ENG_701, ENG_702, ENG_703, ENG_704, ENG_705, ENG_706] as const;
