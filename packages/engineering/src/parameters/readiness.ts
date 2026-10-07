/**
 * Kesiapan per KELUARAN (brief §9, fase 1) — pengganti satu boolean "lengkap".
 *
 * Pemilihan bahan butuh lebih sedikit data daripada sizing pipa; sizing pompa butuh head;
 * BOM butuh geometri. Masing-masing dinilai sendiri:
 *   - `ready`        : seluruh masukan wajib diketahui dari pengguna/perhitungan;
 *   - `partial`      : masukan wajib terpenuhi, tetapi sebagian lewat ASUMSI, atau masukan
 *                      yang memperbaiki hasil belum ada;
 *   - `missing_data` : ada masukan wajib yang belum ada sama sekali.
 *
 * "Data inti sudah lengkap" hanya boleh diucapkan untuk keluaran yang `ready`.
 */

import { improvingInputsFor, missingInputsFor, type CalculatedKey } from './dependencies.js';
import type { EngineeringLocale } from './locale.js';
import type { ParameterKey } from './registry.js';

export type OutputKey =
  | 'material_selection'
  | 'pipe_sizing'
  | 'pump_sizing'
  | 'network_layout'
  | 'bom'
  | 'product_matching';

export type Readiness = 'ready' | 'partial' | 'missing_data';

/** Label keluaran dalam bahasa pengguna — untuk bagian "Kesiapan" jawaban (Fase 14 §28). */
export const OUTPUT_LABELS: Readonly<Record<OutputKey, string>> = {
  material_selection: 'Pemilihan bahan',
  pipe_sizing: 'Ukuran pipa',
  pump_sizing: 'Pompa',
  network_layout: 'Tata letak jaringan',
  bom: 'Perkiraan material',
  product_matching: 'Produk Pralon',
};

export const OUTPUT_LABELS_EN: Readonly<Record<OutputKey, string>> = {
  material_selection: 'Material selection',
  pipe_sizing: 'Pipe sizing',
  pump_sizing: 'Pump',
  network_layout: 'Network layout',
  bom: 'Material estimate',
  product_matching: 'Pralon products',
};

export function outputLabel(key: OutputKey, locale: EngineeringLocale): string {
  return (locale === 'en' ? OUTPUT_LABELS_EN : OUTPUT_LABELS)[key];
}

export interface OutputRequirement {
  readonly output: OutputKey;
  /** Parameter yang wajib ada (langsung). */
  readonly requires: readonly ParameterKey[];
  /** Keluaran kalkulasi yang harus bisa dihitung — ketergantungannya transitif. */
  readonly calculations: readonly CalculatedKey[];
  /** Parameter yang memperbaiki hasil. */
  readonly improves: readonly ParameterKey[];
}

/** Kebutuhan baku; profil kasus (fase 2) boleh menimpanya per kasus. */
export const OUTPUT_REQUIREMENTS: readonly OutputRequirement[] = [
  {
    output: 'material_selection',
    requires: ['fluid_type', 'installation_location'],
    calculations: [],
    improves: ['fluid_temperature', 'exposed_to_sun', 'movement_risk', 'route_length'],
  },
  {
    output: 'pipe_sizing',
    requires: ['design_flow', 'route_length'],
    calculations: ['pipe_diameter'],
    improves: ['static_head', 'required_pressure', 'material'],
  },
  {
    output: 'pump_sizing',
    requires: ['design_flow', 'static_head', 'route_length'],
    calculations: ['pump_duty'],
    improves: ['required_pressure', 'source_flow_capacity'],
  },
  {
    output: 'network_layout',
    requires: ['route_length'],
    calculations: [],
    improves: ['field_length', 'field_width', 'number_of_branches', 'building_floors', 'terrain'],
  },
  {
    output: 'bom',
    requires: ['route_length'],
    calculations: ['material_quantity'],
    improves: ['field_length', 'field_width', 'number_of_branches'],
  },
  {
    output: 'product_matching',
    requires: ['material'],
    calculations: ['pipe_diameter'],
    improves: ['pressure_class', 'installation_method'],
  },
];

export interface ReadinessReport {
  readonly readiness: Readonly<Record<OutputKey, Readiness>>;
  /** Parameter wajib yang masih kurang, per keluaran. */
  readonly missing: Readonly<Record<OutputKey, readonly ParameterKey[]>>;
  /** Parameter yang akan memperbaiki hasil, per keluaran. */
  readonly improvable: Readonly<Record<OutputKey, readonly ParameterKey[]>>;
}

export interface ReadinessInput {
  /** Parameter yang nilainya diketahui dari pengguna atau dihitung. */
  readonly known: ReadonlySet<string>;
  /** Parameter yang nilainya berasal dari asumsi eksplisit. */
  readonly assumed: ReadonlySet<string>;
  /** Kebutuhan per keluaran yang menimpa baku (dari profil kasus). */
  readonly overrides?: readonly OutputRequirement[];
}

export function resolveReadiness(input: ReadinessInput): ReadinessReport {
  const available = new Set<string>([...input.known, ...input.assumed]);
  const requirements = OUTPUT_REQUIREMENTS.map(
    (base) => input.overrides?.find((o) => o.output === base.output) ?? base,
  );

  const readiness = {} as Record<OutputKey, Readiness>;
  const missing = {} as Record<OutputKey, readonly ParameterKey[]>;
  const improvable = {} as Record<OutputKey, readonly ParameterKey[]>;

  for (const req of requirements) {
    const missingDirect = req.requires.filter((p) => !available.has(p));
    const missingCalc = req.calculations.flatMap((c) => missingInputsFor(c, available));
    const allMissing = [...new Set([...missingDirect, ...missingCalc])];
    const improving = [
      ...new Set([
        ...req.improves.filter((p) => !available.has(p)),
        ...req.calculations.flatMap((c) => improvingInputsFor(c, available)),
      ]),
    ];
    const usesAssumption =
      req.requires.some((p) => input.assumed.has(p) && !input.known.has(p)) ||
      req.calculations.some((c) =>
        missingInputsFor(c, input.known).some((p) => input.assumed.has(p)),
      );

    missing[req.output] = allMissing;
    improvable[req.output] = improving;
    readiness[req.output] =
      allMissing.length > 0
        ? 'missing_data'
        : usesAssumption || improving.length > 0
          ? 'partial'
          : 'ready';
  }

  return { readiness, missing, improvable };
}
