/**
 * Orkestrator engine air bersih rumah/bangunan kecil: satu panggilan, satu trace per aturan.
 * docs/ENGINEERING_RULES.md §2 · SPEC §8.
 *
 * **Murni.** Tanpa I/O, tanpa jam, tanpa acak — masukan sama selalu menghasilkan keluaran sama.
 *
 * Sejak 2026-10-12 (laporan pemilik "koreksi itungannya udh bener belom") ukuran pipa utama
 * dihitung hidraulik, bukan dari ambang prototipe ENG-002 ("unit beban ≥ 8 → 1""):
 *   1. titik air dan cabang (ENG-001 v2, ENG-003) — kamar mandi = shower + kloset, dua titik;
 *   2. debit puncak dari unit beban suplai dan kurva Hunter (ENG-701);
 *   3. jalur dan beda tinggi dari ukuran rumah, lantai, dan sumber (ENG-702);
 *   4. ukuran pipa utama lewat kecepatan dan kehilangan tekanan (Kelompok F); untuk toren atap
 *      dipilih ukuran terkecil yang masih menyisakan tekanan minimum di titik tertinggi (ENG-703);
 *   5. cabang dari debit per cabang pada kecepatan rencana (ENG-102).
 * Jumlah material TIDAK dikarang lagi (ENG-009 dulu: "2 + lantai batang"): engine hanya memberi
 * panjang jalur utama bila ukurannya diketahui; jumlah beli dihitung API dari panjang batang
 * produk katalog yang terpilih.
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import { computePressurized, type PressurizedResult } from './compute-pressurized.js';
import {
  ENG_001,
  ENG_005,
  ENG_010,
  ENG_013,
  type PressureClass,
} from './rules/group-a-load-sizing.js';
import { ENG_004, ENG_008, type FloorNode } from './rules/group-b-geometry.js';
import { ENG_012, pipeJointsPerRun } from './rules/group-c-material.js';
import { ENG_102 } from './rules/group-e-irrigation.js';
import { ENG_801, ENG_802 } from './rules/group-l-worship.js';
import {
  ENG_701,
  ENG_702,
  ENG_703,
  ENG_704,
  ENG_708,
  ENG_709,
  ENG_710,
  ENG_711,
  ENG_705,
  ENG_706,
  ENG_707,
  hunterGpm,
  type FilledBranch,
  type HouseSupplyFittingResult,
  minimumHeadM,
  type RouteBasis,
  TANK_TOWER_HEIGHTS_M,
  type TankStandOptionsResult,
} from './rules/group-k-house-supply.js';
import type { RuleVersion } from './rule.js';
import { assertBalanced } from './consistency.js';
import { round1, round2, round3 } from './units.js';
import { PVC_INCH_SIZES, sizeTable } from './parameters/size-tables.js';

export interface SolutionInput {
  readonly buildingType:
    | 'residential'
    | 'boarding_house'
    | 'light_commercial'
    | 'industrial'
    | 'place_of_worship'
    | 'public_building';
  readonly floors: number;
  readonly bathrooms: number;
  /** Wastafel total; `null` = belum disebut → HOUSE_BASINS_0 (tampil di tabel asumsi). */
  readonly basins: number | null;
  /** `null` = belum disebut → asumsi satu dapur (HOUSE_KITCHEN_1), bukan nol diam-diam. */
  readonly kitchens: number | null;
  readonly waterSource: 'rooftop_tank' | 'ground_tank' | 'pump' | 'municipal';
  readonly installationType: 'clean_water' | 'drainage' | 'both';
  /** Tinggi antar lantai bila pengguna memberikannya; `null` → ENG-004. */
  readonly floorHeightM: number | null;
  /** Panjang jalur utama yang disebut pengguna; menang atas ukuran rumah. */
  readonly mainRunMeters: number | null;
  /** Ukuran denah rumah (m); keduanya ada → jalur datar terjauh = panjang + lebar. */
  readonly planLengthM?: number | null;
  readonly planWidthM?: number | null;
  /** Tempat ibadah (Kelompok L): keran wudhu dan jumlah tempat wudhu (deret). */
  readonly wudhuTaps?: number | null;
  /** Urinoir toilet pria (tempat ibadah), di lantai dasar. */
  readonly urinals?: number | null;
  readonly wudhuAreas?: number | null;
  /** Ukuran tanah — hanya untuk jarak halaman (ENG-705); bukan dasar panjang pipa di bangunan. */
  readonly landLengthM?: number | null;
  readonly landWidthM?: number | null;
  /** Sumur (`waterSource: 'pump'`): kedalaman muka air; kosong → WELL_WATER_DEPTH_6M. */
  readonly wellDepthM?: number | null;
}

export interface CalculationTrace {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly inputs: unknown;
  readonly output: unknown;
  readonly provenance: Provenance;
  readonly explanation: string;
}

export interface HouseSupply {
  readonly wsfu: number;
  readonly peakFlowLs: number;
  readonly routeLengthM: number;
  readonly routeBasis: RouteBasis;
  readonly staticHeadM: number;
  /** Pipa utama dari sumber ke titik air tertinggi. */
  readonly main: PressurizedResult;
  /** Toren atap: tekanan di titik tertinggi; selain itu `null`. */
  readonly gravityResidualBar: number | null;
  /**
   * Toren atap yang tekanannya kurang (ENG-703 v2): dudukan minimum sebagai pilihan selain pompa
   * pendorong, dan apakah beda tingginya sendiri sudah kurang. `null` bila tekanannya cukup.
   */
  readonly gravityRemedy: { readonly minimumStandM: number; readonly heightShort: boolean } | null;
  /**
   * Toren atap: tekanan dari tiap dudukan yang mungkin — dak atap atau tiang toren (ENG-711), untuk
   * pertanyaan "toren harus setinggi apa supaya deras tanpa pompa". Selain toren atap `null`.
   */
  readonly tankStand: (TankStandOptionsResult & { readonly comfortBar: number }) | null;
  /** Sumur: kedalaman muka air yang dihitung dan batas sedot pompa biasa (ENG-709); selain itu `null`. */
  readonly well: {
    readonly depthM: number;
    readonly suctionLimitM: number;
    readonly beyondSuction: boolean;
  } | null;
  /** PDAM: tekanan yang harus tersedia di meteran; selain itu `null`. */
  readonly requiredSourcePressureBar: number | null;
}

export interface SolutionResult {
  readonly outletCount: number;
  readonly mainSize: string;
  readonly branchSize: string;
  readonly fixtureConnectionSize: '1/2"';
  readonly branchCount: number;
  readonly maxOutletsPerBranch: number;
  readonly floorHeightM: number;
  readonly floorsPlan: readonly FloorNode[];
  /**
   * Pompa PENDORONG tambahan — hanya toren atap yang tekanannya kurang (ENG-703). Pompa yang
   * memang bagian sumber air (sumur, toren bawah) ada di `sourcePumped`; dulu keduanya satu flag
   * sehingga sumber pompa tampil dengan pompa kedua (review putaran 3, 1a).
   */
  readonly boosterPumpNeeded: boolean;
  /** Sumber air yang dipompa sendiri: sumur atau toren bawah. */
  readonly sourcePumped: boolean;
  readonly pressureClasses: readonly PressureClass[];
  readonly supply: HouseSupply;
  /** Panjang bersih pipa utama — hanya bila jalurnya disebut atau ukuran rumahnya diketahui. */
  readonly mainRunNetM: number | null;
  /**
   * Perkiraan cabang, sambungan, dan tee dari ukuran rumah (ENG-704) — `null` bila ukuran rumah
   * belum diketahui (jalur yang disebut saja tidak cukup untuk memperkirakan cabang).
   */
  /** Cabang per ukuran (ENG-707 + ENG-102 per cabang), terbesar dulu. */
  readonly branchGroups: readonly {
    readonly size: string;
    readonly count: number;
    readonly branches: readonly FilledBranch[];
  }[];
  /** Halaman dari bangunan ke depan tanah (ENG-705); `null` tanpa ukuran tanah dan bangunan. */
  readonly yardM: number | null;
  /** Pipa pengisi toren atap (ENG-706); `null` bukan toren atap atau tanpa ukuran bangunan. */
  /**
   * Pipa pengisi toren atap; `meterBar` = tekanan minimal di meteran / pompa supaya toren terisi
   * (ENG-710, review putaran 3 5b).
   */
  readonly tankFill: {
    readonly netM: number;
    readonly size: string;
    readonly meterBar: number;
  } | null;
  readonly branchLayout: {
    readonly branchNetM: number;
    readonly fixtureNetM: number;
    readonly teeCount: number;
    /** Panjang cabang per ukuran (jumlah cabang ukuran itu × panjang per cabang ENG-704). */
    readonly bySize: readonly {
      readonly size: string;
      readonly count: number;
      readonly netM: number;
    }[];
  } | null;
  readonly targetVelocityMs: { readonly min: number; readonly max: number };
  /**
   * Tempat ibadah: deret keran wudhu (ENG-802) dan pipa pembagi tiap deret (ENG-102); `null`
   * bukan tempat ibadah atau tanpa keran wudhu.
   */
  readonly wudhu: {
    readonly taps: number;
    readonly flowLs: number;
    readonly rows: readonly {
      readonly taps: number;
      readonly flowLs: number;
      readonly lengthM: number;
      readonly size: string;
    }[];
  } | null;
  /** Fitting air bersih (ENG-708): elbow per jalur, cabang, dan titik air. */
  readonly fittings: HouseSupplyFittingResult;
  /**
   * Sisa potong pipa (%, PIPE_CUTTING_ALLOWANCE_10PCT) — ditambahkan ke panjang bersih sebelum
   * dibulatkan ke batang; `0` bila panjang pipa belum dihitung (tanpa ukuran rumah).
   */
  readonly cuttingAllowancePct: number;
  /** Ukuran cabang di ujung pipa utama — disambung elbow, bukan tee (ENG-704 v2). */
  readonly mainEndBranchSize: string | null;
  readonly appliedAssumptionIds: readonly string[];
  /** Satu trace per aturan yang dieksekusi, urut eksekusi. */
  readonly traces: readonly CalculationTrace[];
  /** Provenance paling lemah di antara seluruh trace. */
  readonly overallProvenance: Provenance;
}

/** `locale` hanya memilih bahasa `explanation` di trace; angka tidak berubah. */
export function computeSolution(
  input: SolutionInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
  overrides: AssumptionOverrides = {},
): SolutionResult {
  const traces: CalculationTrace[] = [];
  const { use, applied } = assumptionReader(overrides);
  const plan =
    typeof input.planLengthM === 'number' &&
    typeof input.planWidthM === 'number' &&
    input.planLengthM > 0 &&
    input.planWidthM > 0
      ? { lengthM: input.planLengthM, widthM: input.planWidthM }
      : null;
  const routeBasis: RouteBasis =
    input.mainRunMeters !== null ? 'stated' : plan !== null ? 'plan' : 'assumed';
  const hasRealDimensions = routeBasis !== 'assumed';

  function run<I, O>(rule: RuleVersion<I, O>, raw: unknown): O {
    const parsed = rule.parseInput(raw);
    const output = rule.compute(parsed);
    traces.push({
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      inputs: parsed,
      output,
      provenance: gateEngineProvenance({
        ruleStatus: rule.validationStatus,
        hasRealDimensions,
      }),
      explanation: rule.explain(parsed, output, locale),
    });
    return output;
  }

  // Tempat ibadah (Kelompok L): toilet umum, kamar mandi = kloset + keran, keran wudhu serentak.
  // Sekolah dan klinik (2026-10-12) memakai toilet umum yang sama, tanpa wudhu.
  const worship = input.buildingType === 'place_of_worship';
  const publicRestroom = worship || input.buildingType === 'public_building';
  const fixtures = {
    bathrooms: input.bathrooms,
    // Rumah: 1 wastafel per kamar mandi bila belum disebut (pemilik 2026-10-14, 6d); toilet umum
    // tetap 0 sampai disebut.
    basins:
      input.basins ??
      (publicRestroom
        ? use('HOUSE_BASINS_0')
        : input.bathrooms * use('HOUSE_BASINS_PER_BATHROOM_1')),
    kitchens:
      input.kitchens ?? (publicRestroom ? use('WORSHIP_KITCHEN_0') : use('HOUSE_KITCHEN_1')),
  };
  if (publicRestroom && input.bathrooms > 0) use('WORSHIP_BATHROOM_WC_TAP');
  const urinals = publicRestroom ? Math.max(0, input.urinals ?? 0) : 0;
  const load = run(ENG_001, {
    ...fixtures,
    ...(publicRestroom ? { bathroomHasTap: true } : {}),
    ...(urinals > 0 ? { urinals } : {}),
  });
  const floorHeightM = input.floorHeightM ?? run(ENG_004, {}).floorHeightM;
  const floorPlan = run(ENG_008, { ...fixtures, floors: input.floors, floorHeightM });
  // Beban per alat (UPC Tabel A 103.1) — sekali dibaca, dipakai debit total dan isi tiap
  // cabang. Rumah memakai kolom pemakaian pribadi; sekolah, klinik, dan ruko kolom umum;
  // rumah ibadah kolom pertemuan (assembly), tempat kloset dan urinoirnya lebih berat.
  // Keran kamar mandi menempati tempat shower.
  const wsfu = publicRestroom
    ? {
        waterCloset: worship
          ? use('WSFU_ASSEMBLY_WATER_CLOSET_3_5')
          : use('WSFU_PUBLIC_WATER_CLOSET_2_5'),
        shower: use('WSFU_PUBLIC_TAP_1'),
        lavatory: use('WSFU_PUBLIC_TAP_1'),
        kitchenSink: fixtures.kitchens > 0 ? use('WSFU_KITCHEN_SINK_1_5') : 1.5,
        urinal:
          urinals > 0 ? (worship ? use('WSFU_ASSEMBLY_URINAL_3') : use('WSFU_PUBLIC_URINAL_2')) : 0,
      }
    : {
        waterCloset: use('WSFU_WATER_CLOSET_2_5'),
        shower: use('WSFU_SHOWER_2'),
        lavatory: use('WSFU_LAVATORY_1'),
        kitchenSink: use('WSFU_KITCHEN_SINK_1_5'),
        urinal: 0,
      };
  // Isi tiap cabang per lantai (ENG-707, temuan laporan 0009): ukuran cabang dari isinya sendiri.
  const branches = run(ENG_707, {
    floors: floorPlan.floorsPlan.map((f) => ({
      floor: f.floor,
      bathrooms: f.bathrooms,
      basins: f.basins,
      kitchens: f.kitchens,
      // Urinoir di toilet pria lantai dasar.
      urinals: f.floor === 1 ? urinals : 0,
    })),
    maxOutletsPerBranch: 4,
    wsfuWaterCloset: wsfu.waterCloset,
    wsfuShower: wsfu.shower,
    wsfuLavatory: wsfu.lavatory,
    wsfuKitchenSink: wsfu.kitchenSink,
    wsfuUrinal: wsfu.urinal,
  });
  // Satu sumber jumlah alat (laporan 0015): sebaran per lantai dan isi cabang wajib sama dengan total.
  const perFloor = floorPlan.floorsPlan;
  assertBalanced(
    'kamar mandi per lantai',
    input.bathrooms,
    perFloor.map((f) => f.bathrooms),
  );
  assertBalanced(
    'wastafel per lantai',
    fixtures.basins,
    perFloor.map((f) => f.basins),
  );
  assertBalanced(
    'dapur per lantai',
    fixtures.kitchens,
    perFloor.map((f) => f.kitchens),
  );
  assertBalanced(
    'titik air per cabang',
    load.outletCount,
    branches.branches.map((b) => b.outlets),
  );
  const connection = run(ENG_005, {});
  const velocity = run(ENG_010, {
    minMs: use('VELOCITY_MIN_SELF_CLEANING'),
    maxMs: use('VELOCITY_MAX_PLASTIC'),
    designMs: use('DESIGN_VELOCITY_PLASTIC'),
  });
  const classes = run(ENG_013, { installationType: input.installationType });

  // 2 · debit puncak. Tempat ibadah: keran wudhu dibuka bersamaan, ditambahkan penuh (ENG-801).
  const wudhuTaps = worship ? Math.max(0, input.wudhuTaps ?? 0) : 0;
  const wudhuTapFlowLs = wudhuTaps > 0 ? use('WUDHU_TAP_FLOW_0_1LS') : 0.1;
  const demand = publicRestroom
    ? run(ENG_801, {
        waterClosets: input.bathrooms,
        bathroomTaps: input.bathrooms,
        lavatories: fixtures.basins,
        kitchenSinks: fixtures.kitchens,
        urinals,
        wudhuTaps,
        wsfuWaterCloset: wsfu.waterCloset,
        wsfuTap: wsfu.lavatory,
        wsfuUrinal: wsfu.urinal,
        wsfuKitchenSink: wsfu.kitchenSink,
        wudhuTapFlowLs,
      })
    : run(ENG_701, {
        waterClosets: input.bathrooms,
        showers: input.bathrooms,
        lavatories: fixtures.basins,
        kitchenSinks: fixtures.kitchens,
        wsfuWaterCloset: wsfu.waterCloset,
        wsfuShower: wsfu.shower,
        wsfuLavatory: wsfu.lavatory,
        wsfuKitchenSink: wsfu.kitchenSink,
      });

  // Beban cabang (Hunter) = beban total; keran wudhu dihitung terpisah sebagai debit serentak.
  assertBalanced(
    'beban suplai (WSFU) per cabang',
    demand.wsfu,
    branches.branches.map((b) => b.wsfu),
  );

  // 3 · jalur dan beda tinggi
  const horizontalRunM =
    routeBasis === 'stated'
      ? input.mainRunMeters!
      : routeBasis === 'plan'
        ? plan!.lengthM + plan!.widthM
        : use('HOUSE_RUN_20M');
  const gravity = input.waterSource === 'rooftop_tank';
  // Halaman: ukuran tanah dan bangunan sama-sama diketahui (2026-10-12, ENG-705).
  const yard =
    plan !== null &&
    typeof input.landLengthM === 'number' &&
    typeof input.landWidthM === 'number' &&
    input.landLengthM > 0 &&
    input.landWidthM > 0
      ? run(ENG_705, {
          landSideM: Math.max(input.landLengthM, input.landWidthM),
          buildingSideM: Math.max(plan.lengthM, plan.widthM),
        }).yardM
      : null;
  // Sumur: muka air yang disebut, atau asumsi 6 m (keputusan pemilik 2026-10-13).
  const wellDepthM =
    input.waterSource !== 'pump'
      ? 0
      : typeof input.wellDepthM === 'number' && input.wellDepthM >= 0
        ? input.wellDepthM
        : use('WELL_WATER_DEPTH_6M');
  const route = run(ENG_702, {
    // Toren atap ada di bangunan: halaman tidak masuk jalur toren → titik air.
    yardM: gravity ? 0 : (yard ?? 0),
    source: input.waterSource,
    floors: input.floors,
    floorHeightM,
    horizontalRunM,
    routeBasis,
    outletHeightM: use('OUTLET_HEIGHT_2M'),
    tankStandM: gravity ? use('TANK_STAND_1M') : 0,
    wellDepthM,
  });

  // 4 · pipa utama. Toren atap: ukuran terkecil yang lolos kriteria kecepatan dan masih menyisakan
  // tekanan minimum di titik tertinggi; tidak ada yang cukup → ukuran terbaik + pompa pendorong.
  const flowLs = Math.max(demand.peakFlowLs, 0.01);
  const pumped = input.waterSource === 'pump' || input.waterSource === 'ground_tank';
  const minimumBar = gravity ? use('RESIDUAL_GRAVITY_0_3BAR') : 0;
  const availableHeadM = -route.staticHeadM;
  // Toren atap: kehilangan yang boleh terjadi = beda tinggi − tekanan minimum. Dijadikan batas
  // gradien untuk sizing, supaya ukuran yang dipilih — dan langkah hitungnya — sudah memenuhi
  // tekanan di titik tertinggi. Tidak ada sisa sama sekali → sizing biasa + pompa pendorong.
  const sizingOverrides = { ...overrides };
  if (gravity) {
    const minorFraction = overrides['MINOR_LOSS_FRACTION'] ?? use('MINOR_LOSS_FRACTION');
    const allowedGradient =
      ((availableHeadM - minimumHeadM(minimumBar)) / (route.routeLengthM * (1 + minorFraction))) *
      100;
    const defaultGradient = overrides['HEADLOSS_GRADIENT_MAX'] ?? use('HEADLOSS_GRADIENT_MAX');
    if (allowedGradient >= 0.1 && allowedGradient < defaultGradient) {
      sizingOverrides['HEADLOSS_GRADIENT_MAX'] = round2(allowedGradient);
    }
  }
  // Fitting di jalur kritis sumber → titik air tertinggi (masukan Leo 2026-10-22): kehilangan
  // sambungan dihitung per fitting (ENG-207), bukan sebagai 10 % kerugian gesek, supaya tiap
  // sukunya bisa dihitung ulang oleh pemeriksa. Topologinya sudah pasti sebelum ukuran dipilih;
  // yang berubah per ukuran hanya kecepatan airnya, dan itu dihitung di dalam ENG-207.
  const criticalElbows =
    use('FITTING_MAIN_ELBOWS_2') +
    use('FITTING_BRANCH_ELBOW_1') +
    use('FITTING_OUTLET_ELBOW_1') +
    use('FITTING_OUTLET_FAUCET_ELBOW_1');
  const routeSockets = pipeJointsPerRun(route.routeLengthM, use('PIPE_STOCK_LENGTH_4M'));
  const criticalFittings = [
    {
      kind: 'Masuk pipa dari sumber',
      kindEn: 'Pipe entry from the source',
      count: 1,
      k: use('MINOR_K_ENTRY'),
    },
    {
      kind: 'Stop kran terbuka',
      kindEn: 'Open stop valve',
      count: 1,
      k: use('MINOR_K_VALVE_GATE'),
    },
    {
      kind: 'Elbow 90° (pipa utama, cabang, turun ke alat, drat kran)',
      kindEn: '90° elbows (main, branch, drop to the fixture, tap thread)',
      count: criticalElbows,
      k: use('MINOR_K_ELBOW_90'),
    },
    {
      kind: 'Tee tempat cabang keluar',
      kindEn: 'Tee where the branch leaves',
      count: branches.branchCount > 0 ? 1 : 0,
      k: use('MINOR_K_TEE_BRANCH'),
    },
    {
      kind: 'Sok antar batang pipa',
      kindEn: 'Sockets between pipe rods',
      count: routeSockets,
      k: use('MINOR_K_SOCKET'),
    },
  ];
  const main = computePressurized(
    {
      designFlowLs: flowLs,
      routeLengthM: route.routeLengthM,
      staticHeadM: route.staticHeadM,
      residualPressureBar: gravity ? 0 : use('RESIDUAL_PRESSURE_FIXTURE'),
      material: 'PVC',
      pumpRequired: pumped,
      minorFittings: criticalFittings,
    },
    locale,
    sizingOverrides,
  );
  let gravityResidualBar: number | null = null;
  let boosterPumpNeeded = false;
  let gravityRemedy: HouseSupply['gravityRemedy'] = null;
  let tankStand: HouseSupply['tankStand'] = null;
  const cleanWater = input.installationType !== 'drainage';
  if (gravity && cleanWater) {
    const lossM = round2(main.frictionLossM + main.minorLossM);
    const check = run(ENG_703, {
      availableHeadM,
      lossM,
      // Dudukan yang lebih tinggi memperpanjang jalur; kehilangan per meter dipakai ENG-703 v3
      // supaya saran tingginya sudah menanggung kehilangan di pipa tambahan itu.
      lossPerRouteM: round3(lossM / Math.max(route.routeLengthM, 0.1)),
      minimumBar,
      tankStandM: use('TANK_STAND_1M'),
    });
    gravityResidualBar = check.residualBar;
    boosterPumpNeeded = check.boosterNeeded;
    if (check.minimumStandM !== null) {
      gravityRemedy = { minimumStandM: check.minimumStandM, heightShort: check.heightShort };
    }
    // Dak atau tiang toren: tekanan dari tiap dudukan dengan pipa yang sama (ENG-711). Hanya
    // instalasi yang memuat air bersih; pekerjaan pembuangan saja tidak punya dudukan toren,
    // dan di produksi 2026-10-26 jawabannya menyebut "tidak ada dudukan toren yang mencapai
    // 0,3 bar tanpa pompa pendorong" untuk rumah yang hanya memasang saluran buangan.
    const comfortBar = use('RESIDUAL_GRAVITY_COMFORT_0_7BAR');
    const options = run(ENG_711, {
      roofHeightM: round2(input.floors * floorHeightM),
      highestOutletM: round2((input.floors - 1) * floorHeightM + use('OUTLET_HEIGHT_2M')),
      standM: use('TANK_STAND_1M'),
      lossM: round2(main.frictionLossM + main.minorLossM),
      minimumBar,
      comfortBar,
      towerHeightsM: [...TANK_TOWER_HEIGHTS_M],
    });
    tankStand = { ...options, comfortBar };
  }
  let well: HouseSupply['well'] = null;
  if (input.waterSource === 'pump') {
    const suctionLimitM = use('SURFACE_PUMP_SUCTION_7M');
    const check = run(ENG_709, { wellDepthM, suctionLimitM });
    well = { depthM: wellDepthM, suctionLimitM, beyondSuction: check.beyondSuction };
  }
  const requiredSourcePressureBar =
    input.waterSource === 'municipal' ? round2(main.totalDynamicHeadM / 10.197) : null;

  // 5 · cabang: debit tiap cabang dari bebannya sendiri pada kecepatan rencana; cabang berbeban
  // sama dihitung sekali. Cabang dikelompokkan per ukuran untuk tabel sistem dan material.
  const designVelocity = use('DESIGN_VELOCITY_PLASTIC');
  const sizeForWsfu = new Map<number, string>();
  for (const b of branches.branches) {
    if (sizeForWsfu.has(b.wsfu)) continue;
    const sized = run(ENG_102, {
      designFlowLs: Math.max(hunterGpm(b.wsfu) * 0.0630902, 0.01),
      velocityMs: designVelocity,
      sizeTable: 'pvc_inch',
    });
    sizeForWsfu.set(b.wsfu, sized.mainSize);
  }
  const groups = new Map<string, { size: string; count: number; branches: FilledBranch[] }>();
  for (const b of branches.branches) {
    const size = sizeForWsfu.get(b.wsfu)!;
    const group = groups.get(size) ?? { size, count: 0, branches: [] };
    group.count += 1;
    group.branches.push(b);
    groups.set(size, group);
  }
  // Terbesar dulu: baris pertama adalah ukuran yang paling menentukan.
  const rank = (size: string) => PVC_INCH_SIZES.findIndex((n) => n.size === size);
  const branchGroups = [...groups.values()].sort((a, b) => rank(b.size) - rank(a.size));
  const branchSize = branchGroups[0]?.size ?? connection.fixtureConnectionSize;

  // 5b · pipa pengisi toren atap, hanya dengan ukuran bangunan (P16-63).
  const tankFill =
    gravity && plan !== null && route.tankLevelM !== null
      ? run(ENG_706, {
          yardM: yard ?? 0,
          buildingSideM: Math.max(plan.lengthM, plan.widthM),
          tankLevelM: route.tankLevelM,
          sizeInches: use('TANK_FILL_PIPE_3_4IN'),
        })
      : null;

  // 5c · tekanan di meteran supaya air sampai ke toren lewat pipa pengisi (ENG-710).
  const fillPressure =
    tankFill !== null && route.tankLevelM !== null
      ? run(ENG_710, {
          tankLevelM: route.tankLevelM,
          fillNetM: tankFill.fillNetM,
          flowLs: use('TANK_FILL_FLOW_0_25LS'),
          innerDiameterMm: sizeTable('pvc_inch').find((n) => n.size === tankFill.size)!.innerMm,
          hazenWilliamsC: use('HAZEN_WILLIAMS_C_PLASTIC'),
          minorLossFraction: use('MINOR_LOSS_FRACTION'),
        })
      : null;

  // 6 · panjang cabang dan sambungan, hanya dari ukuran rumah (P16-60).
  const layoutRun =
    plan !== null
      ? run(ENG_704, {
          planLengthM: Math.max(plan.lengthM, plan.widthM),
          branchCount: branches.branchCount,
          outletCount: load.outletCount,
          fixtureDropM: use('HOUSE_FIXTURE_DROP_1_5M'),
        })
      : null;
  const branchLayout =
    layoutRun !== null && plan !== null
      ? {
          ...layoutRun,
          bySize: branchGroups.map((g) => ({
            size: g.size,
            count: g.count,
            netM: round1(g.count * Math.max(plan.lengthM, plan.widthM)),
          })),
        }
      : null;

  // 6b · fitting air bersih (ENG-708, P18-01) — dari jumlah jalur, tanpa butuh ukuran rumah.
  // Cabang terjauh dari sumber di sepanjang pipa utama: toren atap mengalir dari atas (ujungnya
  // lantai 1), sumber di bawah naik (ujungnya lantai teratas). Di sana elbow, bukan tee.
  const allBranches = branches.branches;
  const ordered = [...allBranches].sort((a, b) =>
    gravity ? b.floor - a.floor : a.floor - b.floor,
  );
  const endBranch = ordered.at(-1);
  const endBranchSize =
    endBranch !== undefined
      ? branchGroups.find((g) => g.branches.includes(endBranch))?.size
      : undefined;
  const fittings = run(ENG_708, {
    mainSize: main.recommendedSize,
    ...(endBranchSize !== undefined ? { endBranchSize } : {}),
    branchesBySize: branchGroups.map((g) => ({ size: g.size, count: g.count })),
    outletCount: load.outletCount,
    hasTankFill: tankFill !== null,
    mainElbows: use('FITTING_MAIN_ELBOWS_2'),
    tankFillElbows: use('FITTING_TANK_FILL_ELBOWS_2'),
    elbowsPerBranch: use('FITTING_BRANCH_ELBOW_1'),
    elbowsPerOutlet: use('FITTING_OUTLET_ELBOW_1'),
    faucetElbowsPerOutlet: use('FITTING_OUTLET_FAUCET_ELBOW_1'),
  });

  // 7 · deret wudhu: keran berjejer per tempat wudhu, satu pipa pembagi per deret (ENG-802).
  let wudhu: SolutionResult['wudhu'] = null;
  if (wudhuTaps > 0) {
    const areas = Math.min(wudhuTaps, input.wudhuAreas ?? use('WUDHU_ONE_AREA'));
    const rows = run(ENG_802, {
      wudhuTaps,
      areas,
      wudhuTapFlowLs,
      tapSpacingM: use('WUDHU_TAP_SPACING_0_8M'),
    }).rows;
    const sizeForFlow = new Map<number, string>();
    for (const row of rows) {
      if (sizeForFlow.has(row.flowLs)) continue;
      const sized = run(ENG_102, {
        designFlowLs: row.flowLs,
        velocityMs: designVelocity,
        sizeTable: 'pvc_inch',
      });
      sizeForFlow.set(row.flowLs, sized.mainSize);
    }
    wudhu = {
      taps: wudhuTaps,
      flowLs: round2(wudhuTaps * wudhuTapFlowLs),
      rows: rows.map((r) => ({ ...r, size: sizeForFlow.get(r.flowLs)! })),
    };
  }

  // Catatan isi kamar mandi rumah (ENG-012) di akhir; tempat ibadah memakai asumsinya sendiri.
  const beforeNote = traces.length;
  if (!publicRestroom) run(ENG_012, {});

  // Langkah pipa utama (Kelompok F) disisipkan sebelum catatan itu.
  const allTraces = [...traces.slice(0, beforeNote), ...main.traces, ...traces.slice(beforeNote)];
  return {
    outletCount: load.outletCount,
    mainSize: main.recommendedSize,
    branchSize,
    branchGroups,
    fixtureConnectionSize: connection.fixtureConnectionSize,
    branchCount: branches.branchCount,
    maxOutletsPerBranch: branches.maxOutletsPerBranch,
    floorHeightM,
    floorsPlan: floorPlan.floorsPlan,
    boosterPumpNeeded,
    sourcePumped: pumped,
    pressureClasses: classes.classes,
    supply: {
      wsfu: demand.wsfu,
      peakFlowLs: demand.peakFlowLs,
      routeLengthM: route.routeLengthM,
      routeBasis,
      staticHeadM: route.staticHeadM,
      main,
      gravityResidualBar,
      gravityRemedy,
      tankStand,
      well,
      requiredSourcePressureBar,
    },
    mainRunNetM: hasRealDimensions ? route.routeLengthM : null,
    yardM: yard,
    tankFill:
      tankFill && fillPressure
        ? { netM: tankFill.fillNetM, size: tankFill.size, meterBar: fillPressure.requiredBar }
        : null,
    branchLayout,
    fittings,
    // Hanya dibaca bila panjang pipa memang dihitung — selain itu bukan asumsi yang dipakai.
    cuttingAllowancePct: plan !== null ? use('PIPE_CUTTING_ALLOWANCE_10PCT') : 0,
    mainEndBranchSize: endBranchSize ?? null,
    wudhu,
    targetVelocityMs: { min: velocity.minMs, max: velocity.maxMs },
    appliedAssumptionIds: [...new Set([...applied, ...main.appliedAssumptionIds])],
    traces: allTraces,
    overallProvenance: weakest(allTraces.map((t) => t.provenance)),
  };
}

/** Urutan dari paling kuat ke paling lemah. */
const STRENGTH: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];

function weakest(values: readonly Provenance[]): Provenance {
  let worst: Provenance = 'VERIFIED';
  for (const value of values) {
    if (STRENGTH.indexOf(value) > STRENGTH.indexOf(worst)) worst = value;
  }
  return worst;
}
