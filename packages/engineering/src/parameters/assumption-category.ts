/**
 * Kategori tampilan asumsi (DD-01 #10): Bangunan · Isi ruangan · Sumber air · Panjang jalur · Teknik.
 *
 * Tidak ada daftar asumsi per kategori di sini. Kategorinya diturunkan dari data yang sudah ada:
 * asumsi registry → parameter yang diisinya → domain parameter itu. Asumsi baru di registry
 * otomatis masuk kategori yang benar tanpa mengubah file ini.
 */

import { ASSUMPTIONS } from './assumptions.js';
import { isParameterKey, parameterDefinition, type ParameterDomain } from './registry.js';

export type AssumptionCategory = 'building' | 'fixtures' | 'water_source' | 'route' | 'engineering';

/** Urutan tampil tabel asumsi. */
export const ASSUMPTION_CATEGORIES: readonly AssumptionCategory[] = [
  'building',
  'fixtures',
  'water_source',
  'route',
  'engineering',
];

const BY_DOMAIN: Readonly<Record<ParameterDomain, AssumptionCategory>> = {
  project: 'building',
  network: 'fixtures',
  source: 'water_source',
  destination: 'water_source',
  pump: 'water_source',
  site: 'route',
  fluid: 'engineering',
  hydraulic: 'engineering',
  pipe: 'engineering',
  gravity: 'engineering',
  stormwater: 'engineering',
  structural: 'engineering',
  operation: 'engineering',
};

/** Bidang kebutuhan (`RequirementFieldPath`) → kategori, menurut awalan bagiannya. */
const BY_FIELD_SECTION: Readonly<Record<string, AssumptionCategory>> = {
  building: 'building',
  fixtures: 'fixtures',
  water: 'water_source',
};

const PARAMETER_OF = new Map(ASSUMPTIONS.map((a) => [a.id, a.parameter]));

export function assumptionCategory(assumption: {
  readonly assumptionId?: string;
  readonly fieldPath: string;
}): AssumptionCategory {
  const parameter =
    (assumption.assumptionId && PARAMETER_OF.get(assumption.assumptionId)) ||
    (isParameterKey(assumption.fieldPath) ? assumption.fieldPath : undefined);
  if (parameter) return BY_DOMAIN[parameterDefinition(parameter).domain];
  const section = assumption.fieldPath.split('.')[0] ?? '';
  return BY_FIELD_SECTION[section] ?? 'engineering';
}
