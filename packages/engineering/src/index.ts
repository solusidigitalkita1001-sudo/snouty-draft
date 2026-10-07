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

// ── Fase 1 asisten teknik umum: registry parameter, asumsi, ketergantungan, kesiapan ──
export { DEFAULT_ENGINEERING_LOCALE } from './parameters/locale.js';
export type { EngineeringLocale } from './parameters/locale.js';
export {
  PARAMETERS,
  isParameterKey,
  parameterDefinition,
  parameterLabel,
  parameterOptionLabels,
  parameterQuestion,
  parameterReason,
} from './parameters/registry.js';
export type {
  ParameterDefinition,
  ParameterDomain,
  ParameterImportance,
  ParameterKey,
  ParameterKind,
} from './parameters/registry.js';
export {
  ASSUMPTIONS,
  apply as applyAssumption,
  assumption,
  assumptionCondition,
  assumptionDescription,
  assumptionsFor,
} from './parameters/assumptions.js';
export type {
  AppliedAssumption,
  AssumptionConfidence,
  AssumptionDefinition,
} from './parameters/assumptions.js';
export {
  DEPENDENCIES,
  improvingInputsFor,
  isCalculatedKey,
  missingInputsFor,
} from './parameters/dependencies.js';
export type { CalculatedKey, Dependency } from './parameters/dependencies.js';
export {
  OUTPUT_LABELS,
  OUTPUT_LABELS_EN,
  OUTPUT_REQUIREMENTS,
  outputLabel,
  resolveReadiness,
} from './parameters/readiness.js';
export type {
  OutputKey,
  OutputRequirement,
  Readiness,
  ReadinessInput,
  ReadinessReport,
} from './parameters/readiness.js';

// ── Fase 2: profil kasus, klasifikasi, ekstraksi konteks teknis, parameter kurang ──
export {
  CASE_PROFILES,
  activeParameters,
  caseProfile,
  caseProfileDescription,
  caseProfileLabel,
  isCaseId,
} from './cases/profiles.js';
export type { CaseId, CaseProfile } from './cases/profiles.js';
export { classifyCase } from './cases/classifier.js';
export type { CaseClassification } from './cases/classifier.js';
export { extractTechnicalContext } from './cases/extractor.js';
export type { ExtractedParameter } from './cases/extractor.js';
export { MAX_QUESTIONS, caseReadiness, resolveMissingParameters } from './cases/missing.js';
export type { CaseReadinessInput, MissingParameter } from './cases/missing.js';

export { HDPE_FROM_METERS, irrigationDutyAssumptionId } from './rules/group-e-irrigation.js';
export {
  HDPE_MM_SIZES,
  PVC_INCH_SIZES,
  sizeTable,
  sizeTableFor,
} from './parameters/size-tables.js';
export type { NominalSize, SizeTableId } from './parameters/size-tables.js';

// ── Fase 3: hidraulik bertekanan ──
export {
  ENG_201,
  ENG_202,
  ENG_203,
  ENG_204,
  ENG_205,
  ENG_206,
  GROUP_F,
  frictionLossOf,
  tdhOf,
  velocityOf,
} from './rules/group-f-pressurized.js';
export type {
  CandidateStatus,
  PumpDutyResult,
  SizeCandidate,
  SizingResult,
} from './rules/group-f-pressurized.js';
export { ENG_301, ENG_302, ENG_303, ENG_304, GROUP_G } from './rules/group-g-pond.js';
export type { PondBomLine } from './rules/group-g-pond.js';
export { computePond } from './compute-pond.js';
export type { PondInput, PondResult } from './compute-pond.js';
export { computePressurized } from './compute-pressurized.js';
// ── Fase 4: gravitasi, air hujan, gorong-gorong, jaringan cluster ──
export {
  ENG_401,
  ENG_402,
  ENG_403,
  ENG_404,
  ENG_405,
  GRAVITY_SIZES,
  GROUP_H,
  manningFullFlow,
} from './rules/group-h-gravity.js';
export type { GravityCandidate, GravitySizingResult } from './rules/group-h-gravity.js';
export { GravityInputError, computeGravity } from './compute-gravity.js';
export type { GravityInput, GravityKind, GravityResult, TrafficLoad } from './compute-gravity.js';
export { computeNetwork } from './compute-network.js';
export type { NetworkInput, NetworkResult } from './compute-network.js';
export type { PipeMaterial, PressurizedInput, PressurizedResult } from './compute-pressurized.js';
export {
  barToHeadM,
  headMToBar,
  inchToMm,
  kmToM,
  lminToLs,
  lsToM3h,
  m3hToLs,
  parseInchLabel,
} from './units.js';
export { computeIrrigation } from './compute-irrigation.js';
export type { IrrigationInput, IrrigationResult } from './compute-irrigation.js';

export { computeSolution } from './compute-solution.js';
export type { CalculationTrace, SolutionInput, SolutionResult } from './compute-solution.js';

/** Registry berisi seluruh 14 aturan, siap dipakai dan diperiksa. */
export { RULE_REGISTRY, ALL_RULES } from './registry.js';
