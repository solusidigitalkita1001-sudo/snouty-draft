/**
 * Registry asumsi teknik terpusat (brief §20, fase 1).
 *
 * Setiap nilai yang dipakai perhitungan TANPA diberikan pengguna atau diukur harus lahir dari
 * sini — bukan konstanta di dalam aturan, bukan default di dalam prompt, bukan titik tengah
 * rentang yang dihitung diam-diam. Dengan satu tempat: asumsi bisa ditampilkan ke pengguna
 * dengan ID-nya, dibandingkan antar kasus, dan diganti nilainya oleh tim teknis Pralon tanpa
 * menyentuh rumus.
 *
 * Semua `confirmationRequired: true` sampai divalidasi — ini pengetahuan awal, bukan standar.
 */

import type { ParameterKey } from './registry.js';

export type AssumptionConfidence = 'high' | 'medium' | 'low';

export interface AssumptionDefinition {
  readonly id: string;
  /** Parameter yang diisi asumsi ini. */
  readonly parameter: ParameterKey;
  /** Profil kasus yang boleh memakainya; kosong = semua. */
  readonly appliesTo: readonly string[];
  /** Kapan asumsi ini boleh dipakai — kalimat, bukan kode: pemanggil yang memeriksanya. */
  readonly condition: string;
  readonly value: number | string | boolean;
  readonly unit?: string;
  readonly reference: string;
  readonly confidence: AssumptionConfidence;
  readonly confirmationRequired: boolean;
  /** Kalimat yang dilihat pengguna di "Asumsi sementara". */
  readonly description: string;
}

export const ASSUMPTIONS: readonly AssumptionDefinition[] = [
  // ── Irigasi ──
  {
    id: 'IRRIGATION_PRELIMINARY_FLOW_FLOOD',
    parameter: 'design_flow',
    appliesTo: ['irrigation'],
    condition: 'debit rencana tidak diberikan; metode genangan/gravitasi',
    value: 1.5,
    unit: 'l/s/ha',
    reference: 'KP-01 Kriteria Perencanaan Irigasi — kebutuhan air padi ±1,2–1,5 l/s/ha',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kebutuhan air irigasi genangan diasumsikan 1,5 liter/detik per hektar (awal).',
  },
  {
    id: 'IRRIGATION_PRELIMINARY_FLOW_SPRINKLER',
    parameter: 'design_flow',
    appliesTo: ['irrigation'],
    condition: 'debit rencana tidak diberikan; metode sprinkler',
    value: 0.8,
    unit: 'l/s/ha',
    reference: 'Praktik umum perancangan sprinkler (ET puncak ±5–7 mm/hari, operasi 8–12 jam)',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kebutuhan air sprinkler diasumsikan 0,8 liter/detik per hektar (awal).',
  },
  {
    id: 'IRRIGATION_PRELIMINARY_FLOW_DRIP',
    parameter: 'design_flow',
    appliesTo: ['irrigation'],
    condition: 'debit rencana tidak diberikan; metode tetes',
    value: 0.5,
    unit: 'l/s/ha',
    reference: 'Praktik umum perancangan irigasi tetes',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kebutuhan air irigasi tetes diasumsikan 0,5 liter/detik per hektar (awal).',
  },
  {
    id: 'FIELD_SHAPE_SQUARE',
    parameter: 'field_shape',
    appliesTo: ['irrigation'],
    condition: 'panjang dan lebar lahan tidak diberikan',
    value: 'Bujur sangkar',
    reference: 'Asumsi tata letak, bukan data lahan',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Lahan dianggap bujur sangkar untuk memperkirakan panjang distribusi — geometri sebenarnya mengubah BOM.',
  },
  {
    id: 'LATERAL_SPACING_25M',
    parameter: 'number_of_branches',
    appliesTo: ['irrigation'],
    condition: 'jumlah cabang tidak diberikan',
    value: 25,
    unit: 'm',
    reference: 'Asumsi tata letak: satu lateral tiap 25 m header',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Satu cabang distribusi tiap 25 meter header (asumsi tata letak).',
  },

  // ── Hidraulik bertekanan ──
  {
    id: 'DESIGN_VELOCITY_PLASTIC',
    parameter: 'design_velocity',
    appliesTo: [],
    condition: 'kecepatan rencana tidak ditentukan',
    value: 1.5,
    unit: 'm/s',
    reference: 'Praktik umum pipa plastik 1–2 m/s (gesek wajar, pukulan air terkendali)',
    confidence: 'high',
    confirmationRequired: true,
    description: 'Kecepatan aliran rencana 1,5 m/s untuk pipa plastik.',
  },
  {
    id: 'HAZEN_WILLIAMS_C_PLASTIC',
    parameter: 'material',
    appliesTo: [],
    condition: 'kerugian gesek dihitung untuk PVC/HDPE/PPR',
    value: 150,
    unit: 'C',
    reference: 'Koefisien Hazen-Williams pipa plastik halus C ≈ 140–150',
    confidence: 'high',
    confirmationRequired: true,
    description: 'Koefisien kekasaran Hazen-Williams C = 150 untuk pipa plastik.',
  },
  {
    id: 'HAZEN_WILLIAMS_C_GALVANIZED',
    parameter: 'material',
    appliesTo: [],
    condition: 'kerugian gesek dihitung untuk pipa galvanis',
    value: 100,
    unit: 'C',
    reference: 'Koefisien Hazen-Williams pipa baja galvanis terpakai C ≈ 100',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Koefisien kekasaran Hazen-Williams C = 100 untuk pipa galvanis.',
  },
  {
    id: 'RESIDUAL_PRESSURE_FIXTURE',
    parameter: 'required_pressure',
    appliesTo: ['residential_clean_water', 'multistorey_building_water', 'residential_cluster'],
    condition: 'tekanan sisa di fixture tidak ditentukan',
    value: 1,
    unit: 'bar',
    reference: 'Praktik umum tekanan minimum di kran/shower ±0,5–1 bar',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tekanan sisa minimum di titik terjauh diasumsikan 1 bar (±10 m kolom air).',
  },
  {
    id: 'MINOR_LOSS_FRACTION',
    parameter: 'allowable_head_loss',
    appliesTo: [],
    condition: 'daftar fitting tidak diketahui',
    value: 0.1,
    unit: '-',
    reference: 'Praktik umum: kerugian minor ±10 % dari kerugian gesek pipa lurus',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Kerugian di fitting diasumsikan 10 % dari kerugian gesek pipa.',
  },

  // ── Bangunan (dipindah dari ENG-004 / ENG-014) ──
  {
    id: 'FLOOR_HEIGHT_3_5M',
    parameter: 'building_height',
    appliesTo: ['residential_clean_water', 'multistorey_building_water'],
    condition: 'tinggi antar lantai tidak diberikan',
    value: 3.5,
    unit: 'm',
    reference: 'ENG-004 (prototipe): tinggi antar lantai 3,5 m',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tinggi antar lantai diasumsikan 3,5 meter.',
  },
  {
    id: 'SOURCE_ROOFTOP_TANK',
    parameter: 'source_type',
    appliesTo: ['residential_clean_water'],
    condition: 'sumber air tidak diberikan dan pengguna memilih "Belum tahu"',
    value: 'Toren atap',
    reference: 'ENG-014 (prototipe): default sumber distribusi toren atap',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Sumber distribusi diasumsikan toren atap, tanpa pompa pendorong.',
  },
  {
    id: 'FLUID_CLEAN_WATER',
    parameter: 'fluid_type',
    appliesTo: ['residential_clean_water'],
    condition: 'jenis instalasi tidak diberikan dan pengguna memilih "Belum tahu"',
    value: 'Air bersih',
    reference: 'ENG-014 (prototipe): default instalasi air bersih',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Instalasi diasumsikan untuk air bersih saja.',
  },

  // ── Bahan per segmen ──
  {
    id: 'HDPE_MAIN_FROM_200M',
    parameter: 'material',
    appliesTo: ['irrigation', 'long_distance_distribution', 'underground_distribution'],
    condition: 'jalur utama ditanam ≥ 200 m dan bahan tidak ditentukan',
    value: 'HDPE',
    reference: 'Praktik umum: jalur tanam panjang memakai HDPE (lentur, sedikit sambungan)',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Jalur utama yang ditanam dan panjang (≥ 200 m) diasumsikan memakai HDPE.',
  },

  // ── Air hujan ──
  {
    id: 'RUNOFF_C_RESIDENTIAL',
    parameter: 'runoff_coefficient',
    appliesTo: ['stormwater'],
    condition: 'koefisien limpasan tidak diberikan; kawasan perumahan',
    value: 0.6,
    unit: '-',
    reference: 'Rentang umum C perumahan 0,5–0,7',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Koefisien limpasan kawasan perumahan diasumsikan 0,6.',
  },
];

const BY_ID: ReadonlyMap<string, AssumptionDefinition> = new Map(ASSUMPTIONS.map((a) => [a.id, a]));

export function assumption(id: string): AssumptionDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`asumsi tidak terdaftar: ${id}`);
  return found;
}

/** Asumsi yang berlaku untuk sebuah profil kasus (termasuk yang berlaku untuk semua). */
export function assumptionsFor(caseId: string): readonly AssumptionDefinition[] {
  return ASSUMPTIONS.filter((a) => a.appliesTo.length === 0 || a.appliesTo.includes(caseId));
}

/** Bentuk yang disimpan di state saat sebuah asumsi benar-benar dipakai. */
export interface AppliedAssumption {
  readonly id: string;
  readonly parameter: ParameterKey;
  readonly value: number | string | boolean;
  readonly unit?: string;
  readonly description: string;
  readonly confirmationRequired: boolean;
}

export function apply(id: string): AppliedAssumption {
  const a = assumption(id);
  return {
    id: a.id,
    parameter: a.parameter,
    value: a.value,
    ...(a.unit !== undefined ? { unit: a.unit } : {}),
    description: a.description,
    confirmationRequired: a.confirmationRequired,
  };
}
