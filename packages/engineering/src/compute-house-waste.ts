/**
 * Orkestrator pembuangan rumah (Kelompok J). Murni, tanpa I/O.
 *
 * 1 kamar mandi = 1 kloset + 1 shower/floor drain (sama dengan sisi air bersih, ENG-012);
 * wastafel dan bak cuci dapur dari jumlah yang disebut. Dua jalur: air kotor ke septic tank,
 * air bekas ke saluran/resapan. Yang dihitung: beban, ukuran tiap jalur, ventilasi, ukuran sambungan
 * tiap alat, dan — bila ukuran rumah diketahui — perkiraan panjang tiap jalur (ENG-603).
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import { RuleInputError, type RuleVersion } from './rule.js';
import { assertBalanced } from './consistency.js';
import {
  DRAIN_SIZES,
  ENG_601,
  ENG_602,
  ENG_603,
  ENG_604,
  ENG_605,
  type DrainFittingResult,
  type DrainageLoadResult,
  type DrainLengthResult,
  type DrainLineResult,
  type DrainSize,
} from './rules/group-j-waste.js';
import { ENG_803, type WudhuDrainRow } from './rules/group-l-worship.js';

export interface HouseDrainageInput {
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
  /** Urinoir toilet umum — dibuang bersama kloset ke jalur air kotor. */
  readonly urinals?: number;
  /**
   * Alat per lantai (sebaran yang sama dengan air bersih, ENG-008). Ada → cabang mendatar per
   * lantai dan pipa tegak ikut dicek (ENG-604); tidak ada → dianggap satu lantai.
   */
  readonly floors?: readonly {
    readonly bathrooms: number;
    readonly basins: number;
    readonly kitchens: number;
  }[];
  /**
   * Tempat ibadah: debit tiap deret wudhu (ENG-802). Ada → satu talang per deret (ENG-803) yang
   * masuk ke jalur air bekas.
   */
  readonly wudhuRowFlowsLs?: readonly number[];
  /** Ukuran rumah dan lantai — bila ada, panjang tiap jalur diperkirakan (ENG-603, P16-60). */
  readonly layout?: {
    readonly planLengthM: number;
    readonly floors: number;
    readonly floorHeightM: number;
    /** Halaman ke depan tanah (ENG-705); 0 tanpa ukuran tanah. */
    readonly yardM?: number;
  } | null;
}

export interface FixtureDrain {
  readonly fixture: 'water_closet' | 'urinal' | 'shower' | 'lavatory' | 'kitchen_sink';
  readonly count: number;
  readonly size: DrainSize;
}

export interface HouseDrainageResult {
  readonly load: DrainageLoadResult;
  /** Jalur air kotor (kloset → septic tank); `null` bila tidak ada kloset. */
  readonly soil: DrainLineResult | null;
  /** Jalur air bekas; `null` bila tidak ada alat air bekas. */
  readonly waste: DrainLineResult | null;
  readonly fixtures: readonly FixtureDrain[];
  /** Talang wudhu per deret (ENG-803); kosong bukan tempat ibadah. */
  readonly wudhuTroughs: readonly WudhuDrainRow[];
  /** Perkiraan panjang tiap jalur (ENG-603); `null` tanpa ukuran rumah. */
  readonly lengths: DrainLengthResult | null;
  /** Fitting pembuangan (ENG-605): Y, elbow 45°, clean out per jalur. */
  readonly fittings: DrainFittingResult;
  readonly appliedAssumptionIds: readonly string[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

/** Ukuran sambungan minimum per alat — IPC Tabel 709.1 (ukuran trap). */
const FIXTURE_MIN: Readonly<Record<Exclude<FixtureDrain['fixture'], 'water_closet'>, DrainSize>> = {
  urinal: '2"',
  shower: '2"',
  lavatory: '1¼"',
  kitchen_sink: '1½"',
};

function sizeFromInches(id: string, value: number): DrainSize {
  const found = DRAIN_SIZES.find(
    (s) =>
      Math.abs(
        { '1¼"': 1.25, '1½"': 1.5, '2"': 2, '2½"': 2.5, '3"': 3, '4"': 4, '5"': 5, '6"': 6 }[s] -
          value,
      ) < 1e-9,
  );
  if (!found) throw new RuleInputError(id, `ukuran ${value} inci tidak ada di seri pipa buangan`);
  return found;
}

export function computeHouseDrainage(
  input: HouseDrainageInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
  overrides: AssumptionOverrides = {},
): HouseDrainageResult {
  const traces: CalculationTrace[] = [];
  const { use, applied } = assumptionReader(overrides);
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
        hasRealDimensions: false,
      }),
      explanation: rule.explain(parsed, output, locale),
    });
    return output;
  }

  const counts = {
    waterClosets: input.bathrooms,
    showers: input.bathrooms,
    lavatories: input.basins,
    kitchenSinks: input.kitchens,
  };
  const dfu = {
    waterCloset: use('DFU_WATER_CLOSET_4'),
    shower: use('DFU_SHOWER_2'),
    lavatory: use('DFU_LAVATORY_1'),
    kitchenSink: use('DFU_KITCHEN_SINK_2'),
  };
  // Talang wudhu dulu: bebannya masuk jalur air bekas.
  const wudhuRows =
    input.wudhuRowFlowsLs && input.wudhuRowFlowsLs.length > 0
      ? run(ENG_803, {
          rowFlowsLs: input.wudhuRowFlowsLs,
          dfuPerGpm: use('DFU_CONTINUOUS_2_PER_GPM'),
        })
      : null;
  const urinals = Math.max(0, input.urinals ?? 0);
  const dfuUrinal = urinals > 0 ? use('DFU_URINAL_4') : 0;
  const load = run(ENG_601, {
    ...counts,
    wudhuDfu: wudhuRows?.totalDfu ?? 0,
    urinals,
    dfuUrinal,
    dfuWaterCloset: dfu.waterCloset,
    dfuShower: dfu.shower,
    dfuLavatory: dfu.lavatory,
    dfuKitchenSink: dfu.kitchenSink,
  });

  // Beban per lantai tiap jalur — untuk cabang mendatar dan pipa tegak (ENG-604, laporan 0009).
  const floors = input.floors && input.floors.length > 0 ? input.floors : [input];
  // Urinoir di lantai dasar (lantai terakhir dalam sebaran, urut dari atas).
  const soilFloors = floors
    .map(
      (f, k) => f.bathrooms * dfu.waterCloset + (k === floors.length - 1 ? urinals * dfuUrinal : 0),
    )
    .filter((d) => d > 0);
  const wasteFloors = floors
    .map((f) => f.bathrooms * dfu.shower + f.basins * dfu.lavatory + f.kitchens * dfu.kitchenSink)
    .filter((d) => d > 0);
  // Beban per lantai wajib sama dengan beban total (laporan 0015); talang wudhu di luar lantai.
  assertBalanced('beban air kotor (DFU) per lantai', load.soilDfu, soilFloors);
  assertBalanced(
    'beban air bekas (DFU) per lantai',
    load.wasteDfu - (wudhuRows?.totalDfu ?? 0),
    wasteFloors,
  );
  // Hanya bangunan bertingkat: satu lantai mengalir langsung ke saluran bangunan (710.1(1)).
  const multiStorey = floors.length > 1;
  const branchStack = (perFloor: readonly number[]) =>
    multiStorey && perFloor.length > 0 ? run(ENG_604, { floorDfu: perFloor }).size : null;

  const soil =
    counts.waterClosets > 0 || urinals > 0
      ? run(ENG_602, {
          dfu: load.soilDfu,
          minimumSize: sizeFromInches('SOIL_LINE_MIN_4IN', use('SOIL_LINE_MIN_4IN')),
          branchStackSize: branchStack(soilFloors),
        })
      : null;

  const wasteFixtures = (['shower', 'kitchen_sink', 'lavatory'] as const).filter(
    (f) =>
      ({ shower: counts.showers, kitchen_sink: counts.kitchenSinks, lavatory: counts.lavatories })[
        f
      ] > 0,
  );
  // Ukuran minimum jalur air bekas: alat terbesarnya, termasuk talang wudhu terbesar.
  const troughMin =
    wudhuRows?.rows.reduce<DrainSize | null>(
      (big, r) =>
        big === null || DRAIN_SIZES.indexOf(r.size) > DRAIN_SIZES.indexOf(big) ? r.size : big,
      null,
    ) ?? null;
  const fixtureMin = wasteFixtures.length > 0 ? FIXTURE_MIN[wasteFixtures[0]!] : null;
  const wasteMin =
    fixtureMin !== null && troughMin !== null
      ? DRAIN_SIZES.indexOf(troughMin) > DRAIN_SIZES.indexOf(fixtureMin)
        ? troughMin
        : fixtureMin
      : (fixtureMin ?? troughMin);
  const waste =
    wasteMin !== null
      ? run(ENG_602, {
          dfu: load.wasteDfu,
          minimumSize: wasteMin,
          branchStackSize: branchStack(wasteFloors),
        })
      : null;

  const fixtures: FixtureDrain[] = [
    ...(soil && counts.waterClosets > 0
      ? [{ fixture: 'water_closet' as const, count: counts.waterClosets, size: soil.size }]
      : []),
    ...(urinals > 0
      ? [{ fixture: 'urinal' as const, count: urinals, size: FIXTURE_MIN.urinal }]
      : []),
    ...(counts.showers > 0
      ? [{ fixture: 'shower' as const, count: counts.showers, size: FIXTURE_MIN.shower }]
      : []),
    ...(counts.lavatories > 0
      ? [{ fixture: 'lavatory' as const, count: counts.lavatories, size: FIXTURE_MIN.lavatory }]
      : []),
    ...(counts.kitchenSinks > 0
      ? [
          {
            fixture: 'kitchen_sink' as const,
            count: counts.kitchenSinks,
            size: FIXTURE_MIN.kitchen_sink,
          },
        ]
      : []),
  ];

  const lengths = input.layout
    ? run(ENG_603, {
        ...input.layout,
        yardM: input.layout.yardM ?? 0,
        ventAboveRoofM: use('HOUSE_VENT_ABOVE_ROOF_1M'),
        hasSoil: soil !== null,
        hasWaste: waste !== null,
      })
    : null;

  // Fitting pembuangan (ENG-605, P18-01) — dari jumlah alat dan lantai, tanpa butuh ukuran rumah.
  const fittings = run(ENG_605, {
    soilFixtures: counts.waterClosets + urinals,
    wasteFixtures:
      counts.showers + counts.lavatories + counts.kitchenSinks + (wudhuRows?.rows.length ?? 0),
    hasSoil: soil !== null,
    hasWaste: waste !== null,
    floors: Math.max(floors.length, input.layout?.floors ?? 1),
    yPerFixture: use('FITTING_DRAIN_Y_PER_FIXTURE_1'),
    yPerUpperFloor: use('FITTING_STACK_Y_PER_UPPER_FLOOR_1'),
    stackBaseElbows45: use('FITTING_STACK_BASE_ELBOW45_2'),
    cleanoutsPerLine: use('FITTING_CLEANOUT_PER_LINE_1'),
  });

  return {
    load,
    soil,
    waste,
    fixtures,
    fittings,
    wudhuTroughs: wudhuRows?.rows ?? [],
    lengths,
    appliedAssumptionIds: [...new Set(applied)],
    traces,
    overallProvenance: traces.every((t) => t.provenance === 'VERIFIED') ? 'VERIFIED' : 'ASSUMED',
  };
}
