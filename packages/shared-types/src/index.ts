export type { Provenance, FieldSource, TrackedValue } from './provenance.js';
export type { ErrorCode, PolicyCode, ApiErrorBody } from './errors.js';
export type {
  AnalysisStage,
  AssistantStreamEvent,
  AssistantStreamEventType,
  StageStatus,
  TokenUsage,
} from './sse.js';
export { PipeSize, PipeSizeRange, PipeSizeTransition } from './pipe-size.js';
export type {
  CatalogVersion,
  CatalogVersionStatus,
  CatalogImportIssue,
  CatalogImportResult,
  CompatibleFitting,
  FittingKind,
  PressureClass,
  Product,
  ProductDocument,
  ProductMatchState,
  ProductStatus,
  SpecValue,
  UnavailableSpecValue,
  VerifiedSpecValue,
} from './catalog.js';
export { specHasValue } from './catalog.js';
export type {
  AssistantCard,
  AssistantCardKind,
  ClarificationQuestion,
  CriteriaItem,
  KeyValue,
  ProductCardDto,
  SummaryField,
} from './assistant-card.js';
export { MAX_CLARIFICATION_QUESTIONS } from './assistant-card.js';
export type {
  ConversationMessage,
  ConversationStage,
  ConversationStatus,
  ConversationSummary,
  MessageRole,
} from './conversation.js';
export { CONVERSATION_STATUS_LABELS } from './conversation.js';
export type {
  BuildingState,
  BuildingType,
  Dimensions,
  FixtureState,
  InstallationType,
  Intent,
  RequirementCompleteness,
  RequirementFieldPath,
  RequirementState,
  SnapshotTrigger,
  WaterSource,
  WaterState,
} from './requirement.js';
export { CORE_REQUIREMENT_FIELDS } from './requirement.js';
export type {
  Assumption,
  BomItem,
  BomUnit,
  Recommendation,
  RecommendationStats,
  SelectedProduct,
  SystemLine,
  SystemRole,
} from './recommendation.js';
export type {
  Schematic,
  SchematicFloor,
  SchematicNode,
  SchematicNodeType,
  SchematicSegment,
  SchematicTitleBlock,
  SegmentRole,
} from './schematic.js';
export { ANALYSIS_STAGE_LABELS } from './sse.js';
