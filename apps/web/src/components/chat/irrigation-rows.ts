/**
 * Baris panel kanan untuk percakapan IRIGASI (OQ-47) — dari `RequirementState.useCase`.
 * Hanya dibaca: jawaban irigasi diubah lewat kartu klarifikasi, bukan "Ubah" (belum ada
 * endpoint editnya, dan panel irigasi sendiri menunggu desain). Label dan urutannya sama
 * dengan templat pertanyaan di API (`context/domain/irrigation.ts`) — dijaga manual.
 */
import type { IrrigationField, RequirementState } from '@snouty/shared-types';

export interface IrrigationRow {
  readonly field: IrrigationField;
  readonly label: string;
  /** Nilai apa adanya, atau `null` bila belum dijawab. */
  readonly value: string | null;
  readonly required: boolean;
}

const FIELDS: ReadonlyArray<{
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

export function irrigationRows(state: RequirementState): readonly IrrigationRow[] | null {
  if (state.useCase?.kind !== 'irrigation') return null;
  const answers = state.useCase.answers;
  return FIELDS.map(({ field, label, required }) => ({
    field,
    label,
    value: answers[field] ?? null,
    required,
  }));
}
