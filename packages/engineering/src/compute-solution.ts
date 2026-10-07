/**
 * Orkestrator engine: satu panggilan, satu trace per aturan.
 * docs/ENGINEERING_RULES.md §2 · SPEC §8.
 *
 * **Murni.** Tanpa I/O, tanpa jam, tanpa acak — masukan sama selalu menghasilkan
 * keluaran sama, sehingga laporan bisa dibuat ulang identik bertahun kemudian. Target
 * < 300 ms p95 dicapai bukan dengan optimasi tetapi karena tidak ada yang lambat di
 * sini: belasan operasi aritmetika tanpa satu pun panggilan jaringan.
 *
 * Setiap aturan yang dieksekusi menulis `CalculationTrace`. Itulah yang membuat
 * auditabilitas SPEC §8 terlihat oleh pengguna dan bukan sekadar tersimpan di log.
 */

import { DEFAULT_ENGINEERING_LOCALE, type EngineeringLocale } from './parameters/locale.js';
import { gateEngineProvenance, type Provenance } from './provenance.js';
import {
  ENG_001,
  ENG_002,
  ENG_003,
  ENG_005,
  ENG_010,
  ENG_013,
  type PressureClass,
} from './rules/group-a-load-sizing.js';
import { ENG_004, ENG_008, ENG_011, type FloorNode } from './rules/group-b-geometry.js';
import { ENG_006, ENG_009, ENG_012, type BomLine } from './rules/group-c-material.js';
import type { RuleVersion } from './rule.js';

export interface SolutionInput {
  readonly buildingType: 'residential' | 'boarding_house' | 'light_commercial' | 'industrial';
  readonly floors: number;
  readonly bathrooms: number;
  readonly basins: number;
  readonly kitchens: number;
  readonly waterSource: 'rooftop_tank' | 'ground_tank' | 'pump' | 'municipal';
  readonly installationType: 'clean_water' | 'drainage' | 'both';
  /** Tinggi antar lantai bila pengguna memberikannya; `null` → ENG-004. */
  readonly floorHeightM: number | null;
  /** Panjang jalur utama bila diketahui; `null` → BOM estimasi, bukan terverifikasi. */
  readonly mainRunMeters: number | null;
}

export interface CalculationTrace {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly inputs: unknown;
  readonly output: unknown;
  readonly provenance: Provenance;
  readonly explanation: string;
}

export interface SolutionResult {
  readonly outletCount: number;
  readonly loadUnits: number;
  readonly mainSize: '1"' | '3/4"';
  readonly fixtureConnectionSize: '1/2"';
  readonly branchCount: number;
  readonly maxOutletsPerBranch: number;
  readonly floorHeightM: number;
  readonly floorsPlan: readonly FloorNode[];
  readonly boosterPumpNeeded: boolean;
  readonly pressureClasses: readonly PressureClass[];
  readonly bom: readonly BomLine[];
  readonly variancePercent: { readonly min: number; readonly max: number };
  readonly targetVelocityMs: { readonly min: number; readonly max: number };
  /** Satu trace per aturan yang dieksekusi, urut eksekusi. */
  readonly traces: readonly CalculationTrace[];
  /**
   * Provenance paling lemah di antara seluruh trace — yang boleh dipakai UI untuk
   * menandai keseluruhan solusi. Satu angka asumsi membuat solusinya asumsi.
   */
  readonly overallProvenance: Provenance;
}

/** `locale` hanya memilih bahasa `explanation` di trace (P15-04b); angka tidak berubah. */
export function computeSolution(
  input: SolutionInput,
  locale: EngineeringLocale = DEFAULT_ENGINEERING_LOCALE,
): SolutionResult {
  const traces: CalculationTrace[] = [];
  const hasRealDimensions = input.mainRunMeters !== null;

  /** Menjalankan satu aturan, mencatat trace-nya, mengembalikan keluarannya. */
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
    kitchens: input.kitchens,
  };

  const load = run(ENG_001, fixtures);
  const main = run(ENG_002, { loadUnits: load.loadUnits });
  const branches = run(ENG_003, { outletCount: load.outletCount });
  const connection = run(ENG_005, {});
  const velocity = run(ENG_010, {});
  const classes = run(ENG_013, { installationType: input.installationType });

  // ENG-004 hanya berjalan bila pengguna tidak memberi tinggi lantai — menjalankannya
  // saat nilainya ada akan mencatat asumsi yang tidak pernah dipakai.
  const floorHeightM = input.floorHeightM ?? run(ENG_004, {}).floorHeightM;

  const plan = run(ENG_008, { ...fixtures, floors: input.floors, floorHeightM });
  const booster = run(ENG_011, {
    buildingType: input.buildingType,
    waterSource: input.waterSource,
  });
  const bom = run(ENG_009, {
    floors: input.floors,
    bathrooms: input.bathrooms,
    mainSize: main.mainSize,
  });
  const variance = run(ENG_006, {});
  run(ENG_012, {}); // dicatat sebagai asumsi yang mendasari bobot ENG-001

  return {
    outletCount: load.outletCount,
    loadUnits: load.loadUnits,
    mainSize: main.mainSize,
    fixtureConnectionSize: connection.fixtureConnectionSize,
    branchCount: branches.branchCount,
    maxOutletsPerBranch: branches.maxOutletsPerBranch,
    floorHeightM,
    floorsPlan: plan.floorsPlan,
    boosterPumpNeeded: booster.boosterPumpNeeded,
    pressureClasses: classes.classes,
    bom: bom.lines,
    variancePercent: { min: variance.minPercent, max: variance.maxPercent },
    targetVelocityMs: { min: velocity.minMs, max: velocity.maxMs },
    traces,
    overallProvenance: weakest(traces.map((t) => t.provenance)),
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
