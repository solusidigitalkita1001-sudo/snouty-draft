/**
 * Label manusiawi untuk field dan nilai kebutuhan — untuk kartu yang menampilkan "kebutuhan
 * yang sudah terkumpul" (validasi teknis, cakupan belum didukung). Kartu itu pernah memuat
 * `water.installationType: drainage` apa adanya; path dan enum adalah bahasa kode, bukan
 * bahasa pengguna. Redaksinya sama dengan laporan (`report-assembler.ts`) dan panel kanan.
 */
import {
  type BuildingType,
  DEFAULT_LOCALE,
  type Dimensions,
  type Locale,
  type RequirementFieldPath,
} from '@snouty/shared-types';

export const FIELD_LABEL: Readonly<Record<RequirementFieldPath, string>> = {
  'building.type': 'Tipe bangunan',
  'building.floors': 'Jumlah lantai',
  'building.floorHeightM': 'Tinggi antar lantai',
  'building.dimensions': 'Ukuran bangunan / tanah',
  'fixtures.bathrooms': 'Kamar mandi',
  'fixtures.basins': 'Wastafel',
  'fixtures.kitchens': 'Dapur',
  'fixtures.outletCount': 'Titik air',
  'fixtures.wudhuTaps': 'Keran wudhu',
  'fixtures.wudhuAreas': 'Tempat wudhu',
  'fixtures.urinals': 'Urinoir',
  'water.source': 'Sumber air',
  'water.installationType': 'Jenis instalasi',
  'water.boosterPump': 'Pompa pendorong',
  'water.wellDepthM': 'Kedalaman muka air sumur',
  'water.replaceExisting': 'Pekerjaan',
  'water.workType': 'Jenis pekerjaan',
  'water.existingMainSize': 'Ukuran pipa lama',
  'water.existingPipeMaterial': 'Bahan pipa lama',
  'water.existingOutlets': 'Titik air yang sudah ada',
  'water.addedOutlets': 'Titik air tambahan',
  'water.replacementLengthM': 'Panjang yang diganti',
};

export const FIELD_LABEL_EN: Readonly<Record<RequirementFieldPath, string>> = {
  'building.type': 'Building type',
  'building.floors': 'Number of floors',
  'building.floorHeightM': 'Floor-to-floor height',
  'building.dimensions': 'Building / land size',
  'fixtures.bathrooms': 'Bathrooms',
  'fixtures.basins': 'Basins',
  'fixtures.kitchens': 'Kitchens',
  'fixtures.outletCount': 'Water outlets',
  'fixtures.wudhuTaps': 'Ablution taps',
  'fixtures.wudhuAreas': 'Ablution areas',
  'fixtures.urinals': 'Urinals',
  'water.source': 'Water source',
  'water.installationType': 'Installation type',
  'water.boosterPump': 'Booster pump',
  'water.wellDepthM': 'Well water level depth',
  'water.replaceExisting': 'Work',
  'water.workType': 'Type of work',
  'water.existingMainSize': 'Existing pipe size',
  'water.existingPipeMaterial': 'Existing pipe material',
  'water.existingOutlets': 'Existing water points',
  'water.addedOutlets': 'Added water points',
  'water.replacementLengthM': 'Length replaced',
};

/** Label field menurut bahasa percakapan. */
export function requirementFieldLabel(
  path: RequirementFieldPath,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return (locale === 'en' ? FIELD_LABEL_EN : FIELD_LABEL)[path];
}

const VALUE_LABEL: Readonly<Record<string, string>> = {
  residential: 'Rumah tinggal',
  boarding_house: 'Rumah kos',
  light_commercial: 'Komersial ringan',
  industrial: 'Industri',
  place_of_worship: 'Tempat ibadah',
  public_building: 'Sekolah / klinik',
  rooftop_tank: 'Toren atap',
  ground_tank: 'Toren bawah',
  pump: 'Pompa',
  municipal: 'PDAM',
  clean_water: 'Air bersih',
  drainage: 'Pembuangan',
  both: 'Air bersih + pembuangan',
  // Jenis pekerjaan (P23-03) dan bahan pipa lama.
  new: 'Instalasi baru',
  replace_all: 'Ganti semua pipa',
  replace_partial: 'Ganti sebagian',
  extend: 'Perluasan',
  renovation: 'Renovasi (jenisnya belum disebut)',
  pvc: 'PVC',
  galvanized: 'Galvanis / besi',
  hdpe: 'HDPE',
  ppr: 'PPR',
};

const VALUE_LABEL_EN: Readonly<Record<string, string>> = {
  residential: 'Residential',
  boarding_house: 'Boarding house',
  light_commercial: 'Light commercial',
  industrial: 'Industrial',
  place_of_worship: 'Place of worship',
  public_building: 'School / clinic',
  rooftop_tank: 'Rooftop tank',
  ground_tank: 'Ground tank',
  pump: 'Pump',
  municipal: 'Municipal water (PDAM)',
  clean_water: 'Clean water',
  drainage: 'Drainage',
  both: 'Clean water + drainage',
  new: 'New installation',
  replace_all: 'Replace all pipes',
  replace_partial: 'Partial replacement',
  extend: 'Extension',
  renovation: 'Renovation (type not given yet)',
  pvc: 'PVC',
  galvanized: 'Galvanized / steel',
  hdpe: 'HDPE',
  ppr: 'PPR',
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Bangunan dengan toilet umum: kamar mandinya berisi kloset dan keran, bukan shower. Dipakai
 * laporan, kartu serah terima, dan antrean tim teknis supaya ketiganya menyebut alat yang sama.
 */
export function hasPublicToilets(type: BuildingType | null): boolean {
  return type === 'place_of_worship' || type === 'public_building';
}

export function requirementValueLabel(
  path: RequirementFieldPath,
  value: unknown,
  locale: Locale = DEFAULT_LOCALE,
  /** Toilet umum (tempat ibadah, sekolah): kamar mandi = kloset + keran, bukan shower + kloset. */
  context: { readonly bathroomHasTap?: boolean } = {},
): string {
  const en = locale === 'en';
  if (path === 'water.replaceExisting' && typeof value === 'boolean') {
    return en
      ? value
        ? 'Replace the existing pipes'
        : 'New installation'
      : value
        ? 'Ganti pipa lama'
        : 'Instalasi baru';
  }
  if (typeof value === 'boolean') return en ? (value ? 'Yes' : 'No') : value ? 'Ya' : 'Tidak';
  if (typeof value === 'number') {
    if (path === 'building.floors')
      return en ? plural(value, 'floor', 'floors') : `${value} lantai`;
    if (
      path === 'building.floorHeightM' ||
      path === 'water.wellDepthM' ||
      path === 'water.replacementLengthM'
    )
      return `${value} m`;
    if (path === 'water.existingOutlets' || path === 'water.addedOutlets')
      return en ? plural(value, 'point', 'points') : `${value} titik`;
    // Kamar mandi adalah ruang berisi dua titik air (review laporan 0015: "2 titik" untuk 2 kamar mandi
    // salah baca — sebenarnya 4 titik).
    if (path === 'fixtures.bathrooms') {
      const pair = context.bathroomHasTap
        ? en
          ? 'toilet + tap'
          : 'kloset + keran'
        : en
          ? 'shower + toilet'
          : 'shower + kloset';
      return en
        ? `${plural(value, 'room', 'rooms')} (${plural(value * 2, 'outlet', 'outlets')}: ${pair})`
        : `${value} ruang (${value * 2} titik: ${pair})`;
    }
    if (path.startsWith('fixtures.'))
      return en ? plural(value, 'point', 'points') : `${value} titik`;
    return String(value);
  }
  if (typeof value === 'object' && value !== null) {
    // Ukuran bangunan, tanah, dan/atau panjang jalur: "bangunan 8 × 15 m · tanah 10 × 20 m".
    const d = value as Dimensions;
    const n = (x: number) => x.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
    const parts: string[] = [];
    if (d.lengthM !== undefined && d.widthM !== undefined)
      parts.push(`${en ? 'building' : 'bangunan'} ${n(d.lengthM)} × ${n(d.widthM)} m`);
    else if (d.areaM2 !== undefined)
      parts.push(en ? `floor area ${n(d.areaM2)} m²` : `luas bangunan ${n(d.areaM2)} m²`);
    if (d.landLengthM !== undefined && d.landWidthM !== undefined)
      parts.push(`${en ? 'land' : 'tanah'} ${n(d.landLengthM)} × ${n(d.landWidthM)} m`);
    else if (d.landAreaM2 !== undefined)
      parts.push(en ? `land area ${n(d.landAreaM2)} m²` : `luas tanah ${n(d.landAreaM2)} m²`);
    if (d.mainRunMeters !== undefined)
      parts.push(en ? `run ${n(d.mainRunMeters)} m` : `jalur ${n(d.mainRunMeters)} m`);
    if (parts.length > 0) return parts.join(' · ');
  }
  return (en ? VALUE_LABEL_EN : VALUE_LABEL)[String(value)] ?? String(value);
}
