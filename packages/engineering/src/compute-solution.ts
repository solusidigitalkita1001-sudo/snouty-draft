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
import { ENG_012 } from './rules/group-c-material.js';
import { ENG_102 } from './rules/group-e-irrigation.js';
import {
  ENG_701,
  ENG_702,
  ENG_703,
  ENG_704,
  ENG_705,
  ENG_706,
  ENG_707,
  hunterGpm,
  type FilledBranch,
  minimumHeadM,
  type RouteBasis,
} from './rules/group-k-house-supply.js';
import type { RuleVersion } from './rule.js';
import { round1, round2 } from './units.js';
import { PVC_INCH_SIZES } from './parameters/size-tables.js';

export interface SolutionInput {
  readonly buildingType: 'residential' | 'boarding_house' | 'light_commercial' | 'industrial';
  readonly floors: number;
  readonly bathrooms: number;
  readonly basins: number;
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
  /** Ukuran tanah — hanya untuk jarak halaman (ENG-705); bukan dasar panjang pipa di bangunan. */
  readonly landLengthM?: number | null;
  readonly landWidthM?: number | null;
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
  readonly boosterPumpNeeded: boolean;
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
  readonly tankFill: { readonly netM: number; readonly size: string } | null;
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

  const fixtures = {
    bathrooms: input.bathrooms,
    basins: input.basins,
    kitchens: input.kitchens ?? use('HOUSE_KITCHEN_1'),
  };
  const load = run(ENG_001, fixtures);
  const floorHeightM = input.floorHeightM ?? run(ENG_004, {}).floorHeightM;
  const floorPlan = run(ENG_008, { ...fixtures, floors: input.floors, floorHeightM });
  // Beban per alat (IPC E103.3(2)) — sekali dibaca, dipakai debit total dan isi tiap cabang.
  const wsfu = {
    waterCloset: use('WSFU_WATER_CLOSET_2_2'),
    shower: use('WSFU_SHOWER_1'),
    lavatory: use('WSFU_LAVATORY_0_5'),
    kitchenSink: use('WSFU_KITCHEN_SINK_1'),
  };
  // Isi tiap cabang per lantai (ENG-707, temuan laporan 0009): ukuran cabang dari isinya sendiri.
  const branches = run(ENG_707, {
    floors: floorPlan.floorsPlan.map((f) => ({
      floor: f.floor,
      bathrooms: f.bathrooms,
      basins: f.basins,
      kitchens: f.kitchens,
    })),
    maxOutletsPerBranch: 4,
    wsfuWaterCloset: wsfu.waterCloset,
    wsfuShower: wsfu.shower,
    wsfuLavatory: wsfu.lavatory,
    wsfuKitchenSink: wsfu.kitchenSink,
  });
  const connection = run(ENG_005, {});
  const velocity = run(ENG_010, {
    minMs: use('VELOCITY_MIN_SELF_CLEANING'),
    maxMs: use('VELOCITY_MAX_PLASTIC'),
    designMs: use('DESIGN_VELOCITY_PLASTIC'),
  });
  const classes = run(ENG_013, { installationType: input.installationType });

  // 2 · debit puncak
  const demand = run(ENG_701, {
    waterClosets: input.bathrooms,
    showers: input.bathrooms,
    lavatories: input.basins,
    kitchenSinks: fixtures.kitchens,
    wsfuWaterCloset: wsfu.waterCloset,
    wsfuShower: wsfu.shower,
    wsfuLavatory: wsfu.lavatory,
    wsfuKitchenSink: wsfu.kitchenSink,
  });

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
  const main = computePressurized(
    {
      designFlowLs: flowLs,
      routeLengthM: route.routeLengthM,
      staticHeadM: route.staticHeadM,
      residualPressureBar: gravity ? 0 : use('RESIDUAL_PRESSURE_FIXTURE'),
      material: 'PVC',
      pumpRequired: pumped,
    },
    locale,
    sizingOverrides,
  );
  let gravityResidualBar: number | null = null;
  let boosterPumpNeeded = pumped;
  if (gravity) {
    const check = run(ENG_703, {
      availableHeadM,
      lossM: round2(main.frictionLossM + main.minorLossM),
      minimumBar,
    });
    gravityResidualBar = check.residualBar;
    boosterPumpNeeded = check.boosterNeeded;
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

  run(ENG_012, {}); // dicatat sebagai asumsi yang mendasari isi kamar mandi

  // ENG-012 dicatat terakhir; langkah pipa utama (Kelompok F) disisipkan sebelum catatan itu.
  const allTraces = [...traces.slice(0, -1), ...main.traces, ...traces.slice(-1)];
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
    pressureClasses: classes.classes,
    supply: {
      wsfu: demand.wsfu,
      peakFlowLs: demand.peakFlowLs,
      routeLengthM: route.routeLengthM,
      routeBasis,
      staticHeadM: route.staticHeadM,
      main,
      gravityResidualBar,
      requiredSourcePressureBar,
    },
    mainRunNetM: hasRealDimensions ? route.routeLengthM : null,
    yardM: yard,
    tankFill: tankFill ? { netM: tankFill.fillNetM, size: tankFill.size } : null,
    branchLayout,
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
