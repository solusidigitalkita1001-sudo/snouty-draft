/**
 * Registry parameter teknik universal (brief asisten teknik umum §3–§4, fase 1).
 *
 * Satu kosakata untuk semua kasus — rumah, gedung bertingkat, cluster, irigasi, transfer pompa,
 * gravitasi/drainase, air hujan, gorong-gorong, sumur. Profil kasus (fase 2) memilih SUBSET yang
 * aktif; registry ini hanya mendefinisikan apa artinya sebuah parameter: satuan, bentuk nilai,
 * dan — yang paling penting untuk percakapan — **redaksi pertanyaannya dalam bahasa pengguna**
 * (bukan "Masukkan static head", melainkan "Sumber air kira-kira berapa meter lebih rendah…").
 *
 * Tidak ada nilai di sini. Nilai hidup di state (dengan sumber dan provenance), asumsi hidup di
 * `assumptions.ts`, dan rumus hidup di kalkulator.
 */

import { PARAMETER_ENGLISH } from './registry-en.js';
import type { EngineeringLocale } from './locale.js';

export type ParameterDomain =
  | 'project'
  | 'site'
  | 'fluid'
  | 'source'
  | 'destination'
  | 'hydraulic'
  | 'pipe'
  | 'network'
  | 'pump'
  | 'gravity'
  | 'stormwater'
  | 'structural'
  | 'operation';

export type ParameterKind = 'number' | 'enum' | 'boolean' | 'text';

/** Seberapa menentukan sebuah parameter secara umum; profil kasus boleh menimpanya. */
export type ParameterImportance = 'critical' | 'important' | 'optional';

export interface ParameterDefinition {
  readonly key: ParameterKey;
  readonly domain: ParameterDomain;
  readonly kind: ParameterKind;
  readonly label: string;
  /** Satuan nilai (`m`, `l/s`, `ha`, …); kosong untuk enum/boolean/teks. */
  readonly unit?: string;
  /** Pilihan untuk `enum` — label yang dilihat pengguna adalah nilainya (bahasa pengguna). */
  readonly options?: readonly string[];
  /**
   * Pilihan cepat untuk parameter angka ("kasih gw pilihan", pemilik 2026-10-09) — nilai yang
   * bisa ditekan, bukan batas; pengguna tetap boleh mengetik angka lain atau "Belum tahu".
   */
  readonly suggestions?: readonly string[];
  readonly importance: ParameterImportance;
  /** Pertanyaan dalam bahasa pengguna, siap ditampilkan apa adanya. */
  readonly question: string;
  /** Mengapa parameter ini dibutuhkan — untuk metadata dan penjelasan ke pengguna. */
  readonly reason: string;
  /** Terjemahan Inggris — wajib; `registry-en.ts` memastikan tidak ada parameter yang terlewat. */
  readonly labelEn: string;
  readonly questionEn: string;
  readonly reasonEn: string;
  /** Sejajar dengan `options` (yang tetap nilai protokol berbahasa Indonesia). */
  readonly optionLabelsEn?: readonly string[];
}

type ParameterBase = Omit<
  ParameterDefinition,
  'labelEn' | 'questionEn' | 'reasonEn' | 'optionLabelsEn'
>;

export type ParameterKey =
  // project
  | 'project_type'
  | 'building_type'
  | 'building_floors'
  | 'building_height'
  | 'number_of_units'
  | 'total_area'
  // pond / tank
  | 'pond_length'
  | 'pond_width'
  | 'pond_depth'
  | 'number_of_ponds'
  | 'fill_time_hours'
  // site / geometry
  | 'route_length'
  | 'field_length'
  | 'field_width'
  | 'field_shape'
  | 'terrain'
  | 'terrain_slope'
  | 'road_width'
  | 'installation_location'
  // fluid
  | 'fluid_type'
  | 'fluid_temperature'
  // source
  | 'source_type'
  | 'source_elevation'
  | 'source_pressure'
  | 'source_flow_capacity'
  | 'well_depth'
  // destination
  | 'destination_type'
  | 'destination_elevation'
  | 'required_pressure'
  | 'tank_elevation'
  // hydraulic
  | 'design_flow'
  | 'static_head'
  | 'allowable_head_loss'
  | 'design_velocity'
  // pipe
  | 'material'
  | 'nominal_diameter'
  | 'pressure_class'
  | 'installation_method'
  // network
  | 'bathrooms'
  | 'basins'
  | 'kitchens'
  | 'number_of_outlets'
  | 'number_of_connections'
  | 'number_of_occupants'
  | 'bathrooms_per_floor'
  | 'basins_per_floor'
  | 'floor_area'
  | 'simultaneous_usage'
  | 'number_of_branches'
  // pump
  | 'pump_required'
  | 'pump_power'
  | 'operating_hours'
  // gravity / drainage
  | 'slope'
  | 'upstream_level'
  | 'downstream_level'
  | 'pipe_fill_ratio'
  // stormwater
  | 'catchment_area'
  | 'rainfall_intensity'
  | 'runoff_coefficient'
  | 'return_period'
  | 'outfall_condition'
  // structural
  | 'burial_depth'
  | 'traffic_load'
  | 'soil_type'
  | 'movement_risk'
  | 'exposed_to_sun'
  // irrigation (fluid use)
  | 'irrigation_method'
  | 'crop_type';

const P = (
  key: ParameterKey,
  domain: ParameterDomain,
  kind: ParameterKind,
  label: string,
  importance: ParameterImportance,
  question: string,
  reason: string,
  extra: { unit?: string; options?: readonly string[]; suggestions?: readonly string[] } = {},
): ParameterBase => ({ key, domain, kind, label, importance, question, reason, ...extra });

const BASE_PARAMETERS: readonly ParameterBase[] = [
  // ── project ──
  P(
    'project_type',
    'project',
    'enum',
    'Jenis proyek',
    'critical',
    'Proyeknya untuk apa?',
    'Menentukan profil kasus dan parameter yang relevan.',
    {
      options: [
        'Rumah tinggal',
        'Gedung bertingkat',
        'Cluster perumahan',
        'Irigasi',
        'Drainase / air hujan',
        'Gorong-gorong',
        'Transfer pompa',
        'Lainnya',
      ],
    },
  ),
  P(
    'building_type',
    'project',
    'enum',
    'Tipe bangunan',
    'important',
    'Bangunannya apa?',
    'Beban pemakaian dan kebijakan cakupan.',
    {
      options: ['Rumah tinggal', 'Rumah kos', 'Komersial ringan', 'Industri'],
    },
  ),
  P(
    'building_floors',
    'project',
    'number',
    'Jumlah lantai',
    'critical',
    'Bangunannya berapa lantai?',
    'Tinggi statis dan riser.',
    { unit: 'lantai' },
  ),
  P(
    'building_height',
    'project',
    'number',
    'Tinggi bangunan',
    'important',
    'Tinggi bangunannya kira-kira berapa meter?',
    'Tekanan statis di lantai atas/bawah; zonasi tekanan.',
    { unit: 'm' },
  ),
  P(
    'number_of_units',
    'project',
    'number',
    'Jumlah unit',
    'critical',
    'Ada berapa unit/rumah yang dilayani?',
    'Kebutuhan puncak jaringan.',
    { unit: 'unit' },
  ),
  P(
    'total_area',
    'project',
    'number',
    'Luas lahan',
    'critical',
    'Luas lahannya kira-kira berapa?',
    'Kebutuhan air dan panjang distribusi.',
    { unit: 'ha' },
  ),

  // ── pond / tank (kolam, tambak, bak) ──
  P(
    'pond_length',
    'project',
    'number',
    'Panjang kolam',
    'critical',
    'Kolamnya berapa meter panjangnya?',
    'Volume air yang diisi dan dibuang.',
    { unit: 'm' },
  ),
  P(
    'pond_width',
    'project',
    'number',
    'Lebar kolam',
    'critical',
    'Lebarnya berapa meter?',
    'Volume air yang diisi dan dibuang.',
    { unit: 'm' },
  ),
  P(
    'pond_depth',
    'project',
    'number',
    'Kedalaman air',
    'critical',
    'Tinggi airnya kira-kira berapa meter?',
    'Volume air; diameter pipa pembuangan.',
    { unit: 'm' },
  ),
  P(
    'number_of_ponds',
    'project',
    'number',
    'Jumlah kolam',
    'important',
    'Ada berapa kolam?',
    'Total debit dan jumlah cabang.',
    { unit: 'kolam' },
  ),
  P(
    'fill_time_hours',
    'operation',
    'number',
    'Lama pengisian',
    'important',
    'Kolam mau terisi penuh dalam berapa jam?',
    'Debit pengisian → diameter pipa masuk.',
    { unit: 'jam' },
  ),

  // ── site / geometry ──
  P(
    'route_length',
    'site',
    'number',
    'Panjang jalur',
    'critical',
    'Jarak dari sumber air ke titik tujuan kira-kira berapa meter?',
    'Kerugian gesek dan kuantitas pipa.',
    { unit: 'm' },
  ),
  P(
    'field_length',
    'site',
    'number',
    'Panjang lahan',
    'important',
    'Lahannya memanjang berapa meter?',
    'Tata letak header dan lateral.',
    { unit: 'm' },
  ),
  P(
    'field_width',
    'site',
    'number',
    'Lebar lahan',
    'important',
    'Lebarnya berapa meter?',
    'Tata letak header dan lateral.',
    { unit: 'm' },
  ),
  P(
    'field_shape',
    'site',
    'enum',
    'Bentuk lahan',
    'optional',
    'Bentuk lahannya kira-kira seperti apa?',
    'Panjang distribusi dan jumlah cabang.',
    {
      options: ['Bujur sangkar', 'Memanjang', 'Tidak beraturan'],
    },
  ),
  P(
    'terrain',
    'site',
    'enum',
    'Kontur',
    'important',
    'Kontur lahannya datar, miring, atau bergelombang?',
    'Beda tinggi sepanjang jalur dan zonasi tekanan.',
    {
      options: ['Datar', 'Miring', 'Bergelombang'],
    },
  ),
  P(
    'terrain_slope',
    'site',
    'number',
    'Kemiringan',
    'important',
    'Kemiringannya kira-kira berapa persen?',
    'Aliran gravitasi dan tekanan statis.',
    { unit: '%' },
  ),
  P(
    'road_width',
    'site',
    'number',
    'Lebar jalan',
    'critical',
    'Lebar jalan yang dilintasi berapa meter?',
    'Panjang gorong-gorong dan beban lalu lintas.',
    { unit: 'm' },
  ),
  P(
    'installation_location',
    'site',
    'enum',
    'Letak pemasangan',
    'important',
    'Pipanya dipasang di mana — di dalam bangunan, di luar, atau ditanam?',
    'Pemilihan bahan dan kelas; beban luar.',
    {
      options: ['Di dalam bangunan', 'Di luar, terbuka', 'Ditanam'],
    },
  ),

  // ── fluid ──
  P(
    'fluid_type',
    'fluid',
    'enum',
    'Jenis cairan',
    'critical',
    'Yang dialirkan air bersih, air hujan, limbah, atau air irigasi?',
    'Metode perhitungan dan bahan yang sah.',
    {
      options: ['Air bersih', 'Air hujan', 'Air limbah', 'Air irigasi', 'Cairan proses'],
    },
  ),
  P(
    'fluid_temperature',
    'fluid',
    'number',
    'Suhu cairan',
    'optional',
    'Suhunya berapa derajat?',
    'Batas bahan (PVC tidak untuk air panas).',
    { unit: '°C' },
  ),

  // ── source ──
  P(
    'source_type',
    'source',
    'enum',
    'Sumber air',
    'critical',
    'Sumber airnya dari mana?',
    'Tekanan tersedia dan kebutuhan pompa.',
    {
      options: [
        'PDAM',
        'Sungai / saluran',
        'Sumur',
        'Embung / kolam',
        'Toren atap',
        'Toren bawah',
        'Reservoir',
        'Jaringan hulu',
      ],
    },
  ),
  P(
    'source_elevation',
    'source',
    'number',
    'Posisi sumber',
    'critical',
    'Sumber air kira-kira berapa meter lebih rendah atau lebih tinggi dari titik tujuan?',
    'Tinggi statis — penentu pompa dan tekanan.',
    { unit: 'm' },
  ),
  P(
    'source_pressure',
    'source',
    'number',
    'Tekanan sumber',
    'important',
    'Tekanan dari sumbernya kira-kira berapa (bar), kalau tahu?',
    'Tekanan tersedia di hulu.',
    { unit: 'bar' },
  ),
  P(
    'source_flow_capacity',
    'source',
    'number',
    'Kapasitas sumber',
    'important',
    'Sumbernya bisa memasok berapa liter per detik?',
    'Batas debit rencana.',
    { unit: 'l/s' },
  ),
  P(
    'well_depth',
    'source',
    'number',
    'Kedalaman sumur',
    'critical',
    'Sumurnya kira-kira berapa meter dalamnya?',
    'Hisap dan head pompa.',
    { unit: 'm' },
  ),

  // ── destination ──
  P(
    'destination_type',
    'destination',
    'enum',
    'Tujuan',
    'important',
    'Airnya dialirkan ke mana?',
    'Tekanan yang dibutuhkan di ujung.',
    {
      options: ['Fixture di bangunan', 'Toren', 'Lahan', 'Reservoir', 'Saluran', 'Jaringan hilir'],
    },
  ),
  P(
    'destination_elevation',
    'destination',
    'number',
    'Posisi tujuan',
    'important',
    'Titik tujuannya berapa meter lebih tinggi dari sumber?',
    'Tinggi statis.',
    { unit: 'm' },
  ),
  P(
    'required_pressure',
    'destination',
    'number',
    'Tekanan yang dibutuhkan',
    'important',
    'Di ujung butuh tekanan berapa (bar), kalau ada ketentuannya?',
    'Tekanan sisa di titik terjauh.',
    { unit: 'bar', suggestions: ['1 bar', '1,5 bar', '2 bar'] },
  ),
  P(
    'tank_elevation',
    'destination',
    'number',
    'Tinggi toren',
    'critical',
    'Torennya di ketinggian berapa meter (atau di lantai berapa)?',
    'Head pompa pengisian dan tekanan gravitasi.',
    { unit: 'm' },
  ),

  // ── hydraulic ──
  P(
    'design_flow',
    'hydraulic',
    'number',
    'Debit rencana',
    'critical',
    'Kebutuhan airnya kira-kira berapa, atau sistemnya dipakai untuk berapa titik?',
    'Dasar seluruh sizing.',
    { unit: 'l/s' },
  ),
  P(
    'static_head',
    'hydraulic',
    'number',
    'Tinggi statis',
    'critical',
    'Beda tinggi antara sumber dan tujuan berapa meter?',
    'Head pompa dan tekanan.',
    { unit: 'm' },
  ),
  P(
    'allowable_head_loss',
    'hydraulic',
    'number',
    'Kerugian head yang diizinkan',
    'optional',
    'Ada batas kehilangan tekanan yang diinginkan?',
    'Kriteria pemilihan diameter.',
    { unit: 'm' },
  ),
  P(
    'design_velocity',
    'hydraulic',
    'number',
    'Kecepatan rencana',
    'optional',
    'Ada batas kecepatan aliran yang dipakai?',
    'Kriteria pemilihan diameter.',
    { unit: 'm/s' },
  ),

  // ── pipe ──
  P(
    'material',
    'pipe',
    'enum',
    'Bahan pipa',
    'important',
    'Ada preferensi bahan pipa?',
    'Kekasaran, kelas tekanan, cara pasang.',
    {
      options: ['PVC (uPVC)', 'HDPE', 'PPR', 'Galvanis', 'Belum ada preferensi'],
    },
  ),
  P(
    'nominal_diameter',
    'pipe',
    'text',
    'Diameter nominal',
    'optional',
    'Pipanya ukuran berapa (kalau sudah ada)?',
    'Validasi teknis pipa yang ada.',
  ),
  P(
    'pressure_class',
    'pipe',
    'enum',
    'Kelas tekanan',
    'optional',
    'Kelas pipanya apa (kalau sudah ada)?',
    'Batas tekanan kerja.',
    { options: ['AW', 'D', 'PN 6', 'PN 8', 'PN 10', 'PN 12,5', 'PN 16'] },
  ),
  P(
    'installation_method',
    'pipe',
    'enum',
    'Cara pasang',
    'optional',
    'Pipanya ditanam, digantung, atau ditempel dinding?',
    'Beban luar dan sambungan.',
    {
      options: ['Ditanam', 'Digantung', 'Menempel dinding', 'Di atas tanah'],
    },
  ),

  // ── network ──
  P(
    'bathrooms',
    'network',
    'number',
    'Kamar mandi',
    'critical',
    'Ada berapa kamar mandi?',
    'Unit beban fixture.',
    { unit: 'titik' },
  ),
  P(
    'basins',
    'network',
    'number',
    'Wastafel',
    'important',
    'Ada berapa wastafel?',
    'Unit beban fixture.',
    { unit: 'titik' },
  ),
  P(
    'kitchens',
    'network',
    'number',
    'Dapur',
    'important',
    'Ada berapa dapur?',
    'Unit beban fixture.',
    { unit: 'titik' },
  ),
  P(
    'number_of_outlets',
    'network',
    'number',
    'Jumlah titik air',
    'important',
    'Totalnya ada berapa titik air?',
    'Debit rencana dan cabang.',
    { unit: 'titik' },
  ),
  P(
    'number_of_connections',
    'network',
    'number',
    'Jumlah sambungan',
    'critical',
    'Ada berapa sambungan rumah/unit?',
    'Kebutuhan puncak jaringan.',
    { unit: 'sambungan' },
  ),
  P(
    'number_of_occupants',
    'network',
    'number',
    'Jumlah penghuni',
    'critical',
    'Kira-kira berapa orang yang memakai gedungnya setiap hari (penghuni, karyawan, tamu)?',
    'Kebutuhan air harian dan debit puncak gedung.',
    { unit: 'orang', suggestions: ['100 orang', '300 orang', '500 orang', '1000 orang'] },
  ),
  P(
    'floor_area',
    'project',
    'number',
    'Luas per lantai',
    'important',
    'Luas tiap lantainya kira-kira berapa meter persegi?',
    'Perkiraan jumlah penghuni bila belum diketahui.',
    { unit: 'm²', suggestions: ['500 m²', '1000 m²', '2000 m²', '3000 m²'] },
  ),
  P(
    'bathrooms_per_floor',
    'network',
    'number',
    'Kamar mandi/toilet per lantai',
    'important',
    'Tiap lantai ada berapa kamar mandi atau toilet?',
    'Titik air dan pipa cabang tiap lantai.',
    { unit: 'titik', suggestions: ['2', '4', '6', '8', '12'] },
  ),
  P(
    'basins_per_floor',
    'network',
    'number',
    'Wastafel per lantai',
    'important',
    'Wastafelnya per lantai ada berapa?',
    'Titik air dan pipa cabang tiap lantai.',
    { unit: 'titik', suggestions: ['2', '4', '6', '8', '12'] },
  ),
  P(
    'simultaneous_usage',
    'network',
    'enum',
    'Pemakaian serentak',
    'important',
    'Pemakaiannya cenderung bersamaan (pagi/sore) atau tersebar?',
    'Faktor serentak untuk debit puncak.',
    {
      options: ['Bersamaan', 'Tersebar', 'Tidak tahu'],
    },
  ),
  P(
    'number_of_branches',
    'network',
    'number',
    'Jumlah cabang',
    'optional',
    'Jalurnya bercabang berapa?',
    'Tata letak dan fitting.',
    { unit: 'cabang' },
  ),

  // ── pump ──
  P(
    'pump_required',
    'pump',
    'boolean',
    'Pompa',
    'important',
    'Pakai pompa?',
    'Jalur bertekanan vs gravitasi.',
  ),
  P(
    'pump_power',
    'pump',
    'number',
    'Daya pompa',
    'optional',
    'Pompanya berapa HP/watt (kalau sudah ada)?',
    'Validasi titik kerja pompa yang ada.',
    { unit: 'HP' },
  ),
  P(
    'operating_hours',
    'pump',
    'number',
    'Jam operasi',
    'optional',
    'Dipakai berapa jam sehari?',
    'Debit rencana dari kebutuhan harian.',
    { unit: 'jam/hari' },
  ),

  // ── gravity / drainage ──
  P(
    'slope',
    'gravity',
    'number',
    'Kemiringan saluran',
    'critical',
    'Kemiringan salurannya kira-kira berapa persen, atau beda tinggi hulu–hilirnya berapa?',
    'Kapasitas aliran gravitasi (Manning).',
    { unit: '%' },
  ),
  P(
    'upstream_level',
    'gravity',
    'number',
    'Elevasi hulu',
    'important',
    'Elevasi di sisi masuk berapa meter?',
    'Kemiringan dan inlet.',
    { unit: 'm' },
  ),
  P(
    'downstream_level',
    'gravity',
    'number',
    'Elevasi hilir',
    'important',
    'Elevasi di sisi keluar berapa meter?',
    'Kemiringan dan outlet.',
    { unit: 'm' },
  ),
  P(
    'pipe_fill_ratio',
    'gravity',
    'number',
    'Rasio pengisian',
    'optional',
    'Ada ketentuan rasio pengisian pipa?',
    'Kriteria kapasitas gravitasi.',
    { unit: '%' },
  ),

  // ── stormwater ──
  P(
    'catchment_area',
    'stormwater',
    'number',
    'Luas tangkapan',
    'critical',
    'Luas area yang airnya masuk ke saluran ini berapa?',
    'Debit hujan rencana (Q = C·I·A).',
    { unit: 'ha' },
  ),
  P(
    'rainfall_intensity',
    'stormwater',
    'number',
    'Intensitas hujan',
    'critical',
    'Ada data intensitas hujan rencana di lokasi (mm/jam)?',
    'Debit hujan rencana — tidak boleh dikarang.',
    { unit: 'mm/jam' },
  ),
  P(
    'runoff_coefficient',
    'stormwater',
    'number',
    'Koefisien limpasan',
    'important',
    'Permukaannya dominan beton/aspal, atau masih banyak tanah/taman?',
    'Koefisien C.',
    { unit: '-' },
  ),
  P(
    'return_period',
    'stormwater',
    'number',
    'Periode ulang',
    'optional',
    'Dirancang untuk hujan periode ulang berapa tahun?',
    'Pemilihan intensitas.',
    { unit: 'tahun' },
  ),
  P(
    'outfall_condition',
    'stormwater',
    'enum',
    'Kondisi buangan',
    'important',
    'Air dibuang ke mana — saluran kota, sungai, atau resapan?',
    'Elevasi outlet dan backwater.',
    {
      options: ['Saluran kota', 'Sungai', 'Resapan', 'Belum ada'],
    },
  ),

  // ── structural ──
  P(
    'burial_depth',
    'structural',
    'number',
    'Kedalaman tanam',
    'important',
    'Pipanya ditanam sedalam berapa?',
    'Beban tanah dan lalu lintas.',
    { unit: 'm' },
  ),
  P(
    'traffic_load',
    'structural',
    'enum',
    'Beban lalu lintas',
    'critical',
    'Jalannya dilewati kendaraan apa — motor, mobil, atau truk?',
    'Kelas kekakuan pipa.',
    {
      options: ['Pejalan kaki / motor', 'Mobil', 'Truk / berat'],
    },
  ),
  P(
    'soil_type',
    'structural',
    'enum',
    'Jenis tanah',
    'optional',
    'Tanahnya keras, lempung, atau berpasir?',
    'Alas pipa dan risiko pergerakan.',
    {
      options: ['Keras', 'Lempung', 'Berpasir', 'Gambut / lunak'],
    },
  ),
  P(
    'movement_risk',
    'structural',
    'boolean',
    'Tanah bergerak',
    'optional',
    'Tanahnya sering bergerak/ambles?',
    'Pemilihan bahan lentur.',
  ),
  P(
    'exposed_to_sun',
    'structural',
    'boolean',
    'Terpapar matahari',
    'optional',
    'Pipanya terkena sinar matahari langsung?',
    'Ketahanan UV bahan.',
  ),

  // ── irrigation ──
  P(
    'irrigation_method',
    'fluid',
    'enum',
    'Jenis irigasi',
    'critical',
    'Jenis irigasinya?',
    'Debit satuan dan kebutuhan tekanan.',
    {
      options: ['Genangan / gravitasi', 'Sprinkler', 'Tetes'],
    },
  ),
  P(
    'crop_type',
    'fluid',
    'enum',
    'Tanaman',
    'optional',
    'Tanamannya apa?',
    'Kebutuhan air tanaman.',
    {
      options: ['Padi', 'Palawija', 'Sayur', 'Buah / perkebunan'],
    },
  ),
];

export const PARAMETERS: readonly ParameterDefinition[] = BASE_PARAMETERS.map((base) => ({
  ...base,
  ...PARAMETER_ENGLISH[base.key],
}));

const BY_KEY: ReadonlyMap<ParameterKey, ParameterDefinition> = new Map(
  PARAMETERS.map((p) => [p.key, p]),
);

export function parameterDefinition(key: ParameterKey): ParameterDefinition {
  const definition = BY_KEY.get(key);
  if (!definition) throw new Error(`parameter tidak terdaftar: ${key}`);
  return definition;
}

export function isParameterKey(key: string): key is ParameterKey {
  return BY_KEY.has(key as ParameterKey);
}

export function parameterLabel(key: ParameterKey, locale: EngineeringLocale): string {
  const d = parameterDefinition(key);
  return locale === 'en' ? d.labelEn : d.label;
}

export function parameterQuestion(key: ParameterKey, locale: EngineeringLocale): string {
  const d = parameterDefinition(key);
  return locale === 'en' ? d.questionEn : d.question;
}

export function parameterReason(key: ParameterKey, locale: EngineeringLocale): string {
  const d = parameterDefinition(key);
  return locale === 'en' ? d.reasonEn : d.reason;
}

/** Label pilihan enum; `options` sendiri tetap nilai protokol (Indonesia). */
export function parameterOptionLabels(
  key: ParameterKey,
  locale: EngineeringLocale,
): readonly string[] | undefined {
  const d = parameterDefinition(key);
  return locale === 'en' ? (d.optionLabelsEn ?? d.options) : d.options;
}
