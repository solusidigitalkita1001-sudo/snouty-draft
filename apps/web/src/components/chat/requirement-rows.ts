/**
 * Menerjemahkan `RequirementState` ke baris panel kanan (layar 02).
 *
 * Label dan urutan dari desain. Provenance menentukan nada nilai, dan `UNAVAILABLE`
 * TIDAK merender nilai — ia menampilkan "Belum diisi", bukan angka tebakan
 * (docs/DESIGN_IMPLEMENTATION.md §6).
 */

import type { Provenance, RequirementState } from '@snouty/shared-types';

export interface RequirementRow {
  readonly label: string;
  readonly display: string;
  readonly provenance: Provenance;
  /** Alasan asumsi, bila ada — muncul sebagai judul bantuan. */
  readonly reason?: string;
}

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  rooftop_tank: 'Toren atap',
  ground_tank: 'Toren bawah',
  pump: 'Pompa',
  municipal: 'PDAM',
};

const INSTALLATION_LABEL: Readonly<Record<string, string>> = {
  clean_water: 'Air bersih',
  drainage: 'Pembuangan',
  both: 'Keduanya',
};

const BUILDING_LABEL: Readonly<Record<string, string>> = {
  residential: 'Rumah tinggal',
  boarding_house: 'Rumah kos',
  light_commercial: 'Komersial ringan',
  industrial: 'Industri',
};

export function requirementRows(state: RequirementState): readonly RequirementRow[] {
  return [
    row('Jenis bangunan', state.building.type, (v) => BUILDING_LABEL[String(v)] ?? String(v)),
    row('Jumlah lantai', state.building.floors, (v) => `${String(v)} lantai`),
    row('Kamar mandi', state.fixtures.bathrooms, (v) => `${String(v)} titik`),
    row('Wastafel', state.fixtures.basins, (v) => `${String(v)} titik`),
    row('Dapur', state.fixtures.kitchens, (v) => `${String(v)} titik`),
    row('Sumber air', state.water.source, (v) => SOURCE_LABEL[String(v)] ?? String(v)),
    row(
      'Jenis instalasi',
      state.water.installationType,
      (v) => INSTALLATION_LABEL[String(v)] ?? String(v),
    ),
  ];
}

function row(
  label: string,
  field: { value: unknown; provenance: Provenance; reason?: string },
  format: (value: unknown) => string,
): RequirementRow {
  // UNAVAILABLE tidak pernah merender nilai — ketiadaan ditampilkan apa adanya.
  const display = field.value === null ? 'Belum diisi' : format(field.value);
  return {
    label,
    display,
    provenance: field.provenance,
    ...(field.reason !== undefined ? { reason: field.reason } : {}),
  };
}
