/**
 * Label manusiawi untuk field dan nilai kebutuhan — untuk kartu yang menampilkan "kebutuhan
 * yang sudah terkumpul" (validasi teknis, cakupan belum didukung). Kartu itu pernah memuat
 * `water.installationType: drainage` apa adanya; path dan enum adalah bahasa kode, bukan
 * bahasa pengguna. Redaksinya sama dengan laporan (`report-assembler.ts`) dan panel kanan.
 */
import type { RequirementFieldPath } from '@snouty/shared-types';

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

export function requirementValueLabel(path: RequirementFieldPath, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'number') {
    if (path === 'building.floors') return `${value} lantai`;
    if (path === 'building.floorHeightM') return `${value} m`;
    if (path.startsWith('fixtures.')) return `${value} titik`;
    return String(value);
  }
  if (typeof value === 'object' && value !== null && 'mainRunMeters' in value) {
    return `${String((value as { mainRunMeters: unknown }).mainRunMeters)} m`;
  }
  return VALUE_LABEL[String(value)] ?? String(value);
}
