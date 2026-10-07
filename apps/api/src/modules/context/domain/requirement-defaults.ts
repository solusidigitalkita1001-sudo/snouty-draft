/**
 * Default "Belum tahu" dan kartu asumsi. docs/CONTEXT_ENGINE.md §5 · ENG-014.
 * **Fungsi murni, tanpa LLM.**
 *
 * Menjawab "Belum tahu" bukan jalan buntu: sistem menerapkan default, menandainya
 * `ASSUMED`, dan **selalu** memunculkannya di kartu asumsi dengan kalimat yang
 * terbaca manusia. Menerapkan default tanpa mengatakannya melanggar SPEC §5 Policy 4
 * dan — lebih buruk — membuat pengguna percaya pada angka yang sebetulnya tebakan.
 *
 * Invarian TV-1: setiap field `ASSUMED` WAJIB membawa `reason`. Di sinilah hal itu
 * dipastikan — `reason` berasal dari tabel, bukan dirangkai LLM, sehingga kalimatnya
 * stabil dan bisa diuji.
 */

import {
  DEFAULT_LOCALE,
  type FieldSource,
  type Locale,
  type RequirementFieldPath,
  type TrackedValue,
} from '@snouty/shared-types';
import type { FieldUpdate } from './context-merger.js';

export interface RequirementDefault {
  readonly path: RequirementFieldPath;
  readonly value: unknown;
  /** Kalimat yang muncul di kartu asumsi — persis, tidak diparafrase. */
  readonly reason: string;
  readonly ruleId: string;
}

/**
 * Tabel default (docs/CONTEXT_ENGINE.md §5). `dimensions` tidak punya nilai default
 * tetap — ketiadaannya menjadikan BOM `ESTIMATED`, ditangani di Engineering Engine
 * (Fase 6), bukan diisi angka di sini. Karena itu ia tidak ada di tabel ini.
 */
export const REQUIREMENT_DEFAULTS: readonly RequirementDefault[] = [
  {
    path: 'water.source',
    value: 'rooftop_tank',
    reason: 'Sumber distribusi adalah toren atap, tanpa pompa pendorong.',
    ruleId: 'ENG-014',
  },
  {
    path: 'water.installationType',
    value: 'clean_water',
    reason: 'Instalasi diasumsikan untuk air bersih saja.',
    ruleId: 'ENG-014',
  },
  {
    path: 'building.floorHeightM',
    value: 3.5,
    reason: 'Tinggi antar lantai diasumsikan 3,5 meter.',
    ruleId: 'ENG-014',
  },
];

/** Kembaran Inggris `reason` tiap default — kunci sama dengan path di `REQUIREMENT_DEFAULTS`. */
export const REQUIREMENT_DEFAULT_REASONS_EN: Readonly<
  Partial<Record<RequirementFieldPath, string>>
> = {
  'water.source': 'The distribution source is a rooftop tank, with no booster pump.',
  'water.installationType': 'The installation is assumed to be for clean water only.',
  'building.floorHeightM': 'Floor-to-floor height is assumed to be 3.5 metres.',
};

/** Kalimat alasan default menurut bahasa; Indonesia = `reason` tabel apa adanya. */
export function defaultReason(def: RequirementDefault, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? (REQUIREMENT_DEFAULT_REASONS_EN[def.path] ?? def.reason) : def.reason;
}

const BY_PATH: ReadonlyMap<RequirementFieldPath, RequirementDefault> = new Map(
  REQUIREMENT_DEFAULTS.map((d) => [d.path, d]),
);

/**
 * Update default untuk satu field — `source: 'default_applied'`, `ASSUMED`, dengan
 * `reason`. Karena `default_applied` adalah sumber terlemah, merge otomatis menolak
 * menimpa apa pun yang disebut pengguna; aman dipanggil untuk field yang mungkin
 * sudah terisi. Mengembalikan `null` bila field tidak punya default (mis.
 * `building.dimensions`).
 */
export function defaultUpdateFor(path: RequirementFieldPath): FieldUpdate | null {
  const def = BY_PATH.get(path);
  if (!def) return null;
  return {
    path: def.path,
    value: def.value,
    source: 'default_applied' satisfies FieldSource,
    provenance: 'ASSUMED',
    reason: def.reason,
    ruleId: def.ruleId,
  };
}

export interface AssumptionCardItem {
  readonly path: RequirementFieldPath;
  readonly reason: string;
  readonly ruleId?: string;
}

/**
 * Kartu "Asumsi yang digunakan" — setiap field `ASSUMED` di state muncul di sini.
 * Bila ada field `ASSUMED` tanpa `reason`, itu pelanggaran TV-1; kami lempar alih-
 * alih merender kartu bisu, karena asumsi tak terlihat lebih berbahaya dari error.
 */
export function assumptionCard(
  fields: ReadonlyArray<readonly [RequirementFieldPath, TrackedValue<unknown>]>,
  locale: Locale = DEFAULT_LOCALE,
): readonly AssumptionCardItem[] {
  const items: AssumptionCardItem[] = [];
  for (const [path, value] of fields) {
    if (value.provenance !== 'ASSUMED') continue;
    if (!value.reason) {
      throw new Error(`invarian TV-1: field ASSUMED '${path}' tidak punya reason`);
    }
    // Reason tersimpan adalah kalimat Indonesia dari tabel default; di en dipakai kembarannya,
    // dan reason lain (bukan dari tabel) ditampilkan apa adanya.
    const def = BY_PATH.get(path);
    const reason =
      locale === 'en' && def !== undefined && value.reason === def.reason
        ? defaultReason(def, locale)
        : value.reason;
    items.push({
      path,
      reason,
      ...(value.ruleId !== undefined ? { ruleId: value.ruleId } : {}),
    });
  }
  return items;
}
