/**
 * CaseProfileRegistry (brief §2, §6 — fase 2).
 *
 * Satu profil per jenis kasus perpipaan: parameter yang aktif (diurutkan dari yang paling
 * menentukan), keluaran yang dijanjikan, dan kalkulasi yang dibutuhkan. Profil TIDAK berisi
 * rumus — ia memilih subset dari registry parameter dan menyetel kebutuhan per keluaran.
 *
 * `calculatorStatus: 'pending'` = kasus sudah dikenali dan ditanya dengan benar, tetapi
 * kalkulatornya belum ada (fase 3–4); muaranya validasi teknis terstruktur, bukan angka karangan.
 */

import type { CalculatedKey } from '../parameters/dependencies.js';
import type { EngineeringLocale } from '../parameters/locale.js';
import type { ParameterKey } from '../parameters/registry.js';
import type { OutputKey, OutputRequirement } from '../parameters/readiness.js';

export type CaseId =
  | 'residential_clean_water'
  | 'multistorey_building_water'
  | 'residential_cluster'
  | 'irrigation'
  | 'pump_transfer'
  | 'gravity_drainage'
  | 'stormwater'
  | 'culvert'
  | 'well_distribution'
  | 'fish_pond';

export interface CaseProfile {
  readonly id: CaseId;
  readonly label: string;
  readonly description: string;
  readonly labelEn: string;
  readonly descriptionEn: string;
  /** Urutan = prioritas bertanya bila sama-sama kurang. */
  readonly critical: readonly ParameterKey[];
  readonly important: readonly ParameterKey[];
  readonly optional: readonly ParameterKey[];
  readonly outputs: readonly OutputKey[];
  readonly calculations: readonly CalculatedKey[];
  /** Menimpa kebutuhan baku per keluaran (`OUTPUT_REQUIREMENTS`) untuk kasus ini. */
  readonly outputRequirements?: readonly OutputRequirement[];
  readonly calculatorStatus: 'available' | 'pending';
}

export const CASE_PROFILES: readonly CaseProfile[] = [
  {
    id: 'residential_clean_water',
    label: 'Air bersih rumah tinggal',
    labelEn: 'Clean water for houses',
    description: 'Distribusi air bersih di rumah/kos/ruko dari toren, pompa, atau PDAM.',
    descriptionEn:
      'Clean water distribution in houses/boarding houses/shophouses from a tank, pump, or municipal supply.',
    critical: ['source_type', 'fluid_type', 'building_floors', 'bathrooms'],
    important: ['basins', 'kitchens', 'number_of_outlets', 'pump_required', 'route_length'],
    optional: ['building_type', 'building_height', 'material', 'installation_method'],
    outputs: ['material_selection', 'pipe_sizing', 'network_layout', 'bom', 'product_matching'],
    calculations: ['design_flow_calc', 'pipe_diameter', 'material_quantity'],
    outputRequirements: [
      {
        output: 'pipe_sizing',
        requires: ['building_floors', 'bathrooms'],
        calculations: [],
        improves: ['basins', 'kitchens', 'number_of_outlets', 'route_length'],
      },
      {
        output: 'material_selection',
        requires: ['fluid_type', 'source_type'],
        calculations: [],
        improves: ['building_floors', 'pump_required'],
      },
      {
        output: 'network_layout',
        requires: ['building_floors'],
        calculations: [],
        improves: ['route_length'],
      },
      {
        output: 'bom',
        requires: ['building_floors', 'bathrooms'],
        calculations: [],
        improves: ['route_length'],
      },
      {
        output: 'product_matching',
        requires: ['fluid_type'],
        calculations: [],
        improves: ['material'],
      },
    ],
    calculatorStatus: 'available',
  },
  {
    id: 'multistorey_building_water',
    label: 'Air bersih gedung bertingkat',
    labelEn: 'Clean water for multi-storey buildings',
    description: 'Gedung ≥ 4 lantai: zonasi tekanan, riser, pompa transfer/booster.',
    descriptionEn: 'Buildings of 4+ floors: pressure zoning, risers, transfer/booster pumps.',
    critical: ['building_floors', 'number_of_outlets', 'source_type', 'building_height'],
    important: [
      'bathrooms',
      'required_pressure',
      'tank_elevation',
      'pump_required',
      'simultaneous_usage',
    ],
    optional: ['building_type', 'material', 'route_length'],
    outputs: [
      'material_selection',
      'pipe_sizing',
      'pump_sizing',
      'network_layout',
      'product_matching',
    ],
    calculations: ['design_flow_calc', 'static_head_calc', 'pipe_diameter', 'pump_duty'],
    calculatorStatus: 'pending',
  },
  {
    id: 'residential_cluster',
    label: 'Jaringan cluster perumahan',
    labelEn: 'Housing cluster network',
    description: 'Distribusi dari reservoir/sumur ke puluhan–ratusan sambungan rumah.',
    descriptionEn: 'Distribution from a reservoir/well to tens to hundreds of house connections.',
    critical: ['number_of_connections', 'route_length', 'static_head'],
    important: [
      'source_type',
      'simultaneous_usage',
      'terrain',
      'required_pressure',
      'number_of_branches',
    ],
    optional: ['total_area', 'material', 'installation_location'],
    outputs: [
      'material_selection',
      'pipe_sizing',
      'pump_sizing',
      'network_layout',
      'bom',
      'product_matching',
    ],
    calculations: ['network_peak_demand', 'pipe_diameter', 'pump_duty', 'material_quantity'],
    calculatorStatus: 'available',
  },
  {
    id: 'irrigation',
    label: 'Irigasi lahan',
    labelEn: 'Land irrigation',
    description: 'Sawah/kebun: debit dari luas dan metode, jalur utama, distribusi, pompa.',
    descriptionEn: 'Paddy/farm: flow from area and method, main route, distribution, pump.',
    critical: [
      'source_type',
      'total_area',
      'irrigation_method',
      'route_length',
      'source_elevation',
    ],
    important: ['pump_required', 'field_length', 'field_width', 'static_head'],
    optional: ['crop_type', 'terrain', 'material', 'operating_hours'],
    outputs: [
      'material_selection',
      'pipe_sizing',
      'pump_sizing',
      'network_layout',
      'bom',
      'product_matching',
    ],
    calculations: ['design_flow_calc', 'pipe_diameter', 'material_quantity'],
    outputRequirements: [
      {
        output: 'material_selection',
        requires: ['route_length'],
        calculations: [],
        improves: ['installation_location', 'exposed_to_sun'],
      },
      {
        output: 'pump_sizing',
        requires: ['irrigation_method', 'source_elevation'],
        calculations: [],
        improves: ['static_head', 'route_length', 'required_pressure'],
      },
      {
        output: 'product_matching',
        requires: ['total_area', 'irrigation_method', 'route_length'],
        calculations: [],
        improves: ['material'],
      },
    ],
    calculatorStatus: 'available',
  },
  {
    id: 'pump_transfer',
    label: 'Transfer air dengan pompa',
    labelEn: 'Pumped water transfer',
    description: 'Memompa dari sumber ke tandon/reservoir/lahan lewat satu jalur panjang.',
    descriptionEn: 'Pumping from a source to a tank/reservoir/field along one long route.',
    critical: ['design_flow', 'route_length', 'static_head', 'source_type'],
    important: ['required_pressure', 'material', 'operating_hours', 'pump_power'],
    optional: ['nominal_diameter', 'terrain', 'installation_location'],
    outputs: ['material_selection', 'pipe_sizing', 'pump_sizing', 'bom', 'product_matching'],
    calculations: [
      'pipe_diameter',
      'friction_loss',
      'total_dynamic_head',
      'pump_duty',
      'material_quantity',
    ],
    calculatorStatus: 'available',
  },
  {
    id: 'gravity_drainage',
    label: 'Saluran gravitasi / drainase',
    labelEn: 'Gravity channel / drainage',
    description: 'Air kotor, limbah, atau drainase lahan mengalir dengan kemiringan.',
    descriptionEn: 'Dirty water, wastewater, or field drainage flowing by slope.',
    critical: ['design_flow', 'route_length'],
    important: [
      'slope',
      'fluid_type',
      'upstream_level',
      'downstream_level',
      'nominal_diameter',
      'pipe_fill_ratio',
    ],
    optional: ['material', 'burial_depth', 'soil_type'],
    outputs: ['material_selection', 'pipe_sizing', 'bom', 'product_matching'],
    calculations: ['gravity_capacity', 'material_quantity'],
    calculatorStatus: 'available',
  },
  {
    id: 'stormwater',
    label: 'Drainase air hujan',
    labelEn: 'Stormwater drainage',
    description: 'Limpasan hujan dari tangkapan ke saluran/outfall.',
    descriptionEn: 'Rainfall runoff from the catchment to the channel/outfall.',
    critical: ['catchment_area', 'rainfall_intensity'],
    important: [
      'slope',
      'runoff_coefficient',
      'route_length',
      'outfall_condition',
      'return_period',
    ],
    optional: ['material', 'burial_depth'],
    outputs: ['material_selection', 'pipe_sizing', 'bom', 'product_matching'],
    calculations: ['stormwater_discharge', 'gravity_capacity', 'material_quantity'],
    calculatorStatus: 'available',
  },
  {
    id: 'culvert',
    label: 'Gorong-gorong',
    labelEn: 'Culvert',
    description: 'Pipa melintasi jalan/tanggul: hidraulik + beban lalu lintas.',
    descriptionEn: 'Pipe crossing a road/embankment: hydraulics plus traffic load.',
    critical: ['design_flow', 'road_width', 'traffic_load'],
    important: ['slope', 'burial_depth', 'upstream_level', 'downstream_level', 'catchment_area'],
    optional: ['soil_type', 'material'],
    outputs: ['material_selection', 'pipe_sizing', 'product_matching'],
    calculations: ['culvert_size', 'gravity_capacity'],
    calculatorStatus: 'available',
  },
  {
    id: 'fish_pond',
    label: 'Kolam / tambak ikan',
    labelEn: 'Fish pond',
    description: 'Pengisian dan pembuangan kolam lele/nila/udang: pipa masuk, pipa kuras, fitting.',
    descriptionEn:
      'Filling and draining catfish/tilapia/shrimp ponds: inlet pipe, drain pipe, fittings.',
    critical: ['pond_length', 'pond_width'],
    important: ['pond_depth', 'number_of_ponds', 'source_type', 'route_length', 'fill_time_hours'],
    optional: ['static_head', 'material', 'pump_required'],
    outputs: ['pipe_sizing', 'material_selection', 'bom', 'product_matching'],
    calculations: ['design_flow_calc', 'pipe_diameter', 'material_quantity'],
    outputRequirements: [
      {
        output: 'pipe_sizing',
        requires: ['pond_length', 'pond_width'],
        calculations: [],
        improves: ['pond_depth', 'fill_time_hours', 'number_of_ponds'],
      },
      {
        output: 'material_selection',
        requires: [],
        calculations: [],
        improves: ['source_type', 'pump_required'],
      },
      {
        output: 'bom',
        requires: ['pond_length', 'pond_width'],
        calculations: [],
        improves: ['pond_depth', 'number_of_ponds', 'route_length'],
      },
      {
        output: 'product_matching',
        requires: ['pond_length', 'pond_width'],
        calculations: [],
        improves: ['material'],
      },
    ],
    calculatorStatus: 'available',
  },
  {
    id: 'well_distribution',
    label: 'Sumur dan distribusi',
    labelEn: 'Well and distribution',
    description: 'Sumur bor/submersible ke tandon lalu distribusi.',
    descriptionEn: 'Bored/submersible well to a tank, then distribution.',
    critical: ['well_depth', 'design_flow', 'tank_elevation', 'route_length'],
    important: ['source_flow_capacity', 'pump_power', 'number_of_outlets'],
    optional: ['material', 'operating_hours'],
    outputs: ['material_selection', 'pipe_sizing', 'pump_sizing', 'product_matching'],
    calculations: ['static_head_calc', 'pipe_diameter', 'pump_duty'],
    calculatorStatus: 'available',
  },
];

const BY_ID: ReadonlyMap<CaseId, CaseProfile> = new Map(CASE_PROFILES.map((p) => [p.id, p]));

export function caseProfile(id: CaseId): CaseProfile {
  const profile = BY_ID.get(id);
  if (!profile) throw new Error(`profil kasus tidak terdaftar: ${id}`);
  return profile;
}

export function caseProfileLabel(id: CaseId, locale: EngineeringLocale): string {
  const p = caseProfile(id);
  return locale === 'en' ? p.labelEn : p.label;
}

export function caseProfileDescription(id: CaseId, locale: EngineeringLocale): string {
  const p = caseProfile(id);
  return locale === 'en' ? p.descriptionEn : p.description;
}

export function isCaseId(id: string): id is CaseId {
  return BY_ID.has(id as CaseId);
}

/** Semua parameter aktif sebuah kasus, urut prioritas. */
export function activeParameters(profile: CaseProfile): readonly ParameterKey[] {
  return [...profile.critical, ...profile.important, ...profile.optional];
}
