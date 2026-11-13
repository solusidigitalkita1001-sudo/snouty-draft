/**
 * Temuan 3 smoke test 13 Nov 2026 — nol titik air dijawab "layanan sedang tidak tersedia, coba
 * lagi". Masukan yang ditolak sebuah aturan adalah galat validasi, dan mengulanginya tidak
 * mengubah apa pun.
 */
import { CaseInputInvalidError, RuleInputError } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { errorEventFor, isInputError } from './engine-error.js';

describe('errorEventFor', () => {
  it('masukan yang ditolak aturan: validasi, tidak ditawarkan coba lagi', () => {
    expect(
      errorEventFor(new RuleInputError('ENG-704', 'branchCount harus 1–200, bukan 0')),
    ).toEqual({ type: 'error', code: 'VALIDATION_FAILED', retryable: false });
    expect(isInputError(new CaseInputInvalidError([]))).toBe(true);
  });

  it('galat lain tetap gangguan layanan yang bisa dicoba lagi', () => {
    expect(errorEventFor(new Error('koneksi putus'))).toEqual({
      type: 'error',
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
    });
  });

  it('galat masukan jalur lain ikut lewat penanda tambahannya', () => {
    class NoNumbers extends Error {}
    expect(errorEventFor(new NoNumbers('x'), (e) => e instanceof NoNumbers)).toMatchObject({
      code: 'VALIDATION_FAILED',
      retryable: false,
    });
  });
});
