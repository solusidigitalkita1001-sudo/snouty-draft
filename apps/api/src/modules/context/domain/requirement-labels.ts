/**
 * Label manusiawi untuk field dan nilai kebutuhan — untuk kartu yang menampilkan "kebutuhan
 * yang sudah terkumpul" (validasi teknis, cakupan belum didukung). Kartu itu pernah memuat
 * `water.installationType: drainage` apa adanya; path dan enum adalah bahasa kode, bukan
 * bahasa pengguna. Redaksinya sama dengan laporan (`report-assembler.ts`) dan panel kanan.
 */
import { DEFAULT_LOCALE, type Locale, type RequirementFieldPath } from '@snouty/shared-types';

export const FIELD_LABEL: Readonly<Record<RequirementFieldPath, string>> = {
  'building.type': 'Tipe bangunan',
  'building.floors': 'Jumlah lantai',
  'building.floorHeightM': 'Tinggi antar lantai',
  'building.dimensions': 'Panjang jalur',
  'fixtures.bathrooms': 'Kamar mandi',
  'fixtures.basins': 'Wastafel',
  'fixtures.kitchens': 'Dapur',
  'fixtures.outletCount': 'Titik air',
  'water.source': 'Sumber air',
  'water.installationType': 'Jenis instalasi',
  'water.boosterPump': 'Pompa pendorong',
};

export const FIELD_LABEL_EN: Readonly<Record<RequirementFieldPath, string>> = {
  'building.type': 'Building type',
  'building.floors': 'Number of floors',
  'building.floorHeightM': 'Floor-to-floor height',
  'building.dimensions': 'Pipe run length',
  'fixtures.bathrooms': 'Bathrooms',
  'fixtures.basins': 'Basins',
  'fixtures.kitchens': 'Kitchens',
  'fixtures.outletCount': 'Water outlets',
  'water.source': 'Water source',
  'water.installationType': 'Installation type',
  'water.boosterPump': 'Booster pump',
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
  rooftop_tank: 'Toren atap',
  ground_tank: 'Toren bawah',
  pump: 'Pompa',
  municipal: 'PDAM',
  clean_water: 'Air bersih',
  drainage: 'Pembuangan',
  both: 'Air bersih + pembuangan',
};

const VALUE_LABEL_EN: Readonly<Record<string, string>> = {
  residential: 'Residential',
  boarding_house: 'Boarding house',
  light_commercial: 'Light commercial',
  industrial: 'Industrial',
  rooftop_tank: 'Rooftop tank',
  ground_tank: 'Ground tank',
  pump: 'Pump',
  municipal: 'Municipal water (PDAM)',
  clean_water: 'Clean water',
  drainage: 'Drainage',
  both: 'Clean water + drainage',
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function requirementValueLabel(
  path: RequirementFieldPath,
  value: unknown,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const en = locale === 'en';
  if (typeof value === 'boolean') return en ? (value ? 'Yes' : 'No') : value ? 'Ya' : 'Tidak';
  if (typeof value === 'number') {
    if (path === 'building.floors')
      return en ? plural(value, 'floor', 'floors') : `${value} lantai`;
    if (path === 'building.floorHeightM') return `${value} m`;
    if (path.startsWith('fixtures.'))
      return en ? plural(value, 'point', 'points') : `${value} titik`;
    return String(value);
  }
  if (typeof value === 'object' && value !== null && 'mainRunMeters' in value) {
    return `${String((value as { mainRunMeters: unknown }).mainRunMeters)} m`;
  }
  return (en ? VALUE_LABEL_EN : VALUE_LABEL)[String(value)] ?? String(value);
}
