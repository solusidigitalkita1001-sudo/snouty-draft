/**
 * Pembacaan dan penulisan `TrackedValue` lewat `RequirementFieldPath`.
 *
 * `RequirementState` berbentuk bersarang (`building.floors`), tetapi merge,
 * klarifikasi, dan kelengkapan semuanya bekerja atas daftar **jalur datar**.
 * Berkas ini satu-satunya tempat yang menerjemahkan antara keduanya, supaya tidak
 * ada `switch` panjang yang sama disalin di tiga tempat dan menyimpang.
 */

import type { RequirementFieldPath, RequirementState, TrackedValue } from '@snouty/shared-types';

type MutableState = {
  building: Record<string, TrackedValue<unknown>>;
  fixtures: Record<string, TrackedValue<unknown>>;
  water: Record<string, TrackedValue<unknown>>;
};

/** Memisah `"building.floors"` → `["building", "floors"]`, diketik sempit. */
function split(path: RequirementFieldPath): [keyof MutableState, string] {
  const dot = path.indexOf('.');
  return [path.slice(0, dot) as keyof MutableState, path.slice(dot + 1)];
}

export function readField(
  state: RequirementState,
  path: RequirementFieldPath,
): TrackedValue<unknown> {
  const [group, key] = split(path);
  return (state as unknown as MutableState)[group][key]!;
}

/** Mengembalikan state BARU dengan satu field diganti — tidak memutasi masukan. */
export function writeField(
  state: RequirementState,
  path: RequirementFieldPath,
  value: TrackedValue<unknown>,
): RequirementState {
  const [group, key] = split(path);
  const groupValue = { ...(state as unknown as MutableState)[group], [key]: value };
  return { ...state, [group]: groupValue };
}

export const ALL_FIELD_PATHS: readonly RequirementFieldPath[] = [
  'building.type',
  'building.floors',
  'building.floorHeightM',
  'building.dimensions',
  'fixtures.bathrooms',
  'fixtures.basins',
  'fixtures.kitchens',
  'fixtures.outletCount',
  'water.source',
  'water.installationType',
  'water.boosterPump',
];

/** Field yang nilainya belum ada — dipakai kelengkapan dan klarifikasi. */
export function isFilled(value: TrackedValue<unknown>): boolean {
  return value.value !== null;
}

/** Semua field sebagai pasangan `[path, TrackedValue]` — untuk kartu asumsi. */
export function fieldEntries(
  state: RequirementState,
): ReadonlyArray<readonly [RequirementFieldPath, TrackedValue<unknown>]> {
  return ALL_FIELD_PATHS.map((path) => [path, readField(state, path)] as const);
}
