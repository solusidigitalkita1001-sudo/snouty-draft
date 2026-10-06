/**
 * Engineering Rule Engine — TypeScript murni, tanpa I/O, tanpa framework.
 *
 * Paket ini sengaja tidak punya dependensi runtime. Itu yang membuat SPEC §25
 * ("perhitungan teknik tidak pernah memanggil LLM") benar secara struktural: tidak ada
 * apa pun untuk dipanggil. Dijaga `scripts/check-engineering-isolation.mjs`.
 *
 * **Seluruh 14 aturan berstatus `REQUIRES_DOMAIN_VALIDATION`** sampai ahli domain
 * Pralon menandatanganinya (OQ-06). Konsekuensinya nyata, bukan administratif: gerbang
 * provenance menurunkan setiap keluaran menjadi `ASSUMED`, sehingga tidak ada satu pun
 * angka teknik yang tampil "TERVERIFIKASI". Itu perilaku yang benar.
 */

export type { AnyRule, RuleCategory, RuleValidationStatus, RuleVersion, TestCase } from './rule.js';
export {
  requireInt,
  requireNumber,
  RuleInputError,
  RuleRegistrationError,
  RuleRegistry,
} from './rule.js';

export { gateEngineProvenance } from './provenance.js';
export type { Provenance } from './provenance.js';

export {
  ENG_001,
  ENG_002,
  ENG_003,
  ENG_005,
  ENG_010,
  ENG_013,
  GROUP_A,
} from './rules/group-a-load-sizing.js';
export type {
  FixtureCounts,
  LoadResult,
  MainSizeResult,
  PressureClass,
} from './rules/group-a-load-sizing.js';

export { ENG_004, ENG_008, ENG_011, GROUP_B } from './rules/group-b-geometry.js';
export type {
  BoosterInput,
  FloorNode,
  FloorPlanInput,
  FloorPlanResult,
} from './rules/group-b-geometry.js';

export { ENG_006, ENG_009, ENG_012, GROUP_C } from './rules/group-c-material.js';
export type { BomInput, BomLine, BomResult } from './rules/group-c-material.js';

export { ENG_007, ENG_014, GROUP_D } from './rules/group-d-conversation.js';

export { buildSchematic } from './schematic.js';
export type {
  BuildSchematicInput,
  SchematicFloorShape,
  SchematicNodeShape,
  SchematicSegmentShape,
  SchematicShape,
  TrackedNumber,
} from './schematic.js';

export {
  ENG_101,
  ENG_102,
  ENG_103,
  ENG_104,
  ENG_105,
  GROUP_E,
} from './rules/group-e-irrigation.js';
export type {
  IrrigationBomLine,
  IrrigationMethod,
  SourceElevation,
} from './rules/group-e-irrigation.js';

export { computeIrrigation } from './compute-irrigation.js';
export type { IrrigationInput, IrrigationResult } from './compute-irrigation.js';

export { computeSolution } from './compute-solution.js';
export type { CalculationTrace, SolutionInput, SolutionResult } from './compute-solution.js';

/** Registry berisi seluruh 14 aturan, siap dipakai dan diperiksa. */
export { RULE_REGISTRY, ALL_RULES } from './registry.js';
