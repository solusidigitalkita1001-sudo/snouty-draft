/**
 * Orkestrator pembuangan rumah (Kelompok J). Murni, tanpa I/O.
 *
 * 1 kamar mandi = 1 kloset + 1 shower/floor drain (sama dengan sisi air bersih, ENG-012);
 * wastafel dan bak cuci dapur dari jumlah yang disebut. Dua jalur: air kotor ke septic tank,
 * air bekas ke saluran/resapan. Panjang jalur tidak diketahui → tidak ada jumlah batang; yang
 * dihitung adalah beban, ukuran tiap jalur, ventilasi, dan ukuran sambungan tiap alat.
 */

import { assumptionReader, type AssumptionOverrides } from './parameters/assumptions.js';
import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import type { CalculationTrace } from './compute-solution.js';
import { RuleInputError, type RuleVersion } from './rule.js';
import {
  DRAIN_SIZES,
  ENG_601,
  ENG_602,
  type DrainageLoadResult,
  type DrainLineResult,
  type DrainSize,
} from './rules/group-j-waste.js';

export interface HouseDrainageInput {
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
}

export interface FixtureDrain {
  readonly fixture: 'water_closet' | 'shower' | 'lavatory' | 'kitchen_sink';
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
  readonly appliedAssumptionIds: readonly string[];
  readonly traces: readonly CalculationTrace[];
  readonly overallProvenance: Provenance;
}

/** Ukuran sambungan minimum per alat — IPC Tabel 709.1 (ukuran trap). */
const FIXTURE_MIN: Readonly<Record<Exclude<FixtureDrain['fixture'], 'water_closet'>, DrainSize>> = {
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
  const load = run(ENG_601, {
    ...counts,
    dfuWaterCloset: use('DFU_WATER_CLOSET_4'),
    dfuShower: use('DFU_SHOWER_2'),
    dfuLavatory: use('DFU_LAVATORY_1'),
    dfuKitchenSink: use('DFU_KITCHEN_SINK_2'),
  });

  const soil =
    counts.waterClosets > 0
      ? run(ENG_602, {
          dfu: load.soilDfu,
          minimumSize: sizeFromInches('SOIL_LINE_MIN_4IN', use('SOIL_LINE_MIN_4IN')),
        })
      : null;

  const wasteFixtures = (['shower', 'kitchen_sink', 'lavatory'] as const).filter(
    (f) =>
      ({ shower: counts.showers, kitchen_sink: counts.kitchenSinks, lavatory: counts.lavatories })[
        f
      ] > 0,
  );
  const waste =
    wasteFixtures.length > 0
      ? run(ENG_602, { dfu: load.wasteDfu, minimumSize: FIXTURE_MIN[wasteFixtures[0]!] })
      : null;

  const fixtures: FixtureDrain[] = [
    ...(soil
      ? [{ fixture: 'water_closet' as const, count: counts.waterClosets, size: soil.size }]
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

  return {
    load,
    soil,
    waste,
    fixtures,
    appliedAssumptionIds: [...new Set(applied)],
    traces,
    overallProvenance: traces.every((t) => t.provenance === 'VERIFIED') ? 'VERIFIED' : 'ASSUMED',
  };
}
