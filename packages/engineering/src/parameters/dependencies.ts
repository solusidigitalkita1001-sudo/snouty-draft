/**
 * Grafik ketergantungan keluaran ← masukan (brief §7, fase 1).
 *
 * Keluaran teknik tidak dihitung bila masukan kritisnya belum ada — kecuali lewat asumsi yang
 * eksplisit. Grafik ini yang menjawab "untuk menghitung X, apa yang masih kurang?" secara
 * transitif, dan menjadi dasar kesiapan per keluaran (`readiness.ts`) serta pemilih
 * pertanyaan (fase 2). Keluaran dinyatakan sebagai kunci kalkulasi, masukan sebagai parameter.
 */

import type { ParameterKey } from './registry.js';

export type CalculatedKey =
  | 'design_flow_calc'
  | 'static_head_calc'
  | 'pipe_area'
  | 'velocity'
  | 'friction_loss'
  | 'minor_loss'
  | 'total_dynamic_head'
  | 'pipe_diameter'
  | 'pump_duty'
  | 'gravity_capacity'
  | 'stormwater_discharge'
  | 'culvert_size'
  | 'network_peak_demand'
  | 'material_quantity';

export interface Dependency {
  readonly output: CalculatedKey;
  /** Masukan yang WAJIB — tanpa ini keluaran tidak dihitung (kecuali asumsi eksplisit). */
  readonly requires: readonly (ParameterKey | CalculatedKey)[];
  /** Masukan yang memperbaiki hasil bila ada, tetapi tidak menghalangi. */
  readonly improves?: readonly (ParameterKey | CalculatedKey)[];
}

export const DEPENDENCIES: readonly Dependency[] = [
  {
    output: 'design_flow_calc',
    requires: [],
    improves: [
      'number_of_outlets',
      'bathrooms',
      'basins',
      'kitchens',
      'total_area',
      'irrigation_method',
      'number_of_connections',
      'simultaneous_usage',
    ],
  },
  {
    output: 'static_head_calc',
    requires: ['source_elevation'],
    improves: ['destination_elevation', 'tank_elevation', 'building_floors'],
  },
  { output: 'pipe_area', requires: ['nominal_diameter'] },
  { output: 'velocity', requires: ['design_flow', 'nominal_diameter'] },
  {
    output: 'friction_loss',
    requires: ['design_flow', 'nominal_diameter', 'route_length', 'material'],
  },
  { output: 'minor_loss', requires: ['velocity'], improves: ['number_of_branches'] },
  {
    output: 'total_dynamic_head',
    requires: ['static_head', 'friction_loss', 'minor_loss'],
    improves: ['required_pressure'],
  },
  {
    output: 'pipe_diameter',
    requires: ['design_flow', 'route_length', 'material'],
    improves: ['static_head', 'allowable_head_loss', 'design_velocity', 'required_pressure'],
  },
  { output: 'pump_duty', requires: ['design_flow', 'total_dynamic_head'] },
  {
    output: 'gravity_capacity',
    requires: ['slope', 'nominal_diameter'],
    improves: ['pipe_fill_ratio', 'material'],
  },
  {
    output: 'stormwater_discharge',
    requires: ['catchment_area', 'rainfall_intensity', 'runoff_coefficient'],
    improves: ['return_period'],
  },
  {
    output: 'culvert_size',
    requires: ['design_flow', 'slope', 'road_width'],
    improves: ['upstream_level', 'downstream_level', 'burial_depth', 'traffic_load'],
  },
  {
    output: 'network_peak_demand',
    requires: ['number_of_connections'],
    improves: ['simultaneous_usage', 'number_of_units'],
  },
  {
    output: 'material_quantity',
    requires: ['route_length', 'pipe_diameter'],
    improves: ['field_length', 'field_width', 'number_of_branches', 'building_floors'],
  },
];

const BY_OUTPUT: ReadonlyMap<CalculatedKey, Dependency> = new Map(
  DEPENDENCIES.map((d) => [d.output, d]),
);

export function isCalculatedKey(key: string): key is CalculatedKey {
  return BY_OUTPUT.has(key as CalculatedKey);
}

/**
 * Parameter yang masih kurang untuk menghitung `output`, transitif: bila sebuah masukan adalah
 * keluaran lain yang belum tersedia, masukan keluaran itu ikut dicari. `available` = parameter
 * yang nilainya ada (dari pengguna, asumsi eksplisit, atau sudah dihitung).
 */
export function missingInputsFor(
  output: CalculatedKey,
  available: ReadonlySet<string>,
): readonly ParameterKey[] {
  const missing = new Set<ParameterKey>();
  const seen = new Set<CalculatedKey>();
  const walk = (key: CalculatedKey): void => {
    if (seen.has(key)) return;
    seen.add(key);
    const dep = BY_OUTPUT.get(key);
    if (!dep) return;
    for (const input of dep.requires) {
      if (available.has(input)) continue;
      if (isCalculatedKey(input)) walk(input);
      else missing.add(input);
    }
  };
  walk(output);
  return [...missing];
}

/** Masukan yang akan memperbaiki hasil `output` tetapi belum ada. */
export function improvingInputsFor(
  output: CalculatedKey,
  available: ReadonlySet<string>,
): readonly ParameterKey[] {
  const dep = BY_OUTPUT.get(output);
  if (!dep) return [];
  return (dep.improves ?? []).filter(
    (input): input is ParameterKey => !isCalculatedKey(input) && !available.has(input),
  );
}
