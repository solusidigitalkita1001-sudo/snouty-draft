/**
 * Baris "KEBUTUHAN ANDA" di panel kanan — dari `RequirementState`, label dan nilai
 * polos seperti prototipe. Setiap baris juga membawa cara mengeditnya (mode "Ubah"):
 * pilihan untuk field enum, angka untuk hitungan. Kosakatanya sama dengan skema
 * ekstraksi dan `PATCH /requirement`; UI tidak menambah pilihan sendiri.
 */

import type { Provenance, RequirementFieldPath, RequirementState } from '@snouty/shared-types';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export type RowEditor =
  | { readonly kind: 'select'; readonly options: readonly SelectOption[] }
  | { readonly kind: 'number'; readonly min: number; readonly max: number };

export interface RequirementRow {
  readonly path: RequirementFieldPath;
  readonly label: string;
  readonly display: string;
  /** Nilai mentah untuk input edit; `null` = belum diisi. */
  readonly raw: string | number | null;
  readonly provenance: Provenance;
  /** Alasan asumsi, bila ada — muncul sebagai judul bantuan. */
  readonly reason?: string;
  readonly editor: RowEditor;
}

export const MISSING = 'Belum diisi';

const SOURCE: readonly SelectOption[] = [
  { value: 'rooftop_tank', label: 'Toren atap' },
  { value: 'ground_tank', label: 'Toren bawah' },
  { value: 'pump', label: 'Pompa' },
  { value: 'municipal', label: 'PDAM' },
];

const INSTALLATION: readonly SelectOption[] = [
  { value: 'clean_water', label: 'Air bersih' },
  { value: 'drainage', label: 'Pembuangan' },
  { value: 'both', label: 'Keduanya' },
];

const BUILDING: readonly SelectOption[] = [
  { value: 'residential', label: 'Rumah tinggal' },
  { value: 'boarding_house', label: 'Rumah kos' },
  { value: 'light_commercial', label: 'Komersial ringan' },
  { value: 'industrial', label: 'Industri' },
];

/** Ukuran rumah: pilihan sama dengan kartu pertanyaan; nilai "PxL" dikirim sebagai panjang × lebar. */
const PLAN: readonly SelectOption[] = [
  { value: '6x12', label: '6 × 12 m' },
  { value: '8x15', label: '8 × 15 m' },
  { value: '10x20', label: '10 × 20 m' },
];

interface PlanValue {
  readonly lengthM?: number;
  readonly widthM?: number;
  readonly areaM2?: number;
  readonly mainRunMeters?: number;
}

/** "8x15" → panjang × lebar untuk PATCH; selain itu `null`. */
export function planFromOption(value: string): { lengthM: number; widthM: number } | null {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(value);
  return m ? { lengthM: Number(m[1]), widthM: Number(m[2]) } : null;
}

function planRow(field: {
  value: unknown;
  provenance: Provenance;
  reason?: string;
}): RequirementRow {
  const plan = field.value as PlanValue | null;
  const sides = plan?.lengthM !== undefined && plan.widthM !== undefined;
  const display = sides
    ? `${plan!.lengthM} × ${plan!.widthM} m`
    : plan?.areaM2 !== undefined
      ? `luas ${plan.areaM2} m²`
      : plan?.mainRunMeters !== undefined
        ? `jalur ${plan.mainRunMeters} m`
        : MISSING;
  return {
    path: 'building.dimensions',
    label: 'Ukuran rumah',
    display,
    raw: sides ? `${plan!.lengthM}x${plan!.widthM}` : null,
    provenance: field.provenance,
    ...(field.reason !== undefined ? { reason: field.reason } : {}),
    editor: { kind: 'select', options: PLAN },
  };
}

const labelOf = (options: readonly SelectOption[]) => (v: unknown) =>
  options.find((o) => o.value === String(v))?.label ?? String(v);

export function requirementRows(state: RequirementState): readonly RequirementRow[] {
  return [
    row('building.type', 'Tipe bangunan', state.building.type, labelOf(BUILDING), {
      kind: 'select',
      options: BUILDING,
    }),
    row('building.floors', 'Jumlah lantai', state.building.floors, String, {
      kind: 'number',
      min: 1,
      max: 50,
    }),
    planRow(state.building.dimensions),
    row('fixtures.bathrooms', 'Kamar mandi', state.fixtures.bathrooms, String, {
      kind: 'number',
      min: 0,
      max: 200,
    }),
    row('fixtures.basins', 'Wastafel', state.fixtures.basins, String, {
      kind: 'number',
      min: 0,
      max: 200,
    }),
    row('fixtures.kitchens', 'Dapur', state.fixtures.kitchens, String, {
      kind: 'number',
      min: 0,
      max: 100,
    }),
    row('water.source', 'Sumber air', state.water.source, labelOf(SOURCE), {
      kind: 'select',
      options: SOURCE,
    }),
    row(
      'water.installationType',
      'Jenis instalasi',
      state.water.installationType,
      labelOf(INSTALLATION),
      { kind: 'select', options: INSTALLATION },
    ),
  ];
}

function row(
  path: RequirementFieldPath,
  label: string,
  field: { value: unknown; provenance: Provenance; reason?: string },
  format: (value: unknown) => string,
  editor: RowEditor,
): RequirementRow {
  // UNAVAILABLE tidak pernah merender nilai — ketiadaan ditampilkan apa adanya.
  const missing = field.value === null || field.value === undefined;
  return {
    path,
    label,
    display: missing ? MISSING : format(field.value),
    raw: missing ? null : (field.value as string | number),
    provenance: field.provenance,
    ...(field.reason !== undefined ? { reason: field.reason } : {}),
    editor,
  };
}
