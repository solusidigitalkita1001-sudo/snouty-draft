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
  // ── Sumur (review putaran 3, 1b) ──
  {
    id: 'WELL_WATER_DEPTH_6M',
    parameter: 'well_depth',
    appliesTo: [],
    condition: 'sumber air sumur, kedalaman muka air tidak disebut',
    value: 6,
    unit: 'm',
    conditionEn: 'well water source, water level depth not given',
    descriptionEn:
      'The well water level is taken as 6 m below the ground; the pump lift includes it.',
    reference: 'Keputusan pemilik 2026-10-13 (review putaran 3): default 6 m bila belum tahu',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Muka air sumur diambil 6 m di bawah permukaan tanah; tinggi angkat pompa ikut menghitungnya.',
  },
  {
    id: 'SURFACE_PUMP_SUCTION_7M',
    parameter: 'well_depth',
    appliesTo: [],
    condition: 'pompa sumur, batas sedot pompa permukaan',
    value: 7,
    unit: 'm',
    conditionEn: 'well pump, surface pump suction lift',
    descriptionEn:
      'A surface (suction) pump lifts water from at most about 7 m below it; deeper wells need a jet or submersible pump.',
    reference:
      'Batas teoretis ±10 m kolom air dikurangi kehilangan isap dan tekanan uap; praktik umum pompa sumur dangkal ±7–9 m',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Pompa sedot biasa hanya bisa menyedot air dari kedalaman sekitar 7 m; lebih dalam dari itu perlu pompa jet atau submersible.',
  },
  // ── Pengisian toren (review putaran 3, 5b) ──
  {
    id: 'TANK_FILL_FLOW_0_25LS',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'debit pengisian toren atap dari meteran atau pompa belum diketahui',
    value: 0.25,
    unit: 'l/s',
    conditionEn: 'roof tank fill rate from the meter or pump not known',
    descriptionEn:
      'The roof tank is taken to fill at 0.25 l/s (15 l/min, a typical house connection) to work out the pressure needed at the meter.',
    reference: 'Perkiraan sambungan rumah PDAM ±15 l/menit; perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Toren atap diisi dengan debit 0,25 l/s (15 l/menit, sambungan rumah biasa) untuk menghitung tekanan yang dibutuhkan di meteran.',
  },
  // ── Sisa potong pipa (review laporan 0015, P19-04) ──
  {
    id: 'PIPE_CUTTING_ALLOWANCE_10PCT',
    parameter: 'route_length',
    appliesTo: [],
    condition: 'jumlah batang dari panjang bersih jalur; potongan di lapangan',
    value: 10,
    unit: '%',
    conditionEn: 'rod count from the net run length; on-site offcuts',
    descriptionEn:
      'A 10% cutting allowance is added to each net pipe length before rounding up to whole rods.',
    reference:
      'Keputusan pemilik 2026-10-13 (review laporan 0015): default 10%, bisa diubah per kasus',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Sisa potong 10% ditambahkan ke tiap panjang bersih pipa sebelum dibulatkan ke batang utuh.',
  },
  // ── Fitting rumah (P18-01): jumlah per jalur dari kebiasaan pemasangan, bukan dari denah ──
  {
    id: 'FITTING_MAIN_ELBOWS_2',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'elbow di pipa utama air bersih; denah belum ada',
    value: 2,
    unit: 'pcs',
    conditionEn: 'elbows on the clean-water main; no floor plan yet',
    descriptionEn:
      'The clean-water main is estimated to need 2 elbows (out of the source and into the riser).',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Pipa utama air bersih diperkirakan memakai 2 elbow (keluar dari sumber dan belok ke pipa tegak).',
  },
  {
    id: 'FITTING_TANK_FILL_ELBOWS_2',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'elbow di pipa pengisi toren atap',
    value: 2,
    unit: 'pcs',
    conditionEn: 'elbows on the roof-tank fill pipe',
    descriptionEn:
      'The tank fill pipe is estimated to need 2 elbows (up the wall and into the tank).',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Pipa pengisi toren diperkirakan memakai 2 elbow (naik di dinding dan masuk ke toren).',
  },
  {
    id: 'FITTING_BRANCH_ELBOW_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'elbow per cabang air bersih',
    value: 1,
    unit: 'pcs',
    conditionEn: 'elbows per clean-water branch',
    descriptionEn: 'Each clean-water branch is estimated to need 1 elbow at its end.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tiap cabang air bersih diperkirakan memakai 1 elbow di ujungnya.',
  },
  {
    id: 'FITTING_OUTLET_ELBOW_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'elbow per titik air',
    value: 1,
    unit: 'pcs',
    conditionEn: 'elbows per outlet',
    descriptionEn: 'Each outlet is estimated to need 1 elbow on the pipe down to the fixture.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tiap titik air diperkirakan memakai 1 elbow pada pipa turun ke alat.',
  },
  {
    id: 'FITTING_OUTLET_FAUCET_ELBOW_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'faucet elbow (drat kran) per titik air',
    value: 1,
    unit: 'pcs',
    conditionEn: 'faucet elbows (threaded outlet) per outlet',
    descriptionEn: 'Each outlet is estimated to need 1 faucet elbow for the tap thread.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tiap titik air diperkirakan memakai 1 faucet elbow untuk drat kran.',
  },
  {
    id: 'FITTING_DRAIN_Y_PER_FIXTURE_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'Y-branch per alat yang dibuang',
    value: 1,
    unit: 'pcs',
    conditionEn: 'Y-branches per drained fixture',
    descriptionEn:
      'Each drained fixture (toilet, shower, basin, kitchen) is estimated to join its line through 1 Y-branch.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap alat yang dibuang (kloset, shower, wastafel, dapur) diperkirakan masuk jalurnya lewat 1 Y-branch.',
  },
  {
    id: 'FITTING_STACK_Y_PER_UPPER_FLOOR_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'Y masuk pipa tegak per lantai di atas lantai dasar',
    value: 1,
    unit: 'pcs',
    conditionEn: 'Y-branches into the stack per floor above ground',
    descriptionEn: 'Each floor above ground is estimated to join the stack through 1 Y-branch.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tiap lantai di atas lantai dasar diperkirakan masuk pipa tegak lewat 1 Y-branch.',
  },
  {
    id: 'FITTING_STACK_BASE_ELBOW45_2',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'elbow 45° di kaki pipa tegak pembuangan',
    value: 2,
    unit: 'pcs',
    conditionEn: '45° elbows at the foot of a drain stack',
    descriptionEn:
      'The foot of each drain stack is estimated to need 2 × 45° elbows to turn horizontal.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Kaki tiap pipa tegak pembuangan diperkirakan memakai 2 elbow 45° untuk belok menjadi mendatar.',
  },
  {
    id: 'FITTING_CLEANOUT_PER_LINE_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'clean out per jalur pembuangan',
    value: 1,
    unit: 'pcs',
    conditionEn: 'clean-outs per drain line',
    descriptionEn:
      'Each drain line is estimated to need 1 clean-out at the foot of the stack, or at the end of the line for a building with 1 floor.',
    reference:
      'Perkiraan kebiasaan pemasangan rumah (keputusan pemilik 2026-10-13, P18-01); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap jalur pembuangan diperkirakan memakai 1 clean out di kaki pipa tegak, atau di ujung jalur untuk bangunan 1 lantai.',
  },
  {
    id: 'FITTING_VENT_JOIN_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'sambungan pipa ventilasi ke jalur pembuangan',
    value: 1,
    unit: 'pcs',
    conditionEn: 'vent pipe joint to the drain line',
    descriptionEn: 'Each vent pipe is estimated to join its drain line through 1 Y-branch or tee.',
    reference:
      'Review putaran 3 (2026-10-13): sambungan ventilasi belum dihitung; perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap pipa ventilasi diperkirakan tersambung ke jalurnya lewat 1 Y-branch atau tee.',
  },
  {
    id: 'FITTING_VENT_CAP_1',
    parameter: 'installation_method',
    appliesTo: [],
    condition: 'topi di ujung atas pipa ventilasi',
    value: 1,
    unit: 'pcs',
    conditionEn: 'cap on top of the vent pipe',
    descriptionEn: 'Each vent pipe is estimated to need 1 vent cap above the roof.',
    reference:
      'Review putaran 3 (2026-10-13): topi ventilasi belum dihitung; perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tiap pipa ventilasi diperkirakan memakai 1 topi ventilasi di atas atap.',
  },
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
      'Pump efficiency of 60 % (water power to shaft power) for an indicative shaft power; motor efficiency is not included and this is not a pump selection.',
    reference:
      'Efisiensi pompa sentrifugal kecil ±50–70 % (hidraulik → poros); efisiensi motor terpisah',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Efisiensi pompa 60 % (dari daya air ke daya poros) untuk daya poros perkiraan; efisiensi motor belum termasuk dan ini bukan pemilihan pompa.',
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
      'Minimum residual pressure at the farthest point is assumed to be 1 bar (about 10 m of water column). For a pump or mains water the target is higher than for a roof tank (0.3 bar) because the pump or the network can supply it, so a pressure comfortable for a shower is used, not just the lower limit.',
    reference: 'Praktik umum tekanan minimum di kran/shower ±0,5–1 bar',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Tekanan sisa minimum di titik terjauh diasumsikan 1 bar (±10 m kolom air). Untuk pompa dan PDAM targetnya lebih tinggi daripada toren atap (0,3 bar) karena tekanannya bisa diatur dari pompa atau jaringan, jadi dipakai tekanan yang nyaman untuk shower, bukan sekadar batas bawah.',
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
    condition: 'kelas tekanan pipa HDPE belum disebut',
    value: 17,
    unit: 'SDR',
    conditionEn: 'HDPE pressure class not given',
    descriptionEn:
      'HDPE is taken as PE100 PN 10 (SDR 17); the wall thickness per size follows the Pralon PE100 standard. Another class changes the inner diameter.',
    reference:
      'Pralon PROD/STD/014 Rev. 04 (PE100, SNI 9362:2025): SDR 17 = PN 10; tebal dinding per OD dari tabelnya',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Pipa HDPE dianggap PE100 PN 10 (SDR 17); tebal dinding tiap ukuran mengikuti standar PE100 Pralon. Kelas lain mengubah diameter dalam.',
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
    // Keputusan pemilik 2026-10-19 (P25-06): tanpa intensitas hujan setempat, hitung tetap jalan
    // dengan nilai awal hujan lebat — cenderung aman (pipa tidak kekecilan), ditandai perlu validasi.
    id: 'RAINFALL_INTENSITY_150MMH',
    parameter: 'rainfall_intensity',
    appliesTo: ['stormwater'],
    condition: 'intensitas hujan setempat tidak diketahui',
    value: 150,
    unit: 'mm/jam',
    conditionEn: 'local rainfall intensity not known',
    descriptionEn:
      'Rainfall is taken as 150 mm/h (heavy rain) until the local design intensity is known; this leans towards a pipe that is not too small.',
    reference:
      'Keputusan pemilik 2026-10-19: nilai awal hujan lebat; perlu diganti intensitas rencana setempat dari tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Intensitas hujan diambil 150 mm/jam (hujan lebat) sampai intensitas rencana setempat diketahui; nilai ini cenderung membuat pipa tidak kekecilan.',
  },
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
    appliesTo: ['gravity_drainage', 'stormwater', 'culvert', 'sewerage'],
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
  // ── Air bersih rumah (Kelompok K) ──
  {
    id: 'WSFU_WATER_CLOSET_2_2',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai kloset tangki',
    value: 2.2,
    unit: 'WSFU',
    conditionEn: 'flush-tank toilet supply load',
    descriptionEn: 'Each flush-tank toilet counts as 2.2 supply units.',
    reference: 'IPC Tabel E103.3(2), pemakaian pribadi, air dingin: kloset tangki 2,2',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap kloset tangki dihitung 2,2 unit beban suplai.',
  },
  {
    id: 'WSFU_SHOWER_1',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai shower',
    value: 1,
    unit: 'WSFU',
    conditionEn: 'shower supply load',
    descriptionEn: 'Each shower counts as 1 supply unit.',
    reference: 'IPC Tabel E103.3(2), pemakaian pribadi, air dingin: shower 1,0',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap shower dihitung 1 unit beban suplai.',
  },
  {
    id: 'WSFU_LAVATORY_0_5',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai wastafel',
    value: 0.5,
    unit: 'WSFU',
    conditionEn: 'wash basin supply load',
    descriptionEn: 'Each wash basin counts as 0.5 supply units.',
    reference: 'IPC Tabel E103.3(2), pemakaian pribadi, air dingin: lavatory 0,5',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap wastafel dihitung 0,5 unit beban suplai.',
  },
  {
    id: 'WSFU_KITCHEN_SINK_1',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai bak cuci dapur',
    value: 1,
    unit: 'WSFU',
    conditionEn: 'kitchen sink supply load',
    descriptionEn: 'Each kitchen sink counts as 1 supply unit.',
    reference: 'IPC Tabel E103.3(2), pemakaian pribadi, air dingin: kitchen sink 1,0',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap bak cuci dapur dihitung 1 unit beban suplai.',
  },
  {
    id: 'HOUSE_BASINS_0',
    parameter: 'basins',
    appliesTo: [],
    condition: 'jumlah wastafel belum disebut',
    value: 0,
    unit: 'wastafel',
    conditionEn: 'number of basins not given',
    descriptionEn:
      'No wash basins are counted until the number is given; each one adds a ½" outlet.',
    reference: 'Pertanyaan wastafel tidak dijawab (review putaran 3, 3b): tidak dikarang, dicatat',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Wastafel belum dihitung sampai jumlahnya disebut; tiap wastafel menambah satu titik air ½".',
  },
  {
    id: 'HOUSE_BASINS_PER_BATHROOM_1',
    parameter: 'basins',
    appliesTo: [],
    condition: 'jumlah wastafel belum disebut (rumah)',
    value: 1,
    unit: 'wastafel per kamar mandi',
    conditionEn: 'number of basins not given (house)',
    descriptionEn:
      'Until the number is given, each bathroom is taken to have 1 wash basin; each one adds a ½" outlet.',
    reference:
      'Keputusan pemilik 2026-10-14 (review putaran 4, 6d): pertanyaannya "wastafel total", jadi 0 untuk rumah 6 kamar mandi tidak realistis',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Sampai jumlahnya disebut, tiap kamar mandi dianggap punya 1 wastafel; tiap wastafel menambah satu titik air ½".',
  },
  {
    id: 'HOUSE_KITCHEN_1',
    parameter: 'kitchens',
    appliesTo: [],
    condition: 'jumlah dapur belum disebut',
    value: 1,
    unit: 'dapur',
    conditionEn: 'number of kitchens not given',
    descriptionEn: 'The building is taken to have 1 kitchen until the number is given.',
    reference: 'Rumah tinggal lazimnya punya satu dapur',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Bangunan dianggap punya 1 dapur sampai jumlahnya disebut.',
  },
  {
    id: 'HOUSE_RUN_20M',
    parameter: 'route_length',
    appliesTo: [],
    condition: 'ukuran bangunan dan panjang jalur belum disebut',
    value: 20,
    unit: 'm',
    conditionEn: 'building size and run length not given',
    descriptionEn:
      'The horizontal run to the farthest outlet is taken as 20 m until the building size is given; it is used for pipe sizing only, not for the pipe quantity.',
    reference: 'Perkiraan awal; diganti panjang + lebar rumah bila ukurannya disebut',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Jalur datar ke titik air terjauh diambil 20 m sampai ukuran bangunan disebut; hanya untuk memilih ukuran pipa, bukan untuk jumlah batang.',
  },
  // ── Tempat ibadah (Kelompok L, pemilik 2026-10-12) ──
  {
    id: 'WSFU_PUBLIC_WATER_CLOSET_5',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai kloset tangki di toilet umum (tempat ibadah)',
    value: 5,
    unit: 'WSFU',
    conditionEn: 'flush-tank toilet supply load in a public restroom (place of worship)',
    descriptionEn: 'Each toilet in a public restroom counts as 5 supply units.',
    reference: 'IPC Tabel E103.3(2), pemakaian umum (public), air dingin: kloset tangki 5,0',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap kloset di toilet umum dihitung 5 unit beban suplai.',
  },
  {
    id: 'WSFU_PUBLIC_TAP_1_5',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai keran kamar mandi dan wastafel di tempat umum',
    value: 1.5,
    unit: 'WSFU',
    conditionEn: 'supply load of a bathroom tap or basin in a public building',
    descriptionEn:
      'Each bathroom tap and each basin in a public building counts as 1.5 supply units.',
    reference:
      'IPC Tabel E103.3(2), pemakaian umum (public), air dingin: lavatory 1,5; keran kamar mandi disetarakan lavatory',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Tiap keran kamar mandi dan wastafel di tempat umum dihitung 1,5 unit beban suplai.',
  },
  {
    id: 'WSFU_PUBLIC_URINAL_3',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban suplai urinoir di toilet umum',
    value: 3,
    unit: 'WSFU',
    conditionEn: 'urinal supply load in a public restroom',
    descriptionEn: 'Each urinal counts as 3 supply units.',
    reference:
      'IPC Tabel E103.3(2), pemakaian umum (public), air dingin: urinal tangki gelontor 3,0',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap urinoir dihitung 3 unit beban suplai.',
  },
  {
    id: 'DFU_URINAL_4',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban pembuangan urinoir',
    value: 4,
    unit: 'DFU',
    conditionEn: 'urinal drainage load',
    descriptionEn: 'Each urinal counts as 4 drainage units and drains with the toilets.',
    reference: 'IPC Tabel 709.1: urinal 4 DFU',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap urinoir dihitung 4 unit beban pembuangan dan dibuang bersama kloset.',
  },
  {
    id: 'WORSHIP_BATHROOM_WC_TAP',
    parameter: 'bathrooms',
    appliesTo: [],
    condition: 'isi kamar mandi tempat ibadah, sekolah, dan klinik',
    value: 'kloset + keran',
    conditionEn: 'fixtures in a place of worship, school or clinic bathroom',
    descriptionEn:
      'Each bathroom has a toilet and a tap, without a shower; its water drains through a floor drain.',
    reference:
      'Keputusan pemilik 2026-10-12: kamar mandi masjid berisi kloset dan keran; sekolah dan klinik memakai toilet umum yang sama',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Tiap kamar mandi berisi kloset dan keran, tanpa shower; airnya dibuang lewat floor drain.',
  },
  {
    id: 'WUDHU_TAP_FLOW_0_1LS',
    parameter: 'simultaneous_usage',
    appliesTo: [],
    condition: 'debit keran wudhu menjelang salat',
    value: 0.1,
    unit: 'l/s per keran',
    conditionEn: 'ablution tap flow before prayer',
    descriptionEn:
      'Each ablution tap draws 0.1 liters/second and all taps run at the same time before prayer.',
    reference:
      'Keputusan pemilik 2026-10-12 (OQ-61): 0,1 l/s per keran wudhu, semua serentak; perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap keran wudhu mengalirkan 0,1 liter/detik dan semua keran dipakai bersamaan menjelang salat.',
  },
  {
    id: 'WUDHU_ONE_AREA',
    parameter: 'number_of_outlets',
    appliesTo: [],
    condition: 'jumlah tempat wudhu belum disebut',
    value: 1,
    unit: 'deret',
    conditionEn: 'number of ablution areas not given',
    descriptionEn:
      'All ablution taps are taken to stand in one row with one drain until the number of ablution areas is given.',
    reference: 'Perkiraan awal (2026-10-12); diganti jumlah tempat wudhu yang disebut',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Semua keran wudhu dianggap berjejer dalam satu deret dengan satu pembuangan sampai jumlah tempat wudhunya disebut.',
  },
  {
    id: 'WUDHU_TAP_SPACING_0_8M',
    parameter: 'route_length',
    appliesTo: [],
    condition: 'jarak antar keran wudhu; denah tempat wudhu belum ada',
    value: 0.8,
    unit: 'm',
    conditionEn: 'spacing between ablution taps; no layout of the ablution area yet',
    descriptionEn:
      'Ablution taps are taken as 0.8 m apart, so each row of pipe and trough is as long as its taps × 0.8 m.',
    reference:
      'Perkiraan awal (2026-10-12): jarak lazim keran wudhu berjejer 0,6–0,8 m; perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Keran wudhu dianggap berjarak 0,8 m, jadi pipa dan talang tiap deret sepanjang jumlah kerannya × 0,8 m.',
  },
  {
    id: 'DFU_CONTINUOUS_2_PER_GPM',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'buangan beraliran terus-menerus (talang wudhu)',
    value: 2,
    unit: 'DFU per gpm',
    conditionEn: 'continuous-flow drainage (ablution trough)',
    descriptionEn:
      'The ablution trough drain counts 2 drainage units for every gallon per minute flowing into it.',
    reference: 'IPC 709.3: alat beraliran kontinu atau semi-kontinu = 2 DFU per gpm',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Talang wudhu dihitung 2 unit beban buangan untuk tiap galon per menit yang masuk.',
  },
  {
    id: 'WORSHIP_KITCHEN_0',
    parameter: 'kitchens',
    appliesTo: [],
    condition: 'tempat ibadah, sekolah, klinik; jumlah dapur belum disebut',
    value: 0,
    unit: 'dapur',
    conditionEn: 'place of worship, school or clinic; number of kitchens not given',
    descriptionEn: 'The building is taken to have no kitchen until one is mentioned.',
    reference: 'Masjid dan musala lazimnya tanpa dapur; diganti bila disebut',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Bangunan ini dianggap tanpa dapur sampai ada yang disebut.',
  },
  {
    id: 'HOUSE_FIXTURE_DROP_1_5M',
    parameter: 'route_length',
    appliesTo: [],
    condition: 'panjang pipa dari cabang ke tiap alat; denah belum ada',
    value: 1.5,
    unit: 'm',
    conditionEn: 'pipe length from the branch to each fixture; no floor plan yet',
    descriptionEn:
      'The pipe from the branch to each fixture is taken as 1.5 m per outlet until the floor plan is known.',
    reference:
      'Perkiraan awal (keputusan pemilik 2026-10-12, P16-60); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Pipa dari cabang ke tiap alat diambil 1,5 m per titik air sampai denahnya diketahui.',
  },
  {
    id: 'TANK_FILL_PIPE_3_4IN',
    parameter: 'nominal_diameter',
    appliesTo: [],
    condition: 'ukuran pipa pengisi toren atap; debit pengisian tidak diketahui',
    value: 0.75,
    unit: 'inci',
    conditionEn: 'roof tank fill pipe size; fill flow not known',
    descriptionEn:
      'The pipe filling the roof tank from the meter or pump is taken as 3/4 inch until the fill flow is known.',
    reference:
      'Perkiraan awal (2026-10-12, P16-63): ukuran lazim pipa pengisi toren rumah; perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Pipa pengisi toren dari meteran atau pompa diambil 3/4 inci sampai debit pengisiannya diketahui.',
  },
  {
    id: 'HOUSE_VENT_ABOVE_ROOF_1M',
    parameter: 'building_height',
    appliesTo: [],
    condition: 'tinggi pipa ventilasi di atas atap',
    value: 1,
    unit: 'm',
    conditionEn: 'vent pipe height above the roof',
    descriptionEn: 'Each vent pipe is taken to rise 1 m above the roof.',
    reference:
      'Perkiraan awal (keputusan pemilik 2026-10-12, P16-60); perlu validasi tim teknis Pralon',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Tiap pipa ventilasi diambil naik 1 m di atas atap.',
  },
  {
    id: 'OUTLET_HEIGHT_2M',
    parameter: 'building_height',
    appliesTo: [],
    condition: 'tinggi titik air tertinggi di atas lantai',
    value: 2,
    unit: 'm',
    conditionEn: 'height of the highest outlet above its floor',
    descriptionEn: 'The highest outlet (shower head) is taken as 2 m above its floor.',
    reference: 'Tinggi kepala shower lazim ±2 m dari lantai',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Titik air tertinggi (kepala shower) diambil 2 m di atas lantainya.',
  },
  {
    id: 'TANK_STAND_1M',
    parameter: 'tank_elevation',
    appliesTo: [],
    condition: 'tinggi dudukan toren atap tidak disebut',
    value: 1,
    unit: 'm',
    conditionEn: 'roof tank stand height not given',
    descriptionEn: 'The roof tank water level is taken as 1 m above the roof.',
    reference: 'Perkiraan dudukan toren di atas pelat atap',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Muka air toren atap diambil 1 m di atas atap.',
  },
  {
    id: 'RESIDUAL_GRAVITY_0_3BAR',
    parameter: 'required_pressure',
    appliesTo: [],
    condition: 'tekanan minimum di titik air tertinggi dari toren atap',
    value: 0.3,
    unit: 'bar',
    conditionEn: 'minimum pressure at the highest outlet fed from a roof tank',
    descriptionEn:
      'The highest outlet fed from the roof tank needs at least 0.3 bar; below that a booster pump or a higher tank is suggested. The threshold is lower than for a pump or mains water (1 bar) because the tank relies on height alone: 0.3 bar still serves ordinary taps and showers, whereas 1 bar would need the tank 10 m above the shower.',
    reference: 'Noerbambang & Morimura: tekanan minimum alat plambing biasa ±0,3 kg/cm²',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Titik air tertinggi dari toren atap butuh minimal 0,3 bar; di bawah itu disarankan pompa pendorong atau toren dinaikkan. Ambangnya lebih rendah daripada pompa dan PDAM (1 bar) karena toren hanya mengandalkan beda tinggi: 0,3 bar masih cukup untuk keran dan shower biasa, sedangkan menuntut 1 bar berarti toren 10 m di atas shower.',
  },
  {
    id: 'RESIDUAL_GRAVITY_COMFORT_0_7BAR',
    parameter: 'required_pressure',
    appliesTo: [],
    condition: 'tekanan yang terasa deras di shower dari toren atap, tanpa pompa',
    value: 0.7,
    unit: 'bar',
    conditionEn: 'pressure that feels strong at a shower fed from a roof tank, without a pump',
    descriptionEn:
      'A shower feels strong from about 0.7 bar (7 m of water above the shower head). The tank stand options (ENG-711) mark which support reaches it without a booster pump; 0.3 bar remains the minimum for taps to work.',
    reference: 'Noerbambang & Morimura: tekanan minimum shower 0,7 kg/cm²',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Shower terasa deras mulai sekitar 0,7 bar (muka air 7 m di atas kepala shower). Pilihan dudukan toren (ENG-711) menandai dudukan mana yang mencapainya tanpa pompa pendorong; 0,3 bar tetap batas minimum supaya keran mengalir.',
  },
  // ── Pembuangan rumah (Kelompok J) ──
  {
    id: 'DFU_WATER_CLOSET_4',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban pembuangan kloset',
    value: 4,
    unit: 'DFU',
    conditionEn: 'toilet drainage load',
    descriptionEn: 'Each toilet counts as 4 drainage units.',
    reference: 'IPC Tabel 709.1 (kloset tangki gravitasi 1,6 gpf: 4 DFU)',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap kloset dihitung 4 unit beban pembuangan.',
  },
  {
    id: 'DFU_SHOWER_2',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban pembuangan shower/floor drain kamar mandi',
    value: 2,
    unit: 'DFU',
    conditionEn: 'shower/bathroom floor drain drainage load',
    descriptionEn: 'Each bathroom shower or floor drain counts as 2 drainage units.',
    reference: 'IPC Tabel 709.1 (shower: 2 DFU)',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap shower atau floor drain kamar mandi dihitung 2 unit beban pembuangan.',
  },
  {
    id: 'DFU_LAVATORY_1',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban pembuangan wastafel',
    value: 1,
    unit: 'DFU',
    conditionEn: 'wash basin drainage load',
    descriptionEn: 'Each wash basin counts as 1 drainage unit.',
    reference: 'IPC Tabel 709.1 (lavatory: 1 DFU)',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap wastafel dihitung 1 unit beban pembuangan.',
  },
  {
    id: 'DFU_KITCHEN_SINK_2',
    parameter: 'design_flow',
    appliesTo: [],
    condition: 'beban pembuangan bak cuci dapur',
    value: 2,
    unit: 'DFU',
    conditionEn: 'kitchen sink drainage load',
    descriptionEn: 'Each kitchen sink counts as 2 drainage units.',
    reference: 'IPC Tabel 709.1 (kitchen sink, domestic: 2 DFU)',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Tiap bak cuci dapur dihitung 2 unit beban pembuangan.',
  },
  {
    id: 'SOIL_LINE_MIN_4IN',
    parameter: 'nominal_diameter',
    appliesTo: [],
    condition: 'ukuran minimum jalur kloset ke septic tank',
    value: 4,
    unit: 'inci',
    conditionEn: 'minimum size of the toilet line to the septic tank',
    descriptionEn:
      'The toilet line to the septic tank is at least 4 inches, as is usual in Indonesian houses (the IPC minimum is 3 inches).',
    reference: 'Praktik umum rumah di Indonesia: pipa kloset 4"; IPC 710.1 minimum 3" untuk kloset',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Jalur kloset ke septic tank minimal 4 inci, seperti lazimnya di Indonesia (minimum IPC 3 inci).',
  },
  {
    id: 'GRAVITY_SLOPE_MIN_0_5',
    parameter: 'slope',
    appliesTo: ['gravity_drainage', 'stormwater', 'sewerage'],
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
  // ── Jaringan air minum (SPAM) dan air limbah (P22-05, OQ-70) ──
  {
    id: 'SPAM_DEMAND_LPCD_100',
    parameter: 'design_flow',
    appliesTo: ['water_supply_network', 'sewerage'],
    condition: 'kebutuhan air per jiwa untuk jaringan air minum tidak diberikan',
    value: 100,
    unit: 'l/orang/hari',
    conditionEn: 'per-capita water demand for a drinking-water network not given',
    descriptionEn:
      'Domestic demand of 100 litres per person per day — the usual planning figure for small towns and villages served by a piped network.',
    reference:
      'Kriteria perencanaan SPAM (Permen PUPR 27/2016): domestik 60–150 l/orang/hari menurut kategori kota',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Kebutuhan domestik 100 liter per jiwa per hari — angka perencanaan lazim untuk kota kecil dan perdesaan yang dilayani jaringan perpipaan.',
  },
  {
    id: 'SPAM_PERSONS_PER_CONNECTION_5',
    parameter: 'number_of_units',
    appliesTo: ['water_supply_network', 'sewerage'],
    condition: 'jiwa per sambungan rumah tidak diberikan',
    value: 5,
    unit: 'jiwa/sambungan',
    conditionEn: 'persons per house connection not given',
    descriptionEn: 'One house connection (SR) serves 5 people.',
    reference: 'Kriteria perencanaan SPAM: 1 sambungan rumah ≈ 5 jiwa',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Satu sambungan rumah (SR) melayani 5 jiwa.',
  },
  {
    id: 'SPAM_PEAK_HOUR_FACTOR_1_75',
    parameter: 'design_flow',
    appliesTo: ['water_supply_network'],
    condition: 'faktor jam puncak jaringan air minum tidak diberikan',
    value: 1.75,
    unit: '×',
    conditionEn: 'peak-hour factor for a drinking-water network not given',
    descriptionEn:
      'Distribution pipes are sized for the peak hour: 1.75 × the average day (planning range 1.5–1.75).',
    reference: 'Kriteria perencanaan SPAM: faktor jam puncak 1,5–1,75 × kebutuhan rata-rata',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Pipa distribusi dihitung untuk jam puncak: 1,75 × kebutuhan rata-rata harian (rentang perencanaan 1,5–1,75).',
  },
  {
    id: 'SEWER_RETURN_FACTOR_0_8',
    parameter: 'design_flow',
    appliesTo: ['sewerage'],
    condition: 'bagian pemakaian air yang menjadi air limbah tidak diberikan',
    value: 0.8,
    unit: '×',
    conditionEn: 'share of water use returned as wastewater not given',
    descriptionEn: 'About 80 % of the water used returns as domestic wastewater.',
    reference: 'Kriteria perencanaan SPALD-T: air limbah domestik ±80 % pemakaian air bersih',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Sekitar 80 % air yang dipakai kembali sebagai air limbah domestik.',
  },
  {
    id: 'SEWER_PEAK_FACTOR_2_5',
    parameter: 'design_flow',
    appliesTo: ['sewerage'],
    condition: 'faktor puncak air limbah tidak diberikan',
    value: 2.5,
    unit: '×',
    conditionEn: 'wastewater peak factor not given',
    descriptionEn:
      'Sewer pipes are sized for the peak flow: 2.5 × the average for small networks; larger networks peak less.',
    reference: 'Kriteria perencanaan SPALD-T: faktor puncak 2–3 untuk jaringan kecil',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Pipa air limbah dihitung pada debit puncak: 2,5 × rata-rata untuk jaringan kecil; jaringan besar puncaknya lebih rendah.',
  },
  {
    id: 'SPAM_NON_DOMESTIC_15PCT',
    parameter: 'design_flow',
    appliesTo: ['water_supply_network'],
    condition: 'kebutuhan non-domestik jaringan air minum tidak diberikan',
    value: 15,
    unit: '%',
    conditionEn: 'non-domestic demand of a drinking-water network not given',
    descriptionEn:
      'Non-domestic demand (schools, mosques, public hydrants, small businesses) at 15 % of domestic.',
    reference:
      'Kriteria perencanaan SPAM: non-domestik 15–30 % dari domestik menurut kategori kota',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Kebutuhan non-domestik (sekolah, masjid, hidran umum, usaha kecil) 15 % dari domestik.',
  },
  {
    id: 'SPAM_NRW_20PCT',
    parameter: 'design_flow',
    appliesTo: ['water_supply_network'],
    condition: 'kehilangan air (NRW) jaringan air minum tidak diberikan',
    value: 20,
    unit: '%',
    conditionEn: 'non-revenue water of a drinking-water network not given',
    descriptionEn:
      'Non-revenue water (leakage) at 20 % of production — the planning figure for a new network.',
    reference: 'Kriteria perencanaan SPAM: kebocoran 20 % untuk sistem baru',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Kehilangan air (kebocoran, NRW) 20 % dari produksi — angka perencanaan jaringan baru.',
  },
  {
    id: 'SPAM_DAY_PEAK_1_15',
    parameter: 'design_flow',
    appliesTo: ['water_supply_network'],
    condition: 'faktor hari maksimum tidak diberikan',
    value: 1.15,
    unit: '×',
    conditionEn: 'maximum-day factor not given',
    descriptionEn:
      'Maximum-day demand at 1.15 × average — the basis for the transmission pipe and the reservoir.',
    reference: 'Kriteria perencanaan SPAM: faktor hari maksimum 1,1–1,2',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kebutuhan hari maksimum 1,15 × rata-rata — dasar pipa transmisi dan reservoir.',
  },
  {
    id: 'SPAM_RESERVOIR_20PCT',
    parameter: 'design_flow',
    appliesTo: ['water_supply_network'],
    condition: 'volume reservoir distribusi tidak diberikan',
    value: 20,
    unit: '%',
    conditionEn: 'distribution reservoir volume not given',
    descriptionEn: 'Distribution reservoir at 20 % of maximum-day demand, balancing the peak hour.',
    reference: 'Kriteria perencanaan SPAM: reservoir 15–20 % kebutuhan hari maksimum',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Reservoir distribusi 20 % dari kebutuhan hari maksimum, penyeimbang jam puncak.',
  },
  {
    id: 'PRESSURE_CLASS_MARGIN_10PCT',
    parameter: 'pressure_class',
    appliesTo: ['water_supply_network'],
    condition: 'margin kelas tekanan di atas tekanan kerja maksimum tidak diberikan',
    value: 10,
    unit: '%',
    conditionEn: 'pressure-class margin above the maximum working pressure not given',
    descriptionEn:
      'The pipe pressure class is chosen 10 % above the maximum working pressure (static or pump head) for surge and test pressure.',
    reference: 'Praktik umum: PN ≥ tekanan kerja + margin surja',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Kelas tekanan pipa dipilih 10 % di atas tekanan kerja maksimum (statis atau head pompa) untuk surja dan tekanan uji.',
  },
  {
    id: 'SEWER_INFILTRATION_10PCT',
    parameter: 'design_flow',
    appliesTo: ['sewerage'],
    condition: 'infiltrasi ke pipa air limbah tidak diberikan',
    value: 10,
    unit: '%',
    conditionEn: 'infiltration into the sewer not given',
    descriptionEn:
      'Groundwater and rainwater infiltration into the pipe at 10 % of the average flow.',
    reference:
      'Kriteria perencanaan SPALD-T: infiltrasi 10–20 % untuk pipa plastik bersambungan rapat',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Infiltrasi air tanah dan air hujan ke pipa 10 % dari debit rata-rata.',
  },
  {
    id: 'SEWER_VELOCITY_MAX_3MS',
    parameter: 'design_velocity',
    appliesTo: ['sewerage'],
    condition: 'kecepatan maksimum air limbah tidak diberikan',
    value: 3,
    unit: 'm/s',
    conditionEn: 'maximum sewer velocity not given',
    descriptionEn: 'Maximum velocity 3 m/s so solids do not scour the pipe.',
    reference: 'Kriteria perencanaan SPALD-T: v ≤ 3 m/s',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Kecepatan maksimum 3 m/s supaya pipa tidak tergerus padatan.',
  },
  {
    id: 'SEWER_MANHOLE_SPACING_50M',
    parameter: 'route_length',
    appliesTo: ['sewerage'],
    condition: 'jarak antar manhole tidak diberikan',
    value: 50,
    unit: 'm',
    conditionEn: 'manhole spacing not given',
    descriptionEn: 'A manhole every 50 m on pipes ≤ 300 mm, plus at every bend and junction.',
    reference: 'Kriteria perencanaan SPALD-T: jarak manhole 50–75 m untuk pipa kecil',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Manhole tiap 50 m pada pipa ≤ 300 mm, ditambah di tiap belokan dan pertemuan.',
  },
  {
    id: 'SEWER_START_DEPTH_1M',
    parameter: 'burial_depth',
    appliesTo: ['sewerage'],
    condition: 'kedalaman dasar pipa di awal jalur tidak diberikan',
    value: 1,
    unit: 'm',
    conditionEn: 'invert depth at the start of the run not given',
    descriptionEn:
      'Pipe invert 1 m below ground at the start of the run (minimum cover under roads).',
    reference: 'Kriteria perencanaan SPALD-T: timbunan minimum ±1 m di bawah jalan',
    confidence: 'medium',
    confirmationRequired: true,
    description: 'Dasar pipa di awal jalur 1 m di bawah tanah (timbunan minimum di bawah jalan).',
  },
  {
    id: 'SEWER_MAX_DEPTH_4M',
    parameter: 'burial_depth',
    appliesTo: ['sewerage'],
    condition: 'kedalaman galian maksimum tidak diberikan',
    value: 4,
    unit: 'm',
    conditionEn: 'maximum trench depth not given',
    descriptionEn: 'Trenches deeper than 4 m are impractical: split the run or add a lift station.',
    reference: 'Praktik umum SPALD-T: kedalaman galian praktis 3–4 m',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Galian lebih dalam dari 4 m tidak praktis: jalur dipecah atau dipasang stasiun pompa angkat.',
  },
  {
    id: 'SPAM_BRANCH_LENGTH_RATIO_50PCT',
    parameter: 'route_length',
    appliesTo: ['water_supply_network'],
    condition: 'panjang pipa cabang tidak diberikan',
    value: 50,
    unit: '%',
    conditionEn: 'branch pipe length not given',
    descriptionEn:
      'Each branch is taken as 50 % of the trunk length — a stand-in until the branch length is given.',
    reference: 'Asumsi tata letak; bukan kriteria',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap cabang dianggap sepanjang 50 % pipa induk — pengganti sampai panjang cabang disebut.',
  },
  {
    id: 'WAVE_SPEED_PE_300MS',
    parameter: 'pressure_class',
    appliesTo: ['water_supply_network'],
    condition: 'laju gelombang tekanan pipa PE tidak diberikan',
    value: 300,
    unit: 'm/s',
    conditionEn: 'pressure-wave speed in PE pipe not given',
    descriptionEn: 'Surge wave speed in PE pipe about 300 m/s (Joukowsky Δh = a·v/g).',
    reference: 'Rentang lazim PE100: 250–350 m/s',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Laju gelombang surja di pipa PE ±300 m/s (Joukowsky Δh = a·v/g).',
  },
  {
    id: 'WAVE_SPEED_PVC_400MS',
    parameter: 'pressure_class',
    appliesTo: ['water_supply_network'],
    condition: 'laju gelombang tekanan pipa PVC tidak diberikan',
    value: 400,
    unit: 'm/s',
    conditionEn: 'pressure-wave speed in PVC pipe not given',
    descriptionEn: 'Surge wave speed in PVC pipe about 400 m/s (Joukowsky Δh = a·v/g).',
    reference: 'Rentang lazim uPVC: 350–450 m/s',
    confidence: 'low',
    confirmationRequired: true,
    description: 'Laju gelombang surja di pipa PVC ±400 m/s (Joukowsky Δh = a·v/g).',
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
    id: 'PUMP_CYCLE_10MIN',
    parameter: 'design_flow',
    appliesTo: ['multistorey_building_water'],
    condition: 'lama kerja pompa pengisi tangki atap per siklus tidak diberikan',
    value: 10,
    unit: 'menit',
    conditionEn: 'run time per cycle of the roof-tank filling pump not given',
    descriptionEn:
      'The roof tank also holds 10 minutes of pump flow so the filling pump does not start and stop too often.',
    reference:
      'Noerbambang & Morimura: VE = (Qp − Qmax) · Tp + Qpu · Tpu; Tpu jangka waktu kerja pompa pengisi',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tangki atap juga menampung 10 menit aliran pompa supaya pompa pengisi tidak terlalu sering hidup-mati.',
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

  // ── Renovasi (P23-01, pemilik 2026-10-19; OQ-71) ──
  {
    id: 'RENOV_COUPLINGS_PER_SEGMENT_2',
    parameter: 'replacement_length',
    appliesTo: [],
    condition: 'penggantian sebagian: segmen disambung kembali ke pipa lama',
    value: 2,
    unit: 'sok',
    conditionEn: 'partial replacement: the segment is rejoined to the existing pipe',
    descriptionEn:
      'A replaced segment is rejoined to the existing pipe with one coupling at each end (2 per segment).',
    reference: 'Praktik lapangan: satu sok di tiap ujung potongan',
    confidence: 'medium',
    confirmationRequired: true,
    description:
      'Segmen yang diganti disambung kembali ke pipa lama dengan satu sok di tiap ujung (2 per segmen).',
  },
  {
    id: 'RENOV_ADDED_OUTLET_1_WSFU',
    parameter: 'existing_outlets',
    appliesTo: ['residential_clean_water'],
    condition: 'perluasan rumah: titik air tambahan disebut jumlahnya, bukan jenisnya',
    value: 1,
    unit: 'WSFU per titik',
    conditionEn: 'house extension: the added outlets are given as a count, not by type',
    descriptionEn:
      'Each added water point counts as 1 WSFU (a basin) when checking the existing main pipe against the total load.',
    reference: 'Rata-rata beban titik air rumah (IPC E103.3(2): wastafel 0,5 – kloset 2,2)',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap titik air tambahan dihitung 1 WSFU (setara wastafel) saat pipa utama lama dicek terhadap beban total.',
  },
  {
    id: 'RENOV_EXISTING_OUTLET_1_WSFU',
    parameter: 'existing_outlets',
    appliesTo: ['residential_clean_water'],
    condition: 'perluasan rumah: titik air lama disebut jumlahnya, bukan jenisnya',
    value: 1,
    unit: 'WSFU per titik',
    conditionEn: 'house extension: the existing outlets are given as a count, not by type',
    descriptionEn:
      'Each existing water point counts as 1 WSFU (a basin) when checking the existing main pipe against the total load.',
    reference: 'Rata-rata beban titik air rumah (IPC E103.3(2): wastafel 0,5 – kloset 2,2)',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tiap titik air lama dihitung 1 WSFU (setara wastafel) saat pipa utama lama dicek terhadap beban total.',
  },
  {
    id: 'RENOV_REPLACE_WHOLE_ROUTE',
    parameter: 'replacement_length',
    appliesTo: [],
    condition: 'penggantian sebagian tanpa panjang yang diganti disebut',
    value: 100,
    unit: '% jalur',
    conditionEn: 'partial replacement without the replaced length given',
    descriptionEn:
      'Without the replaced length, the whole run is counted as replaced — a stand-in until the length is given.',
    reference: 'Tanpa panjang segmen tidak ada dasar untuk menghitung sebagian',
    confidence: 'low',
    confirmationRequired: true,
    description:
      'Tanpa panjang yang diganti, seluruh jalur dihitung diganti — sementara, sampai panjangnya disebut.',
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

/** Nilai asumsi yang diganti pengguna ("Perbaiki asumsi ini"), per ID registry. */
export type AssumptionOverrides = Readonly<Record<string, number>>;

/**
 * Pembaca asumsi untuk satu perhitungan: nilai dari pengguna menang atas nilai baku registry, dan
 * hanya nilai baku yang dicatat sebagai asumsi — nilai dari pengguna bukan lagi tebakan.
 */
export function assumptionReader(overrides: AssumptionOverrides = {}): {
  readonly use: (id: string) => number;
  readonly applied: string[];
} {
  const applied: string[] = [];
  const use = (id: string): number => {
    const own = overrides[id];
    if (own !== undefined) return own;
    applied.push(id);
    return assumption(id).value as number;
  };
  return { use, applied };
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
