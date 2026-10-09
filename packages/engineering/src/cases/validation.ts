/**
 * Pagar masukan kasus teknis (audit langkah 4): nilai yang saling bertentangan atau tidak masuk
 * akal ditolak dengan alasan yang bisa ditanyakan balik ke pengguna — bukan dihitung menjadi
 * angka yang tampak meyakinkan, dan bukan galat "layanan tidak tersedia".
 *
 * Batasnya sama dengan batas masukan aturan yang memakai nilai itu (ENG-501, ENG-503), supaya
 * yang lolos di sini tidak gagal di aturan dan sebaliknya.
 */

import { assumptionReader, type AssumptionOverrides } from '../parameters/assumptions.js';
import type { ParameterKey } from '../parameters/registry.js';
import type { CaseId } from './profiles.js';

export interface CaseInputIssue {
  /** Parameter yang perlu diperbaiki pengguna. */
  readonly parameter: ParameterKey;
  readonly message: string;
  readonly messageEn: string;
}

/** Tinggi lantai yang bisa dihitung ENG-503. */
const FLOOR_HEIGHT_RANGE_M = { min: 2, max: 10 } as const;
/** Luas per orang terkecil yang diterima ENG-501. */
const MIN_AREA_PER_PERSON_M2 = 1;

type Values = Partial<Record<ParameterKey, number | string | boolean | null | undefined>>;

const numberOf = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function caseInputIssues(
  caseId: CaseId,
  values: Values,
  overrides: AssumptionOverrides = {},
): readonly CaseInputIssue[] {
  if (caseId !== 'multistorey_building_water') return [];
  const issues: CaseInputIssue[] = [];
  const floors = numberOf(values['building_floors']);
  const height = numberOf(values['building_height']);
  const occupants = numberOf(values['number_of_occupants']);
  const area = numberOf(values['floor_area']);
  const residual = numberOf(values['required_pressure']);

  if (floors !== undefined && floors < 1) {
    issues.push({
      parameter: 'building_floors',
      message: 'Jumlah lantainya minimal satu. Gedungnya berapa lantai?',
      messageEn: 'A building has at least one floor. How many floors does it have?',
    });
  }
  if (floors !== undefined && floors >= 1 && height !== undefined) {
    const perFloor = height / floors;
    if (perFloor < FLOOR_HEIGHT_RANGE_M.min || perFloor > FLOOR_HEIGHT_RANGE_M.max) {
      issues.push({
        parameter: 'building_height',
        message: `Tinggi ${fmt(height)} m untuk ${fmt(floors)} lantai berarti ${fmt(perFloor)} m per lantai, jadi salah satunya belum pas. Tinggi gedung totalnya berapa meter?`,
        messageEn: `A height of ${fmt(height)} m over ${fmt(floors)} floors means ${fmt(perFloor)} m per floor, so one of them is off. What is the total building height in metres?`,
      });
    }
  }
  if (occupants !== undefined && area !== undefined && floors !== undefined && floors >= 1) {
    const perPerson = (area * floors) / occupants;
    if (perPerson < MIN_AREA_PER_PERSON_M2) {
      issues.push({
        parameter: 'number_of_occupants',
        message: `${fmt(occupants)} orang di ${fmt(floors)} lantai seluas ${fmt(area)} m² berarti kurang dari 1 m² per orang. Jumlah penghuninya berapa, atau luas lantainya berapa?`,
        messageEn: `${fmt(occupants)} people on ${fmt(floors)} floors of ${fmt(area)} m² is less than 1 m² per person. How many occupants are there, or what is the floor area?`,
      });
    }
  }
  if (residual !== undefined) {
    const maxZoneBar = assumptionReader(overrides).use('ZONE_MAX_STATIC_4BAR');
    if (residual >= maxZoneBar) {
      issues.push({
        parameter: 'required_pressure',
        message: `Tekanan ${fmt(residual)} bar di titik air tidak bisa dicapai kalau tekanan tiap zona dibatasi ${fmt(maxZoneBar)} bar. Tekanan minimum di titik airnya berapa?`,
        messageEn: `A pressure of ${fmt(residual)} bar at the outlets cannot be met when each zone is limited to ${fmt(maxZoneBar)} bar. What minimum outlet pressure do you need?`,
      });
    }
  }
  return issues;
}

/** Masukan kasus ditolak — pemanggil menanyakan `issues` ke pengguna. */
export class CaseInputInvalidError extends Error {
  constructor(readonly issues: readonly CaseInputIssue[]) {
    super(issues.map((i) => i.message).join(' '));
    this.name = 'CaseInputInvalidError';
  }
}
