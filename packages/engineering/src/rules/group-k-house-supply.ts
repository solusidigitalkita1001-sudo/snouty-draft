/**
 * Kelompok K — air bersih rumah (laporan pemilik 2026-10-12: "koreksi itungannya udh bener
 * belom"). Menggantikan ambang prototipe ENG-002 ("unit beban ≥ 8 → 1", selain itu 3/4"") yang
 * tidak memperhitungkan debit, panjang jalur, tinggi, maupun sumber air.
 *
 *   ENG-701  kebutuhan puncak: unit beban suplai (WSFU) tiap alat dari UPC Tabel A 103.1 → debit
 *            puncak lewat kurva Hunter untuk sistem kloset tangki (IPC Tabel E103.3(3));
 *   ENG-702  jalur dan elevasi: dari sumber ke titik air tertinggi, menurut ukuran rumah, jumlah
 *            lantai, dan jenis sumber;
 *   ENG-703  tekanan di titik tertinggi untuk toren atap (gravitasi): tinggi toren − kehilangan;
 *            kurang → dudukan toren minimum di samping pompa pendorong;
 *   ENG-709  pompa sumur: kedalaman muka air terhadap batas sedot pompa permukaan;
 *   ENG-710  tekanan di meteran / pompa supaya air sampai ke toren atap lewat pipa pengisi.
 *
 * Ukuran pipanya dipilih Kelompok F (kecepatan + kehilangan tekanan) dengan debit dan jalur ini.
 * Semua `REQUIRES_DOMAIN_VALIDATION`: nilai UPC dan IPC menunggu padanan SNI 8153 dari tim teknis
 * Pralon (OQ-88: keduanya dibaca, UPC menang bila berbeda).
 */

import { localized, requireInt, requireNumber, RuleInputError, type RuleVersion } from '../rule.js';
import { barToHeadM, headMToBar, round1, round2, round3 } from '../units.js';
import { frictionLossOf } from './group-f-pressurized.js';

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
/**
 * Beban alat terbesar yang tercakup kurva Hunter yang dipakai di sini (IPC Tabel E103.3(3)).
 * Di atas ini debit puncaknya tidak ada di tabel — dan tidak boleh dikarang, jadi kasusnya
 * diteruskan ke tim teknis Pralon (produksi 2026-10-27: sekolah 3 lantai 24 toilet = 156 WSFU
 * membuat analisisnya gagal tanpa penjelasan).
 */
export const HUNTER_TABLE_MAX_WSFU = 100;

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

/** Beban alat suplai rumah (WSFU) — satu aritmetika untuk aturannya dan untuk pemeriksa cakupan. */
export function houseSupplyWsfu(i: SupplyDemandInput): number {
  return (
    i.waterClosets * i.wsfuWaterCloset +
    i.showers * i.wsfuShower +
    i.lavatories * i.wsfuLavatory +
    i.kitchenSinks * i.wsfuKitchenSink
  );
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
    const wsfu = houseSupplyWsfu(i);
    if (wsfu > HUNTER_TABLE_MAX_WSFU) {
      // Di atas tabel bukan lagi rumah: kasus gedung bertingkat punya metodenya sendiri.
      throw new RuleInputError('ENG-701', `wsfu ${round1(wsfu)} > ${HUNTER_TABLE_MAX_WSFU}`);
    }
    const gpm = hunterGpm(wsfu);
    return { wsfu: round1(wsfu), peakFlowGpm: round1(gpm), peakFlowLs: round3(gpm * GPM_TO_LS) };
  },
  sourceReference:
    'Beban alat dari UPC Tabel A 103.1 (kolom pemakaian pribadi); debit puncak dari kurva Hunter untuk kloset tangki (IPC Tabel E103.3(3)) karena kurva UPC hanya terbit sebagai grafik, interpolasi linear; 1 gpm = 0,0631 l/s',
  standard: 'UPC Table A 103.1; IPC Appendix E, Table E103.3(3)',
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
  /**
   * Kedalaman muka air sumur di bawah tanah — hanya sumber `pump` (sumur). Pompa mengangkat air
   * dari muka air itu, jadi tinggi angkatnya bertambah sedalam ini (review putaran 3, 1b).
   */
  readonly wellDepthM: number;
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
  // v3 (2026-10-13, review putaran 3): sumur menambah kedalaman muka airnya ke tinggi angkat.
  version: 3,
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
      wellDepthM: requireNumber('ENG-702', 'wellDepthM', o['wellDepthM'] ?? 0, {
        min: 0,
        max: 100,
      }),
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
    const lift = i.source === 'pump' ? i.wellDepthM : 0;
    return {
      highestOutletM: round2(highestOutletM),
      tankLevelM: null,
      staticHeadM: round2(highestOutletM + lift),
      routeLengthM: round1(highestOutletM + lift + i.horizontalRunM + i.yardM),
    };
  },
  sourceReference:
    'Titik tertinggi = (lantai − 1) × tinggi lantai + tinggi titik air; toren atap di atas atap (lantai × tinggi lantai + tinggi dudukan); sumur menambah kedalaman muka airnya; jalur = beda tinggi + jalur datar terjauh (+ halaman untuk sumber di depan tanah)',
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
        wellDepthM: 0,
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
        wellDepthM: 0,
      },
      expected: { highestOutletM: 5.5, tankLevelM: null, staticHeadM: 5.5, routeLengthM: 33.5 },
    },
    {
      name: 'sumur, muka air 6 m, 3 lantai × 3,5 m → angkat 9 + 6 = 15 m',
      input: {
        source: 'pump',
        floors: 3,
        floorHeightM: 3.5,
        horizontalRunM: 18,
        routeBasis: 'plan',
        outletHeightM: 2,
        tankStandM: 0,
        yardM: 0,
        wellDepthM: 6,
      },
      expected: { highestOutletM: 9, tankLevelM: null, staticHeadM: 15, routeLengthM: 33 },
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
      : i.source === 'pump' && i.wellDepthM > 0
        ? localized(locale, {
            id: `Air diangkat ${o.staticHeadM} m: ${i.wellDepthM} m dari muka air sumur ke permukaan tanah, lalu ${o.highestOutletM} m ke titik air tertinggi; jalurnya ${o.routeLengthM} m, termasuk ${i.horizontalRunM} m mendatar (${run.id})${i.yardM > 0 ? ` dan ${i.yardM} m halaman dari depan tanah` : ''}.`,
            en: `Water is lifted ${o.staticHeadM} m: ${i.wellDepthM} m from the well water level to the ground, then ${o.highestOutletM} m to the highest outlet; the run is ${o.routeLengthM} m, including ${i.horizontalRunM} m horizontal (${run.en})${i.yardM > 0 ? ` and ${i.yardM} m of yard from the front of the plot` : ''}.`,
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
  /** Kehilangan per meter jalur (kehilangan ÷ panjang jalur); 0 = diabaikan. */
  readonly lossPerRouteM: number;
  readonly minimumBar: number;
  /** Tinggi dudukan toren yang dipakai sekarang (muka air di atas atap). */
  readonly tankStandM: number;
}
export interface GravityPressureResult {
  readonly residualBar: number;
  readonly boosterNeeded: boolean;
  /**
   * Dudukan toren terendah yang memberi tekanan minimum dengan pipa yang sama, dibulatkan ke atas
   * per 0,5 m — pilihan di samping pompa pendorong (review putaran 3, 1d). `null` bila cukup.
   */
  readonly minimumStandM: number | null;
  /**
   * Beda tinggi toren sendiri sudah di bawah tekanan minimum: pipa sebesar apa pun tidak menolong,
   * hanya toren yang lebih tinggi atau pompa.
   */
  readonly heightShort: boolean;
}

/** Kenaikan dudukan toren yang masuk akal di lapangan. */
const STAND_STEP_M = 0.5;

export const ENG_703: RuleVersion<GravityPressureInput, GravityPressureResult> = {
  ruleId: 'ENG-703',
  // v2 (2026-10-13, review putaran 3): dudukan toren minimum dan "beda tinggi tidak cukup".
  // v3 (P27-02): dudukan yang disarankan ikut menanggung kehilangan di pipa tegak tambahannya.
  version: 3,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      availableHeadM: requireNumber('ENG-703', 'availableHeadM', o['availableHeadM'], {
        min: -100,
        max: 100,
      }),
      lossM: requireNumber('ENG-703', 'lossM', o['lossM'], { min: 0, max: 1000 }),
      lossPerRouteM:
        o['lossPerRouteM'] === undefined
          ? 0
          : requireNumber('ENG-703', 'lossPerRouteM', o['lossPerRouteM'], { min: 0, max: 0.9 }),
      minimumBar: requireNumber('ENG-703', 'minimumBar', o['minimumBar'], { min: 0, max: 5 }),
      tankStandM: requireNumber('ENG-703', 'tankStandM', o['tankStandM'], { min: 0, max: 15 }),
    };
  },
  compute: (i) => {
    const residualBar = round2(headMToBar(i.availableHeadM - i.lossM));
    const boosterNeeded = residualBar < i.minimumBar;
    const requiredHeadM = barToHeadM(i.minimumBar);
    // Kekurangan tinggi dengan pipa yang sama. Menaikkan dudukan memperpanjang jalur, jadi
    // kehilangannya ikut naik: tinggi tambahan harus menutup kekurangan DAN kehilangan di pipa
    // sepanjang tambahan itu sendiri (v3) — dulu diabaikan, dan sejak kerugian sambungan dihitung
    // per fitting (ENG-207) selisihnya cukup besar untuk membuat saran dudukan masih kurang.
    const deficitM = requiredHeadM + i.lossM - i.availableHeadM;
    const raiseM = deficitM / Math.max(1 - i.lossPerRouteM, 0.1);
    const minimumStandM = boosterNeeded
      ? Math.ceil(round3((i.tankStandM + raiseM) / STAND_STEP_M)) * STAND_STEP_M
      : null;
    return {
      residualBar,
      boosterNeeded,
      minimumStandM,
      heightShort: boosterNeeded && i.availableHeadM < requiredHeadM,
    };
  },
  sourceReference:
    'Tekanan sisa = (beda tinggi toren − kehilangan gesek dan sambungan) ÷ 10,197 m/bar; di bawah minimum → pompa pendorong, atau dudukan toren dinaikkan sebesar kekurangannya (dibulatkan per 0,5 m)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'toren 2,5 m di atas shower, kehilangan 1,2 m, minimum 0,3 bar → 0,13 bar, perlu pendorong',
      input: { availableHeadM: 2.5, lossM: 1.2, lossPerRouteM: 0, minimumBar: 0.3, tankStandM: 1 },
      // 3,06 + 1,2 − 2,5 = 1,76 m kurang → dudukan 2,76 m → 3 m. Beda tinggi 2,5 m < 3,06 m.
      expected: { residualBar: 0.13, boosterNeeded: true, minimumStandM: 3, heightShort: true },
    },
    {
      name: 'toren 1 lantai: 2,5 m beda tinggi, kehilangan 0,2 m → 0,23 bar, dudukan 2 m',
      input: { availableHeadM: 2.5, lossM: 0.2, lossPerRouteM: 0, minimumBar: 0.3, tankStandM: 1 },
      expected: { residualBar: 0.23, boosterNeeded: true, minimumStandM: 2, heightShort: true },
    },
    {
      name: 'toren 5 m di atas, kehilangan 1 m → 0,39 bar, cukup',
      input: { availableHeadM: 5, lossM: 1, lossPerRouteM: 0, minimumBar: 0.3, tankStandM: 1 },
      expected: {
        residualBar: 0.39,
        boosterNeeded: false,
        minimumStandM: null,
        heightShort: false,
      },
    },
  ],
  explain: (i, o, locale) => {
    const need = round2(barToHeadM(i.minimumBar));
    const short = o.heightShort
      ? {
          id: ` Beda tinggi ${round2(i.availableHeadM)} m sendiri sudah kurang dari ${need} m, jadi pipa yang lebih besar pun tidak menolong.`,
          en: ` The ${round2(i.availableHeadM)} m height difference alone is under ${need} m, so a larger pipe does not help.`,
        }
      : { id: '', en: '' };
    return localized(locale, {
      id: `Dari toren atap, titik air tertinggi mendapat ${o.residualBar} bar (${round2(i.availableHeadM)} m beda tinggi − ${round2(i.lossM)} m kehilangan). ${o.boosterNeeded ? `Itu di bawah ${i.minimumBar} bar.${short.id} Pilihannya pompa pendorong, atau dudukan toren dinaikkan dari ${i.tankStandM} m ke ${o.minimumStandM} m di atas atap.` : `Itu cukup (minimal ${i.minimumBar} bar), tanpa pompa pendorong.`}`,
      en: `From the roof tank the highest outlet gets ${o.residualBar} bar (${round2(i.availableHeadM)} m height difference − ${round2(i.lossM)} m loss). ${o.boosterNeeded ? `That is below ${i.minimumBar} bar.${short.en} The options are a booster pump, or raising the tank stand from ${i.tankStandM} m to ${o.minimumStandM} m above the roof.` : `That is enough (at least ${i.minimumBar} bar), with no booster pump.`}`,
    });
  },
};

// ── ENG-709 · Pompa sumur: batas sedot pompa permukaan ──────────────────────

export interface WellPumpInput {
  /** Kedalaman muka air sumur di bawah tanah. */
  readonly wellDepthM: number;
  /** Batas sedot praktis pompa permukaan (pompa sedot biasa). */
  readonly suctionLimitM: number;
}
export interface WellPumpResult {
  /** Muka air lebih dalam dari batas sedot → pompa jet atau submersible. */
  readonly beyondSuction: boolean;
}

export const ENG_709: RuleVersion<WellPumpInput, WellPumpResult> = {
  ruleId: 'ENG-709',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      wellDepthM: requireNumber('ENG-709', 'wellDepthM', o['wellDepthM'], { min: 0, max: 100 }),
      suctionLimitM: requireNumber('ENG-709', 'suctionLimitM', o['suctionLimitM'], {
        min: 1,
        max: 10,
      }),
    };
  },
  compute: (i) => ({ beyondSuction: i.wellDepthM > i.suctionLimitM }),
  sourceReference:
    'Pompa permukaan menyedot dengan beda tekanan atmosfer (teoretis ±10 m, praktis ±7 m setelah kehilangan dan uap air); lebih dalam → pompa jet atau submersible',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'muka air 6 m, batas 7 m → pompa sedot cukup',
      input: { wellDepthM: 6, suctionLimitM: 7 },
      expected: { beyondSuction: false },
    },
    {
      name: 'muka air 9 m, batas 7 m → jet / submersible',
      input: { wellDepthM: 9, suctionLimitM: 7 },
      expected: { beyondSuction: true },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: o.beyondSuction
        ? `Muka air sumur ${i.wellDepthM} m lebih dalam dari batas sedot pompa biasa (±${i.suctionLimitM} m), jadi pakai pompa jet atau pompa submersible.`
        : `Muka air sumur ${i.wellDepthM} m masih dalam batas sedot pompa biasa (±${i.suctionLimitM} m).`,
      en: o.beyondSuction
        ? `The well water level at ${i.wellDepthM} m is deeper than a surface pump can lift (about ${i.suctionLimitM} m), so use a jet pump or a submersible pump.`
        : `The well water level at ${i.wellDepthM} m is within a surface pump's suction lift (about ${i.suctionLimitM} m).`,
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
    'Pengelompokan tanpa denah: kamar mandi (tidak dipisah), lalu wastafel, urinoir, lalu bak cuci dapur, maks 4 titik per cabang, cabang per lantai; beban cabang = jumlah WSFU isinya (UPC Tabel A 103.1)',
  standard: 'UPC Table A 103.1',
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

// ── ENG-710 · Tekanan di meteran untuk mengisi toren atap ───────────────────

export interface TankFillPressureInput {
  /** Muka air toren di atas tanah (meteran di permukaan tanah). */
  readonly tankLevelM: number;
  readonly fillNetM: number;
  readonly flowLs: number;
  readonly innerDiameterMm: number;
  readonly hazenWilliamsC: number;
  readonly minorLossFraction: number;
}
export interface TankFillPressureResult {
  readonly frictionLossM: number;
  readonly minorLossM: number;
  readonly requiredHeadM: number;
  readonly requiredBar: number;
}

/**
 * Review putaran 3 (5b): tekanan yang harus ada di meteran PDAM (atau pompa) supaya air naik ke
 * toren atap lewat pipa pengisi = tinggi muka air toren + kehilangan gesek dan sambungan pada debit
 * pengisian. Di bawah itu toren tidak terisi — tampung dulu di bawah dan pompa.
 */
export const ENG_710: RuleVersion<TankFillPressureInput, TankFillPressureResult> = {
  ruleId: 'ENG-710',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      tankLevelM: requireNumber('ENG-710', 'tankLevelM', o['tankLevelM'], { min: 1, max: 200 }),
      fillNetM: requireNumber('ENG-710', 'fillNetM', o['fillNetM'], { min: 1, max: 2000 }),
      flowLs: requireNumber('ENG-710', 'flowLs', o['flowLs'], { min: 0.01, max: 10 }),
      innerDiameterMm: requireNumber('ENG-710', 'innerDiameterMm', o['innerDiameterMm'], {
        min: 5,
        max: 200,
      }),
      hazenWilliamsC: requireNumber('ENG-710', 'hazenWilliamsC', o['hazenWilliamsC'], {
        min: 60,
        max: 160,
      }),
      minorLossFraction: requireNumber('ENG-710', 'minorLossFraction', o['minorLossFraction'], {
        min: 0,
        max: 1,
      }),
    };
  },
  compute: (i) => {
    const { frictionLossM } = frictionLossOf(
      i.flowLs,
      i.innerDiameterMm,
      i.fillNetM,
      i.hazenWilliamsC,
    );
    const minorLossM = round2(frictionLossM * i.minorLossFraction);
    const requiredHeadM = round2(i.tankLevelM + frictionLossM + minorLossM);
    return {
      frictionLossM,
      minorLossM,
      requiredHeadM,
      requiredBar: round2(headMToBar(requiredHeadM)),
    };
  },
  sourceReference:
    'Tekanan di meteran = (tinggi muka air toren + kehilangan gesek Hazen-Williams + kehilangan sambungan) ÷ 10,197 m/bar, pada debit pengisian',
  standard: 'Hazen-Williams (SI)',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'toren 4,5 m, pipa ¾" (dalam 24 mm) 29,5 m, 0,25 l/s, C 150, sambungan 10%',
      input: {
        tankLevelM: 4.5,
        fillNetM: 29.5,
        flowLs: 0.25,
        innerDiameterMm: 24,
        hazenWilliamsC: 150,
        minorLossFraction: 0.1,
      },
      expected: { frictionLossM: 0.49, minorLossM: 0.05, requiredHeadM: 5.04, requiredBar: 0.49 },
    },
  ],
  explain: (i, o, locale) =>
    localized(locale, {
      id: `Supaya toren terisi, meteran atau pompa harus memberi minimal ${o.requiredBar} bar: naik ${i.tankLevelM} m ke muka air toren + ${o.frictionLossM} m gesek di pipa pengisi ${i.fillNetM} m + ${o.minorLossM} m sambungan, pada debit pengisian ${i.flowLs} l/s. Kalau tekanan PDAM di bawah itu, tampung dulu di bawah lalu pompa ke toren.`,
      en: `To fill the tank the meter or pump must give at least ${o.requiredBar} bar: ${i.tankLevelM} m up to the tank water level + ${o.frictionLossM} m friction in the ${i.fillNetM} m fill pipe + ${o.minorLossM} m in fittings, at a fill rate of ${i.flowLs} l/s. If the mains pressure is lower, store the water below first and pump it up.`,
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

// ── ENG-711 · Pilihan dudukan toren: dak atap atau tiang toren ─────────────

/**
 * Tinggi tiang toren yang lazim dipasang di rumah (m dari tanah ke dudukan toren). Daftar pasar,
 * bukan standar: menunggu pengesahan ahli Pralon (OQ-67).
 */
export const TANK_TOWER_HEIGHTS_M = [3, 4, 5, 6, 8] as const;

export type TankSupportKind = 'roof_slab' | 'tower';

export interface TankStandOptionsInput {
  /** Tinggi pelat atap (dak) dari tanah. */
  readonly roofHeightM: number;
  /** Titik air tertinggi dari tanah (kepala shower lantai teratas). */
  readonly highestOutletM: number;
  /** Muka air toren di atas dudukannya (asumsi TANK_STAND_1M). */
  readonly standM: number;
  /** Kehilangan gesek + sambungan di pipa utama pada ukuran yang dipilih. */
  readonly lossM: number;
  readonly minimumBar: number;
  /** Tekanan yang terasa deras di shower; di atas `minimumBar`. */
  readonly comfortBar: number;
  readonly towerHeightsM: readonly number[];
}

export interface TankStandOption {
  readonly kind: TankSupportKind;
  /** Tinggi dudukan dari tanah: pelat atap, atau puncak tiang. */
  readonly supportHeightM: number;
  readonly waterLevelM: number;
  /** Beda tinggi muka air ke titik air tertinggi. */
  readonly headM: number;
  readonly residualBar: number;
  readonly meetsMinimum: boolean;
  readonly comfortable: boolean;
}

export interface TankStandOptionsResult {
  readonly options: readonly TankStandOption[];
  /** Indeks pilihan terendah yang memenuhi tekanan minimum; `null` bila tidak ada. */
  readonly recommendedIndex: number | null;
  /** Indeks pilihan terendah yang terasa deras; `null` bila tidak ada. */
  readonly comfortableIndex: number | null;
}

export const ENG_711: RuleVersion<TankStandOptionsInput, TankStandOptionsResult> = {
  ruleId: 'ENG-711',
  version: 1,
  category: 'load_sizing',
  parseInput: (raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const towers = o['towerHeightsM'];
    if (!Array.isArray(towers) || towers.length > 20) {
      throw new RuleInputError('ENG-711', 'towerHeightsM harus daftar tinggi tiang (≤ 20)');
    }
    const minimumBar = requireNumber('ENG-711', 'minimumBar', o['minimumBar'], { min: 0, max: 5 });
    return {
      roofHeightM: requireNumber('ENG-711', 'roofHeightM', o['roofHeightM'], { min: 1, max: 100 }),
      highestOutletM: requireNumber('ENG-711', 'highestOutletM', o['highestOutletM'], {
        min: 0,
        max: 100,
      }),
      standM: requireNumber('ENG-711', 'standM', o['standM'], { min: 0, max: 15 }),
      lossM: requireNumber('ENG-711', 'lossM', o['lossM'], { min: 0, max: 1000 }),
      minimumBar,
      comfortBar: requireNumber('ENG-711', 'comfortBar', o['comfortBar'], {
        min: minimumBar,
        max: 5,
      }),
      towerHeightsM: towers.map((h, n) =>
        requireNumber('ENG-711', `towerHeightsM[${n}]`, h, { min: 1, max: 30 }),
      ),
    };
  },
  compute: (i) => {
    // Kehilangan di pipa tegak tambahan diabaikan (beberapa sentimeter), sama seperti ENG-703.
    const option = (kind: TankSupportKind, supportHeightM: number): TankStandOption => {
      const waterLevelM = round2(supportHeightM + i.standM);
      const headM = round2(waterLevelM - i.highestOutletM);
      const residualBar = round2(headMToBar(headM - i.lossM));
      return {
        kind,
        supportHeightM,
        waterLevelM,
        headM,
        residualBar,
        meetsMinimum: residualBar >= i.minimumBar,
        comfortable: residualBar >= i.comfortBar,
      };
    };
    const roof = option('roof_slab', i.roofHeightM);
    // Tiang yang muka airnya di bawah dak tidak lebih baik daripada dak — tidak ditawarkan.
    const towers = i.towerHeightsM
      .filter((h) => h + i.standM > roof.waterLevelM)
      .sort((a, b) => a - b)
      .map((h) => option('tower', h));
    const options = [roof, ...towers];
    const firstIndex = (test: (o: TankStandOption) => boolean) => {
      const n = options.findIndex(test);
      return n === -1 ? null : n;
    };
    return {
      options,
      recommendedIndex: firstIndex((o) => o.meetsMinimum),
      comfortableIndex: firstIndex((o) => o.comfortable),
    };
  },
  sourceReference:
    'Tekanan sisa tiap dudukan = (muka air − titik air tertinggi − kehilangan pipa utama) ÷ 10,197 m/bar; dudukan dak = pelat atap + TANK_STAND_1M, tiang toren = tinggi tiang + TANK_STAND_1M; ambang deras di shower 0,7 kg/cm² (Noerbambang & Morimura)',
  standard: 'Noerbambang & Morimura, Perancangan dan Pemeliharaan Sistem Plambing',
  validationStatus: PENDING,
  testCases: [
    {
      name: 'rumah 1 lantai 3,5 m, shower 2 m, kehilangan 0,5 m: dak 0,2 bar kurang; tiang 5 m cukup; tidak ada yang deras',
      input: {
        roofHeightM: 3.5,
        highestOutletM: 2,
        standM: 1,
        lossM: 0.5,
        minimumBar: 0.3,
        comfortBar: 0.7,
        towerHeightsM: [3, 4, 5, 6, 8],
      },
      expected: {
        options: [
          {
            kind: 'roof_slab',
            supportHeightM: 3.5,
            waterLevelM: 4.5,
            headM: 2.5,
            residualBar: 0.2,
            meetsMinimum: false,
            comfortable: false,
          },
          {
            kind: 'tower',
            supportHeightM: 4,
            waterLevelM: 5,
            headM: 3,
            residualBar: 0.25,
            meetsMinimum: false,
            comfortable: false,
          },
          {
            kind: 'tower',
            supportHeightM: 5,
            waterLevelM: 6,
            headM: 4,
            residualBar: 0.34,
            meetsMinimum: true,
            comfortable: false,
          },
          {
            kind: 'tower',
            supportHeightM: 6,
            waterLevelM: 7,
            headM: 5,
            residualBar: 0.44,
            meetsMinimum: true,
            comfortable: false,
          },
          {
            kind: 'tower',
            supportHeightM: 8,
            waterLevelM: 9,
            headM: 7,
            residualBar: 0.64,
            meetsMinimum: true,
            comfortable: false,
          },
        ],
        recommendedIndex: 2,
        comfortableIndex: null,
      },
    },
    {
      name: 'rumah 2 lantai 7 m, shower 5,5 m, kehilangan 0,3 m: dak 0,22 bar; hanya tiang 8 m yang lebih tinggi dari dak',
      input: {
        roofHeightM: 7,
        highestOutletM: 5.5,
        standM: 1,
        lossM: 0.3,
        minimumBar: 0.3,
        comfortBar: 0.7,
        towerHeightsM: [3, 4, 5, 6, 8],
      },
      expected: {
        options: [
          {
            kind: 'roof_slab',
            supportHeightM: 7,
            waterLevelM: 8,
            headM: 2.5,
            residualBar: 0.22,
            meetsMinimum: false,
            comfortable: false,
          },
          {
            kind: 'tower',
            supportHeightM: 8,
            waterLevelM: 9,
            headM: 3.5,
            residualBar: 0.31,
            meetsMinimum: true,
            comfortable: false,
          },
        ],
        recommendedIndex: 1,
        comfortableIndex: null,
      },
    },
    {
      name: 'dak sudah cukup dan deras → dak direkomendasikan, tiang yang lebih tinggi tetap ditampilkan',
      input: {
        roofHeightM: 3.5,
        highestOutletM: 0,
        standM: 1,
        lossM: 0.2,
        minimumBar: 0.3,
        comfortBar: 0.4,
        towerHeightsM: [4],
      },
      expected: {
        options: [
          {
            kind: 'roof_slab',
            supportHeightM: 3.5,
            waterLevelM: 4.5,
            headM: 4.5,
            residualBar: 0.42,
            meetsMinimum: true,
            comfortable: true,
          },
          {
            kind: 'tower',
            supportHeightM: 4,
            waterLevelM: 5,
            headM: 5,
            residualBar: 0.47,
            meetsMinimum: true,
            comfortable: true,
          },
        ],
        recommendedIndex: 0,
        comfortableIndex: 0,
      },
    },
  ],
  explain: (i, o, locale) => {
    const label = (opt: TankStandOption) =>
      opt.kind === 'roof_slab'
        ? {
            id: `di dak (muka air ${opt.waterLevelM} m)`,
            en: `on the roof slab (water level ${opt.waterLevelM} m)`,
          }
        : {
            id: `tiang ${opt.supportHeightM} m (muka air ${opt.waterLevelM} m)`,
            en: `${opt.supportHeightM} m tower (water level ${opt.waterLevelM} m)`,
          };
    const rows = o.options.map((opt) => ({
      id: `${label(opt).id} → ${opt.residualBar} bar`,
      en: `${label(opt).en} → ${opt.residualBar} bar`,
    }));
    const rec = o.recommendedIndex === null ? null : o.options[o.recommendedIndex]!;
    const comfy = o.comfortableIndex === null ? null : o.options[o.comfortableIndex]!;
    return localized(locale, {
      id: `Muka air toren dihitung dari tiap dudukan (dak atau tiang) ditambah ${i.standM} m, dikurangi titik air tertinggi ${i.highestOutletM} m dan kehilangan ${i.lossM} m: ${rows.map((r) => r.id).join('; ')}. ${
        rec
          ? `Tanpa pompa, dudukan terendah yang memberi ${i.minimumBar} bar adalah ${label(rec).id}${comfy ? `; terasa deras di shower (${i.comfortBar} bar) mulai ${label(comfy).id}` : `; tidak ada yang mencapai ${i.comfortBar} bar (deras di shower) tanpa pompa`}.`
          : `Tidak ada dudukan di daftar yang mencapai ${i.minimumBar} bar; perlu pompa pendorong atau tiang yang lebih tinggi.`
      }`,
      en: `The tank water level is taken from each support (roof slab or tower) plus ${i.standM} m, minus the highest outlet at ${i.highestOutletM} m and ${i.lossM} m of loss: ${rows.map((r) => r.en).join('; ')}. ${
        rec
          ? `Without a pump, the lowest support giving ${i.minimumBar} bar is ${label(rec).en}${comfy ? `; a strong shower (${i.comfortBar} bar) starts at ${label(comfy).en}` : `; none reaches ${i.comfortBar} bar (a strong shower) without a pump`}.`
          : `No support in the list reaches ${i.minimumBar} bar; a booster pump or a taller tower is needed.`
      }`,
    });
  },
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
  ENG_709,
  ENG_710,
  ENG_711,
] as const;
