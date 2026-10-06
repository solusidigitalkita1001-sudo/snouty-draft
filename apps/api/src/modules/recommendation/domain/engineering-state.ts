/**
 * EngineeringState — proyeksi `RequirementState` (bentuk lama, dua jalur: bangunan dan
 * irigasi) ke kosakata parameter universal (brief asisten teknik umum, fase 1). **Fungsi murni.**
 *
 * Mengapa proyeksi, bukan penggantian: state lama tersimpan di `requirement_snapshots` dan
 * digerakkan ekstraksi + kartu klarifikasi yang sudah diuji pemilik. Proyeksi ini membaca
 * state itu tanpa mengubahnya, lalu menjawab tiga hal yang dulu tidak bisa dijawab:
 * parameter mana yang diketahui vs diasumsikan, asumsi registry mana yang akan dipakai
 * perhitungan, dan keluaran mana yang sudah siap — per keluaran, bukan satu boolean.
 */
import type { ParameterKey, ReadinessReport, AppliedAssumption } from '@snouty/engineering';
import {
  HDPE_FROM_METERS,
  applyAssumption,
  irrigationDutyAssumptionId,
  resolveReadiness,
} from '@snouty/engineering';
import type {
  Assumption,
  IrrigationField,
  RequirementState,
  TrackedValue,
} from '@snouty/shared-types';

/** Profil kasus yang sudah dilayani hari ini; daftar lengkap menyusul di fase 2. */
export type CaseId = 'residential_clean_water' | 'irrigation';

export type ParameterValue = number | string | boolean;

export interface EngineeringParameter {
  readonly key: ParameterKey;
  readonly value: ParameterValue;
  /** `known` = disebut/dipilih pengguna; `assumed` = diisi default/rentang. */
  readonly origin: 'known' | 'assumed';
  /** Jalur bidang state lama — supaya "perbaiki" membuka field yang tepat. */
  readonly fieldPath: string;
  readonly reason?: string;
}

export interface EngineeringState {
  readonly caseId: CaseId;
  readonly parameters: readonly EngineeringParameter[];
  /** Asumsi registry yang AKAN dipakai perhitungan untuk kasus ini. */
  readonly appliedAssumptions: readonly AppliedAssumption[];
  readonly readiness: ReadinessReport;
}

const UNKNOWN = 'Belum tahu';

/** Jalur irigasi: label rentang → angka titik tengah (sama dengan `irrigation-input.ts`). */
const AREA_BUCKET: Readonly<Record<string, number>> = {
  'Di bawah 0,5 ha': 0.25,
  '0,5–1 ha': 0.75,
  '1–2 ha': 1.5,
  'Di atas 2 ha': 3,
};
const DISTANCE_BUCKET: Readonly<Record<string, number>> = {
  'Di bawah 50 m': 25,
  '50–200 m': 125,
  '200–500 m': 350,
  'Di atas 500 m': 750,
};

export function engineeringStateFrom(state: RequirementState): EngineeringState {
  return state.useCase?.kind === 'irrigation' ? fromIrrigation(state) : fromBuilding(state);
}

function fromBuilding(state: RequirementState): EngineeringState {
  const parameters: EngineeringParameter[] = [];
  const track = <T>(
    key: ParameterKey,
    fieldPath: string,
    tv: TrackedValue<T>,
    map?: (v: T) => ParameterValue,
  ) => {
    if (tv.value === null || tv.value === undefined) return;
    const value = map ? map(tv.value) : (tv.value as unknown as ParameterValue);
    parameters.push({
      key,
      value,
      origin: tv.source === 'default_applied' || tv.provenance === 'ASSUMED' ? 'assumed' : 'known',
      fieldPath,
      ...(tv.reason ? { reason: tv.reason } : {}),
    });
  };

  track('building_type', 'building.type', state.building.type);
  track('building_floors', 'building.floors', state.building.floors);
  track(
    'building_height',
    'building.floorHeightM',
    state.building.floorHeightM,
    (h) => (state.building.floors.value ?? 1) * h,
  );
  track('route_length', 'building.dimensions', state.building.dimensions, (d) => d.mainRunMeters);
  track('bathrooms', 'fixtures.bathrooms', state.fixtures.bathrooms);
  track('basins', 'fixtures.basins', state.fixtures.basins);
  track('kitchens', 'fixtures.kitchens', state.fixtures.kitchens);
  track('number_of_outlets', 'fixtures.outletCount', state.fixtures.outletCount);
  track('source_type', 'water.source', state.water.source);
  track('fluid_type', 'water.installationType', state.water.installationType);
  track('pump_required', 'water.boosterPump', state.water.boosterPump);
  // Instalasi bangunan hari ini selalu di dalam bangunan (OQ-45 belum membuka opsi lain).
  parameters.push({
    key: 'installation_location',
    value: 'Di dalam bangunan',
    origin: 'assumed',
    fieldPath: 'water.installationType',
    reason: 'jalur bangunan: pipa di dalam bangunan',
  });

  const applied: AppliedAssumption[] = [applyAssumption('DESIGN_VELOCITY_PLASTIC')];
  if (state.building.floorHeightM.source === 'default_applied') {
    applied.push(applyAssumption('FLOOR_HEIGHT_3_5M'));
  }
  if (state.water.source.source === 'default_applied')
    applied.push(applyAssumption('SOURCE_ROOFTOP_TANK'));
  if (state.water.installationType.source === 'default_applied') {
    applied.push(applyAssumption('FLUID_CLEAN_WATER'));
  }

  return {
    caseId: 'residential_clean_water',
    parameters,
    appliedAssumptions: applied,
    readiness: readinessOf(parameters),
  };
}

function fromIrrigation(state: RequirementState): EngineeringState {
  const answers = state.useCase?.kind === 'irrigation' ? state.useCase.answers : {};
  const parameters: EngineeringParameter[] = [];
  const known = (key: ParameterKey, field: IrrigationField, value: ParameterValue) =>
    parameters.push({ key, value, origin: 'known', fieldPath: field });
  const assumed = (
    key: ParameterKey,
    field: IrrigationField,
    value: ParameterValue,
    reason: string,
  ) => parameters.push({ key, value, origin: 'assumed', fieldPath: field, reason });

  parameters.push({
    key: 'fluid_type',
    value: 'Air irigasi',
    origin: 'known',
    fieldPath: 'irrigation.method',
  });
  parameters.push({
    key: 'installation_location',
    value: 'Ditanam',
    origin: 'assumed',
    fieldPath: 'irrigation.distance',
    reason: 'jalur irigasi: pipa utama ditanam',
  });

  const area = answers['irrigation.areaHa'];
  const explicitHa = area ? /^(\d+(?:[.,]\d+)?)\s*ha$/.exec(area) : null;
  if (explicitHa)
    known('total_area', 'irrigation.areaHa', Number(explicitHa[1]!.replace(',', '.')));
  else if (area && AREA_BUCKET[area] !== undefined) {
    assumed(
      'total_area',
      'irrigation.areaHa',
      AREA_BUCKET[area]!,
      `titik tengah rentang "${area}"`,
    );
  }

  const method = answers['irrigation.method'];
  if (method && method !== UNKNOWN) known('irrigation_method', 'irrigation.method', method);

  const source = answers['irrigation.source'];
  if (source && source !== UNKNOWN) known('source_type', 'irrigation.source', source);

  const distance = answers['irrigation.distance'];
  if (distance && DISTANCE_BUCKET[distance] !== undefined) {
    assumed(
      'route_length',
      'irrigation.distance',
      DISTANCE_BUCKET[distance]!,
      `titik tengah rentang "${distance}"`,
    );
  }

  const elevation = answers['irrigation.elevation'];
  if (elevation && elevation !== UNKNOWN)
    known('source_elevation', 'irrigation.elevation', elevation);

  const pump = answers['irrigation.pump'];
  if (pump === 'Ya' || pump === 'Tidak') known('pump_required', 'irrigation.pump', pump === 'Ya');

  const applied: AppliedAssumption[] = [
    applyAssumption(irrigationDutyAssumptionId(methodKey(method))),
    applyAssumption('DESIGN_VELOCITY_PLASTIC'),
    applyAssumption('FIELD_SHAPE_SQUARE'),
    applyAssumption('LATERAL_SPACING_25M'),
  ];
  const route = parameters.find((p) => p.key === 'route_length');
  if (typeof route?.value === 'number' && route.value >= HDPE_FROM_METERS) {
    applied.push(applyAssumption('HDPE_MAIN_FROM_200M'));
  }

  return {
    caseId: 'irrigation',
    parameters,
    appliedAssumptions: applied,
    readiness: readinessOf(parameters),
  };
}

function methodKey(label: string | undefined): 'flood' | 'sprinkler' | 'drip' {
  if (label === 'Sprinkler') return 'sprinkler';
  if (label === 'Tetes') return 'drip';
  return 'flood';
}

function readinessOf(parameters: readonly EngineeringParameter[]): ReadinessReport {
  const known = new Set(parameters.filter((p) => p.origin === 'known').map((p) => p.key));
  const assumed = new Set(parameters.filter((p) => p.origin === 'assumed').map((p) => p.key));
  // Debit rencana selalu bisa diturunkan dari registry asumsi (ENG-101 / unit beban) — ia
  // "tersedia lewat asumsi", bukan hilang. Yang hilang adalah masukan yang tidak punya asumsi.
  if (!known.has('design_flow')) assumed.add('design_flow');
  if (!known.has('material')) assumed.add('material');
  return resolveReadiness({ known, assumed });
}

/** Asumsi registry → baris kartu "Asumsi yang digunakan" (bentuk lama, plus `assumptionId`). */
export function appliedAssumptionsToView(
  applied: readonly AppliedAssumption[],
  fieldPathFor: (parameter: ParameterKey) => string,
  ruleId?: string,
): readonly Assumption[] {
  return applied.map((a) => ({
    text: a.description,
    fieldPath: fieldPathFor(a.parameter),
    ...(ruleId ? { ruleId } : {}),
    assumptionId: a.id,
  }));
}

/** Parameter universal → field irigasi yang dibuka tombol "Perbaiki asumsi ini". */
export function irrigationFieldFor(parameter: ParameterKey): IrrigationField {
  switch (parameter) {
    case 'design_flow':
    case 'irrigation_method':
      return 'irrigation.method';
    case 'total_area':
    case 'field_shape':
    case 'number_of_branches':
      return 'irrigation.areaHa';
    case 'route_length':
    case 'material':
      return 'irrigation.distance';
    case 'source_type':
      return 'irrigation.source';
    case 'source_elevation':
    case 'static_head':
      return 'irrigation.elevation';
    default:
      return 'irrigation.pump';
  }
}
