/**
 * Galat engine → event `error` SSE. Satu tempat, dipakai jalur analisis dan jalur chat: smoke test
 * 13 Nov 2026 (temuan 3) menemukan nol titik air dijawab `SERVICE_UNAVAILABLE` dengan
 * `retryable: true`, yaitu "coba lagi" untuk data yang tidak akan berubah sampai penggunanya
 * mengubahnya. Masukan yang di luar domain sebuah aturan adalah galat VALIDASI.
 */
import { CaseInputInvalidError, EngineConsistencyError, RuleInputError } from '@snouty/engineering';
import type { AssistantStreamEvent } from '@snouty/shared-types';

/** Galat yang mengulang tidak akan menolong: data atau hitungannya, bukan layanannya. */
export function isInputError(error: unknown): boolean {
  return error instanceof CaseInputInvalidError || error instanceof RuleInputError;
}

export function errorEventFor(
  error: unknown,
  /** Galat lain yang jalur itu sendiri anggap galat masukan (mis. kasus teknis tanpa angka). */
  alsoInput: (error: unknown) => boolean = () => false,
): Extract<AssistantStreamEvent, { type: 'error' }> {
  const invalid = isInputError(error) || alsoInput(error);
  const inconsistent = error instanceof EngineConsistencyError;
  return {
    type: 'error',
    code: invalid ? 'VALIDATION_FAILED' : 'SERVICE_UNAVAILABLE',
    retryable: !invalid && !inconsistent,
  };
}
