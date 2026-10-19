/**
 * "Perbaiki asumsi ini" untuk kasus teknis (permintaan pemilik 2026-10-09: "kalau gw perbaiki
 * asumsi ini bisa di-adjust dan SNOUTY ngitung kembali?"). Nilai pengganti disimpan per ID asumsi
 * registry di kasus (`assumptionOverrides`); engine memakainya menggantikan nilai baku, dan baris
 * asumsi di solusi membawa nilai + satuan supaya bisa diubah di tempat. **Fungsi murni.**
 */
import {
  ASSUMPTIONS,
  assumption,
  assumptionDescription,
  unitLabel,
  type AssumptionOverrides,
} from '@snouty/engineering';
import type { Assumption, Locale, Recommendation, RequirementState } from '@snouty/shared-types';

/** Nilai yang ditolak: ID tidak dikenal, bukan asumsi angka, atau di luar batas hitung. */
export class AssumptionValueRejectedError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'AssumptionValueRejectedError';
  }
}

/**
 * Kasus teknis menyimpan nilai pengganti di kasusnya; jalur bangunan (tanpa `useCase`) di state.
 * Irigasi belum punya asumsi yang bisa diubah.
 */
export function overridesOf(state: RequirementState): AssumptionOverrides {
  if (state.useCase?.kind === 'technical') return state.useCase.assumptionOverrides ?? {};
  return state.useCase === undefined ? (state.assumptionOverrides ?? {}) : {};
}

/** Kasus teknis dan jalur bangunan bisa mengganti asumsi angka. */
function editable(state: RequirementState): boolean {
  return state.useCase === undefined || state.useCase.kind === 'technical';
}

/** Asumsi angka yang boleh diganti pengguna. */
function numericAssumption(id: string) {
  const definition = ASSUMPTIONS.find((a) => a.id === id);
  return definition !== undefined && typeof definition.value === 'number' ? definition : null;
}

/**
 * State dengan nilai pengganti baru (`value === null` → kembali ke nilai baku). Melempar bila
 * kasusnya bukan kasus teknis, ID tidak dikenal, atau nilainya bukan angka positif.
 */
export function withAssumptionOverride(
  state: RequirementState,
  assumptionId: string,
  value: number | null,
): RequirementState {
  if (!editable(state)) {
    throw new AssumptionValueRejectedError('Asumsi ini tidak bisa diubah di sini.');
  }
  if (numericAssumption(assumptionId) === null) {
    throw new AssumptionValueRejectedError('Asumsi ini tidak bisa diubah nilainya.');
  }
  if (value !== null && !(Number.isFinite(value) && value > 0)) {
    throw new AssumptionValueRejectedError('Isi dengan angka lebih dari nol.');
  }
  const rest = Object.fromEntries(
    Object.entries(overridesOf(state)).filter(([id]) => id !== assumptionId),
  );
  const overrides = value === null ? rest : { ...rest, [assumptionId]: value };
  return state.useCase?.kind === 'technical'
    ? { ...state, useCase: { ...state.useCase, assumptionOverrides: overrides } }
    : { ...state, assumptionOverrides: overrides };
}

const formatted = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 3 });

/**
 * Baris asumsi siap diubah: asumsi angka membawa nilai dan satuannya; nilai yang sudah diganti
 * pengguna tampil sebagai baris tersendiri (bukan tebakan lagi), tetap bisa diubah atau dikembalikan.
 */
export function withEditableAssumptions(
  recommendation: Recommendation,
  state: RequirementState,
  locale: Locale,
): Recommendation {
  if (!editable(state)) return recommendation;
  const overridden = overridesOf(state);
  const rows = recommendation.assumptions.map((row): Assumption => {
    const definition = row.assumptionId ? numericAssumption(row.assumptionId) : null;
    if (definition === null) return row;
    return {
      ...row,
      value: definition.value as number,
      ...(definition.unit ? { unit: unitLabel(definition.unit, locale) } : {}),
    };
  });
  const own = Object.entries(overridesOf(state)).flatMap(([id, value]): Assumption[] => {
    const definition = numericAssumption(id);
    if (definition === null) return [];
    const unit = definition.unit ? ` ${unitLabel(definition.unit, locale)}` : '';
    const before = assumptionDescription(id, locale).replace(/\.$/, '');
    return [
      {
        text:
          locale === 'en'
            ? `${before} — changed by you to ${formatted(value, locale)}${unit}.`
            : `${before} — Anda ubah menjadi ${formatted(value, locale)}${unit}.`,
        fieldPath: definition.parameter,
        assumptionId: id,
        value,
        ...(definition.unit ? { unit: unitLabel(definition.unit, locale) } : {}),
        userSet: true,
      },
    ];
  });
  // Baris baku asumsi yang sudah diganti tidak ditampilkan dua kali — baris "Anda ubah" menggantikannya.
  const shown = rows.filter((row) => !(row.assumptionId && row.assumptionId in overridden));
  return { ...recommendation, assumptions: [...shown, ...own] };
}

/** Nilai baku registry — untuk "kembalikan ke nilai awal". */
export function defaultAssumptionValue(id: string): number | null {
  const value = assumption(id).value;
  return typeof value === 'number' ? value : null;
}
