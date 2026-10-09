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

import type { EngineeringLocale } from './locale.js';
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
  /** Terjemahan Inggris `condition` dan `description`; `reference` mengutip dokumen dan tidak diterjemahkan. */
  readonly conditionEn: string;
  readonly descriptionEn: string;
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
    conditionEn: 'design flow not given; flood/gravity method',
    descriptionEn:
      'Flood irrigation water demand is assumed at 1.5 liters/second per hectare (initial).',
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
    conditionEn: 'design flow not given; sprinkler method',
    descriptionEn: 'Sprinkler water demand is assumed at 0.8 liters/second per hectare (initial).',
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
    conditionEn: 'design flow not given; drip method',
    descriptionEn:
      'Drip irrigation water demand is assumed at 0.5 liters/second per hectare (initial).',
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
    conditionEn: 'field length and width not given',
    descriptionEn:
      'The field is treated as square to estimate the distribution length; the actual geometry changes the BOM.',
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
    conditionEn: 'number of branches not given',
    descriptionEn:
      'One distribution branch every 25 meters of main line in the field (layout estimate).',
    reference: 'Asumsi tata letak: satu lateral tiap 25 m header',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Satu cabang distribusi tiap 25 meter pipa utama di lahan (perkiraan tata letak).',
  },

  // ── Kolam / tambak ──
  {
    id: 'POND_DEPTH_1M',
    parameter: 'pond_depth',
    appliesTo: ['fish_pond'],
    condition: 'tinggi air kolam tidak diberikan',
    value: 1,
    unit: 'm',
    conditionEn: 'pond water depth not given',
    descriptionEn: 'Pond water depth is assumed to be 1 meter.',
    reference: 'Praktik umum kolam lele/nila: tinggi air 0,8–1,2 m',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tinggi air kolam diasumsikan 1 meter.',
  },
  {
    id: 'POND_FILL_TIME_3H',
    parameter: 'fill_time_hours',
    appliesTo: ['fish_pond'],
    condition: 'lama pengisian tidak diberikan',
    value: 3,
    unit: 'jam',
    conditionEn: 'fill time not given',
    descriptionEn:
      'The pond is assumed to fill completely in 3 hours, which sets the flow rate and inlet pipe.',
    reference: 'Praktik umum: kolam kecil diisi penuh dalam 2–4 jam',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Kolam diasumsikan terisi penuh dalam 3 jam — menentukan debit dan pipa masuk.',
  },
  {
    id: 'POND_DRAIN_TIME_1H',
    parameter: 'fill_time_hours',
    appliesTo: ['fish_pond'],
    condition: 'lama pengurasan tidak diberikan',
    value: 1,
    unit: 'jam',
    conditionEn: 'drain time not given',
    descriptionEn: 'Pond draining is assumed to take 1 hour, which sets the drain pipe diameter.',
    reference: 'Praktik umum: pengurasan kolam ±1 jam untuk panen/ganti air',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Pengurasan kolam diasumsikan 1 jam — menentukan diameter pipa pembuangan.',
  },
  {
    id: 'DRAIN_VELOCITY_GRAVITY',
    parameter: 'design_velocity',
    appliesTo: ['fish_pond', 'gravity_drainage'],
    condition: 'kecepatan aliran gravitasi di pipa pembuangan',
    value: 1,
    unit: 'm/s',
    conditionEn: 'gravity flow velocity in the drain pipe',
    descriptionEn: 'Flow velocity in the drain pipe is assumed to be 1 m/s (gravity).',
    reference: 'Praktik umum pipa buang gravitasi berisi penuh ±0,8–1,2 m/s',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kecepatan aliran di pipa pembuangan diasumsikan 1 m/s (gravitasi).',
  },
  {
    id: 'POND_INLET_ROUTE_10M',
    parameter: 'route_length',
    appliesTo: ['fish_pond'],
    condition: 'jarak sumber air ke kolam tidak diberikan',
    value: 10,
    unit: 'm',
    conditionEn: 'distance from water source to pond not given',
    descriptionEn:
      'The distance from the water source to the pond is assumed to be 10 meters to size the inlet pipe.',
    reference: 'Asumsi tata letak: sumber/pompa dekat kolam',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Jarak sumber air ke kolam diasumsikan 10 meter untuk menghitung pipa masuk.',
  },

  // ── Hidraulik bertekanan ──
  {
    id: 'DESIGN_VELOCITY_PLASTIC',
    parameter: 'design_velocity',
    appliesTo: [],
    condition: 'kecepatan rencana tidak ditentukan',
    value: 1.5,
    unit: 'm/s',
    conditionEn: 'design velocity not specified',
    descriptionEn: 'Design flow velocity of 1.5 m/s for plastic pipe.',
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
    conditionEn: 'friction loss calculated for PVC/HDPE/PPR',
    descriptionEn:
      'The inside of plastic pipe is taken as smooth (roughness value 150), so it loses little pressure.',
    reference: 'Koefisien Hazen-Williams pipa plastik halus C ≈ 140–150',
    confidence: 'high',
    confirmationRequired: true,
    description:
      'Dinding dalam pipa plastik dianggap licin (nilai kekasaran 150), jadi kehilangan tekanannya kecil.',
  },
  {
    id: 'HAZEN_WILLIAMS_C_GALVANIZED',
    parameter: 'material',
    appliesTo: [],
    condition: 'kerugian gesek dihitung untuk pipa galvanis',
    value: 100,
    unit: 'C',
    conditionEn: 'friction loss calculated for galvanized pipe',
    descriptionEn:
      'The inside of galvanized pipe is taken as rougher (roughness value 100), so it loses more pressure.',
    reference: 'Koefisien Hazen-Williams pipa baja galvanis terpakai C ≈ 100',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Dinding dalam pipa galvanis dianggap lebih kasar (nilai kekasaran 100), jadi kehilangan tekanannya lebih besar.',
  },
  {
    id: 'VELOCITY_MAX_PLASTIC',
    parameter: 'design_velocity',
    appliesTo: [],
    condition: 'batas atas kecepatan untuk menilai kandidat diameter',
    value: 2,
    unit: 'm/s',
    conditionEn: 'upper velocity limit for judging diameter candidates',
    descriptionEn: 'Maximum flow velocity of 2 m/s for plastic pipe.',
    reference: 'Praktik umum pipa plastik: ≤ 2 m/s untuk membatasi gesek dan pukulan air',
    confidence: 'high',
    confirmationRequired: true,
    description: 'Kecepatan aliran maksimum 2 m/s untuk pipa plastik.',
  },
  {
    id: 'VELOCITY_MIN_SELF_CLEANING',
    parameter: 'design_velocity',
    appliesTo: [],
    condition: 'batas bawah kecepatan untuk menilai kandidat diameter',
    value: 0.6,
    unit: 'm/s',
    conditionEn: 'lower velocity limit for judging diameter candidates',
    descriptionEn: 'Minimum flow velocity of 0.6 m/s so the pipe cleans itself.',
    reference: 'Praktik umum: ≥ 0,6 m/s agar endapan tidak menumpuk',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kecepatan aliran minimum 0,6 m/s supaya pipa membersihkan diri.',
  },
  {
    id: 'HEADLOSS_GRADIENT_MAX',
    parameter: 'allowable_head_loss',
    appliesTo: [],
    condition: 'kerugian gesek yang diizinkan tidak ditentukan',
    value: 10,
    unit: 'm/100 m',
    conditionEn: 'allowable friction loss not specified',
    descriptionEn: 'The chosen pipe size loses at most 10 m of pressure per 100 m of pipe.',
    reference: 'Praktik umum perancangan jalur transfer: gradien ≤ 5–10 m per 100 m',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Ukuran pipa yang dipilih kehilangan tekanan paling banyak 10 m tiap 100 m pipa.',
  },
  {
    id: 'PUMP_EFFICIENCY_INDICATIVE',
    parameter: 'pump_power',
    appliesTo: [],
    condition: 'daya poros indikatif dihitung tanpa kurva pompa',
    value: 0.6,
    unit: '-',
    conditionEn: 'indicative shaft power calculated without a pump curve',
    descriptionEn:
      'Pump efficiency of 60 % for indicative shaft power; this is not a pump selection.',
    reference: 'Efisiensi keseluruhan pompa sentrifugal kecil ±50–70 %',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Efisiensi pompa 60 % untuk daya poros indikatif — bukan pemilihan pompa.',
  },
  {
    id: 'TRANSFER_DISCHARGE_MARGIN',
    parameter: 'required_pressure',
    appliesTo: [
      'pump_transfer',
      'well_distribution',
      'residential_cluster',
      'multistorey_building_water',
    ],
    condition: 'tekanan sisa di titik keluar tidak ditentukan (buangan ke tandon/bak)',
    value: 0.5,
    unit: 'bar',
    conditionEn: 'residual pressure at the outlet not specified (discharge into a tank/basin)',
    descriptionEn: 'Residual pressure of 0.5 bar (about 5 m) at the outlet as a margin.',
    reference: 'Margin keluaran ±5 m kolom air untuk katup, meter, dan ketidakpastian jalur',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tekanan sisa 0,5 bar (±5 m) di titik keluar sebagai margin.',
  },
  {
    id: 'RESIDUAL_PRESSURE_FIXTURE',
    parameter: 'required_pressure',
    appliesTo: ['residential_clean_water', 'multistorey_building_water', 'residential_cluster'],
    condition: 'tekanan sisa di fixture tidak ditentukan',
    value: 1,
    unit: 'bar',
    conditionEn: 'residual pressure at the fixture not specified',
    descriptionEn:
      'Minimum residual pressure at the farthest point is assumed to be 1 bar (about 10 m of water column).',
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
    conditionEn: 'fitting list unknown',
    descriptionEn:
      'Bends, joints, and valves are taken to add 10 % to the pressure lost in straight pipe.',
    reference: 'Praktik umum: kerugian minor ±10 % dari kerugian gesek pipa lurus',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Belokan, sambungan, dan katup dianggap menambah 10 % kehilangan tekanan dari pipa lurus.',
  },

  // ── Bangunan (dipindah dari ENG-004 / ENG-014) ──
  {
    id: 'FLOOR_HEIGHT_3_5M',
    parameter: 'building_height',
    appliesTo: ['residential_clean_water', 'multistorey_building_water'],
    condition: 'tinggi antar lantai tidak diberikan',
    value: 3.5,
    unit: 'm',
    conditionEn: 'floor-to-floor height not given',
    descriptionEn: 'Floor-to-floor height is assumed to be 3.5 meters.',
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
    conditionEn: 'water source not given and the user chose "Not sure"',
    descriptionEn:
      'The distribution source is assumed to be a rooftop tank, without a booster pump.',
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
    conditionEn: 'installation type not given and the user chose "Not sure"',
    descriptionEn: 'The installation is assumed to be for clean water only.',
    reference: 'ENG-014 (prototipe): default instalasi air bersih',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Instalasi diasumsikan untuk air bersih saja.',
  },

  {
    id: 'HDPE_SDR17_PN10',
    parameter: 'pressure_class',
    appliesTo: [],
    condition: 'diameter dalam HDPE diperkirakan dari OD tanpa data tebal dinding Pralon',
    value: 17,
    unit: 'SDR',
    conditionEn: 'HDPE inner diameter estimated from OD without Pralon wall-thickness data',
    descriptionEn:
      'HDPE inner diameter is estimated for PE100 PN 10 (SDR 17); other classes change the inner diameter.',
    reference: 'ISO 4427: PE100 PN 10 ≈ SDR 17 (tebal dinding = OD / 17)',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Diameter dalam HDPE diperkirakan untuk PE100 PN 10 (SDR 17); kelas lain mengubah diameter dalam.',
  },

  // ── Bahan per segmen ──
  {
    id: 'HDPE_MAIN_FROM_200M',
    parameter: 'material',
    appliesTo: ['irrigation', 'long_distance_distribution', 'underground_distribution'],
    condition: 'jalur utama ditanam ≥ 200 m dan bahan tidak ditentukan',
    value: 'HDPE',
    conditionEn: 'buried main route of 200 m or more and material not specified',
    descriptionEn: 'A long buried main route (200 m or more) is assumed to use HDPE.',
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
    conditionEn: 'runoff coefficient not given; residential area',
    descriptionEn:
      'In a residential area, 60 % of the rain is taken to run into the drain (the rest soaks in).',
    reference: 'Rentang umum C perumahan 0,5–0,7',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Di kawasan perumahan, 60 % air hujan dianggap mengalir ke saluran (sisanya meresap).',
  },

  // ── Gravitasi / drainase ──
  {
    id: 'MANNING_N_PLASTIC',
    parameter: 'material',
    appliesTo: [],
    condition: 'kapasitas gravitasi dihitung untuk pipa PVC/HDPE',
    value: 0.01,
    unit: 'n',
    conditionEn: 'gravity capacity calculated for PVC/HDPE pipe',
    descriptionEn:
      'The inside of plastic pipe is taken as smooth (roughness value 0.010) for gravity drain calculations.',
    reference: 'Koefisien Manning pipa plastik halus n ≈ 0,009–0,011',
    confidence: 'high',
    confirmationRequired: true,
    description:
      'Dinding dalam pipa plastik dianggap licin (nilai kekasaran 0,010) untuk hitungan saluran gravitasi.',
  },
  {
    id: 'PIPE_FILL_RATIO_GRAVITY',
    parameter: 'pipe_fill_ratio',
    appliesTo: ['gravity_drainage', 'stormwater', 'culvert'],
    condition: 'rasio pengisian tidak ditentukan',
    value: 80,
    unit: '%',
    conditionEn: 'fill ratio not specified',
    descriptionEn: 'Design flow is limited to 80 % of full-pipe capacity (leaving air space).',
    reference: 'Praktik umum saluran tertutup: debit rencana ≤ 80 % kapasitas penuh',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Debit rencana dibatasi 80 % kapasitas pipa penuh (sisa ruang udara).',
  },
  {
    id: 'GRAVITY_SLOPE_MIN_0_5',
    parameter: 'slope',
    appliesTo: ['gravity_drainage', 'stormwater'],
    condition: 'kemiringan saluran tidak diberikan',
    value: 0.5,
    unit: '%',
    conditionEn: 'channel slope not given',
    descriptionEn: 'Channel slope is assumed to be 0.5 % when not stated.',
    reference: 'Kemiringan minimum lazim saluran pembuangan 0,5–1 %',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Kemiringan saluran diasumsikan 0,5 % bila belum disebut.',
  },
  {
    id: 'CULVERT_COVER_MIN_0_6',
    parameter: 'burial_depth',
    appliesTo: ['culvert'],
    condition: 'kedalaman timbunan di atas gorong-gorong tidak diberikan',
    value: 0.6,
    unit: 'm',
    conditionEn: 'cover depth above the culvert not given',
    descriptionEn:
      'Minimum cover above the culvert is assumed to be 0.6 m; the structure must be checked.',
    reference:
      'Praktik umum: timbunan minimum ±0,6 m (≥ 1 × diameter) untuk pipa plastik di bawah jalan',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Timbunan minimum di atas gorong-gorong diasumsikan 0,6 m — struktur wajib diperiksa.',
  },

  // ── Jaringan cluster ──
  {
    id: 'DEMAND_LPCD_150',
    parameter: 'design_flow',
    appliesTo: ['residential_cluster', 'multistorey_building_water'],
    condition: 'kebutuhan air per orang tidak diberikan',
    value: 150,
    unit: 'l/orang/hari',
    conditionEn: 'water demand per person not given',
    descriptionEn: 'Water demand of 150 liters per person per day.',
    reference: 'Kriteria umum air bersih domestik perkotaan Indonesia 120–150 l/orang/hari',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kebutuhan air 150 liter per orang per hari.',
  },
  {
    id: 'PERSONS_PER_UNIT_4',
    parameter: 'number_of_units',
    appliesTo: ['residential_cluster'],
    condition: 'jumlah penghuni per unit tidak diberikan',
    value: 4,
    unit: 'orang/unit',
    conditionEn: 'number of occupants per unit not given',
    descriptionEn: 'Four occupants per house unit.',
    reference: 'Asumsi umum satu keluarga per unit rumah',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Empat penghuni per unit rumah.',
  },
  {
    id: 'PEAK_HOUR_FACTOR_2',
    parameter: 'simultaneous_usage',
    appliesTo: ['residential_cluster', 'multistorey_building_water'],
    condition: 'pola pemakaian serentak tidak diberikan',
    value: 2,
    unit: '-',
    conditionEn: 'simultaneous usage pattern not given',
    descriptionEn: 'Peak hour factor of 2.0 relative to the average daily demand.',
    reference: 'Faktor jam puncak jaringan domestik 1,5–2,5',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Faktor jam puncak 2,0 terhadap kebutuhan rata-rata harian.',
  },

  // ── Gedung bertingkat (keputusan pemilik 2026-10-09: gedung > 4 lantai tetap dihitung) ──
  // Nilai awal dari buku acuan plambing Indonesia; semuanya wajib dikonfirmasi tim teknis (OQ-57).
  {
    id: 'OCCUPANT_AREA_10M2',
    parameter: 'number_of_occupants',
    appliesTo: ['multistorey_building_water'],
    condition: 'jumlah penghuni tidak diberikan tetapi luas lantai diketahui',
    value: 10,
    unit: 'm²/orang',
    conditionEn: 'number of occupants not given but the floor area is known',
    descriptionEn: 'One person per 10 m² of gross floor area.',
    reference:
      'Noerbambang & Morimura, Perancangan dan Pemeliharaan Sistem Plambing: perkiraan penghuni dari luas lantai (kepadatan hunian)',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Satu orang per 10 m² luas lantai kotor.',
  },
  {
    id: 'USAGE_HOURS_10',
    parameter: 'operating_hours',
    appliesTo: ['multistorey_building_water'],
    condition: 'jam pemakaian air gedung tidak diberikan',
    value: 10,
    unit: 'jam/hari',
    conditionEn: 'daily hours of water use not given',
    descriptionEn: 'Water is used over 10 hours a day.',
    reference:
      'Noerbambang & Morimura, Perancangan dan Pemeliharaan Sistem Plambing: jangka waktu pemakaian rata-rata 8–10 jam/hari',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Air dipakai selama 10 jam per hari.',
  },
  {
    id: 'PEAK_MINUTE_FACTOR_3',
    parameter: 'simultaneous_usage',
    appliesTo: ['multistorey_building_water'],
    condition: 'pola pemakaian serentak tidak diberikan',
    value: 3,
    unit: '-',
    conditionEn: 'simultaneous usage pattern not given',
    descriptionEn: 'Peak-minute factor of 3.0 relative to the average hourly use.',
    reference:
      'Noerbambang & Morimura, Perancangan dan Pemeliharaan Sistem Plambing: faktor menit puncak 3,0–4,0',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Faktor menit puncak 3,0 terhadap pemakaian rata-rata per jam.',
  },
  {
    id: 'ZONE_MAX_STATIC_4BAR',
    parameter: 'required_pressure',
    appliesTo: ['multistorey_building_water'],
    condition: 'batas tekanan statik per zona tidak ditentukan',
    value: 4,
    unit: 'bar',
    conditionEn: 'maximum static pressure per zone not specified',
    descriptionEn:
      'Static pressure in each zone is limited to 4 bar; lower floors are split into zones with pressure-reducing valves.',
    reference:
      'Noerbambang & Morimura, Perancangan dan Pemeliharaan Sistem Plambing: tekanan statik maksimum per zona ±3–5 kg/cm² sesuai jenis gedung',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Tekanan statik tiap zona dibatasi 4 bar; lantai bawah dibagi zona dengan katup penurun tekanan.',
  },
  {
    id: 'GROUND_TANK_1_DAY',
    parameter: 'design_flow',
    appliesTo: ['multistorey_building_water'],
    condition: 'kapasitas cadangan tangki bawah tidak ditentukan',
    value: 1,
    unit: 'hari',
    conditionEn: 'ground tank reserve not specified',
    descriptionEn: 'The ground tank holds one day of water demand.',
    reference:
      'Praktik umum gedung: tangki bawah menampung kebutuhan satu hari bila pasokan tidak menerus',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tangki bawah menampung kebutuhan air satu hari.',
  },
  {
    id: 'PEAK_DURATION_30MIN',
    parameter: 'simultaneous_usage',
    appliesTo: ['multistorey_building_water'],
    condition: 'lama periode pemakaian puncak tidak diberikan',
    value: 30,
    unit: 'menit',
    conditionEn: 'duration of peak use not given',
    descriptionEn: 'The busiest period of water use lasts 30 minutes.',
    reference:
      'Noerbambang & Morimura, Perancangan dan Pemeliharaan Sistem Plambing: jangka waktu kebutuhan puncak ±30 menit',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Periode pemakaian air tersibuk berlangsung 30 menit.',
  },
  {
    id: 'FLOOR_HEADER_20M',
    parameter: 'route_length',
    appliesTo: ['multistorey_building_water'],
    condition: 'luas lantai tidak diketahui',
    value: 20,
    unit: 'm',
    conditionEn: 'floor area not known',
    descriptionEn: 'The header pipe on each floor is assumed to be 20 m long.',
    reference: 'Perkiraan awal panjang pipa induk lantai; bila luas diketahui dipakai √luas',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Pipa induk tiap lantai diasumsikan sepanjang 20 m.',
  },
  {
    id: 'TRANSFER_ROUTE_VERTICAL',
    parameter: 'route_length',
    appliesTo: ['multistorey_building_water'],
    condition: 'panjang jalur pipa tidak diberikan',
    value: 0,
    unit: 'm jalur datar',
    conditionEn: 'pipe route length not given',
    descriptionEn:
      'The transfer and riser lines are taken as tall as the building; horizontal runs are not counted yet.',
    reference: 'Geometri: jalur tegak = tinggi gedung; jalur datar belum diketahui',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Jalur transfer dan riser diambil setinggi gedung; jalur datar belum ikut dihitung.',
  },
];

const BY_ID: ReadonlyMap<string, AssumptionDefinition> = new Map(ASSUMPTIONS.map((a) => [a.id, a]));

export function assumption(id: string): AssumptionDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`asumsi tidak terdaftar: ${id}`);
  return found;
}

export function assumptionDescription(id: string, locale: EngineeringLocale): string {
  const a = assumption(id);
  return locale === 'en' ? a.descriptionEn : a.description;
}

export function assumptionCondition(id: string, locale: EngineeringLocale): string {
  const a = assumption(id);
  return locale === 'en' ? a.conditionEn : a.condition;
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
