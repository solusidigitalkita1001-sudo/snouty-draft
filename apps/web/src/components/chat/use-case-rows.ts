/**
 * Baris panel kanan untuk percakapan dengan JALUR GUNA khusus — irigasi (OQ-47) dan kasus
 * teknis umum (Fase 14) — dari `RequirementState.useCase`. Hanya dibaca: nilainya diubah lewat
 * kartu klarifikasi atau kalimat di chat, bukan "Ubah" (belum ada endpoint editnya, dan panel
 * ini sendiri menunggu desain). `null` = percakapan bangunan biasa (panel field bangunan).
 */
import { caseProfile, isCaseId, parameterDefinition } from '@snouty/engineering';
import type { IrrigationField, RequirementState, TechnicalParameter } from '@snouty/shared-types';

export interface UseCaseRow {
  readonly field: string;
  readonly label: string;
  /** Nilai apa adanya, atau `null` bila belum dijawab. */
  readonly value: string | null;
  readonly required: boolean;
}

const IRRIGATION_FIELDS: ReadonlyArray<{
  readonly field: IrrigationField;
  readonly label: string;
  readonly required: boolean;
}> = [
  { field: 'irrigation.source', label: 'Sumber air', required: true },
  { field: 'irrigation.areaHa', label: 'Luas lahan', required: true },
  { field: 'irrigation.method', label: 'Jenis irigasi', required: true },
  { field: 'irrigation.distance', label: 'Jarak sumber ke lahan', required: true },
  { field: 'irrigation.elevation', label: 'Beda tinggi', required: true },
  { field: 'irrigation.pump', label: 'Pompa', required: false },
];

export function useCaseRows(state: RequirementState): readonly UseCaseRow[] | null {
  const useCase = state.useCase;
  if (useCase === undefined) return null;
  if (useCase.kind === 'irrigation') {
    return IRRIGATION_FIELDS.map(({ field, label, required }) => ({
      field,
      label,
      value: useCase.answers[field] ?? null,
      required,
    }));
  }
  if (!isCaseId(useCase.caseId)) return null;
  const profile = caseProfile(useCase.caseId);
  const known = Object.entries(useCase.parameters);
  const critical = profile.critical.map((key) => ({
    field: key,
    label: parameterDefinition(key).label,
    value: useCase.parameters[key] ? formatValue(useCase.parameters[key]!) : null,
    required: true,
  }));
  const others = known
    .filter(([key]) => !profile.critical.includes(key as (typeof profile.critical)[number]))
    .map(([key, p]) => ({ field: key, label: p.label, value: formatValue(p), required: false }));
  return [...critical, ...others];
}

function formatValue(p: TechnicalParameter): string {
  if (typeof p.value === 'boolean') return p.value ? 'Ya' : 'Tidak';
  if (typeof p.value === 'number') {
    const n = p.value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    return p.unit ? `${n} ${p.unit}` : n;
  }
  return p.value;
}
