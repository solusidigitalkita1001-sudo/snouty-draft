/**
 * Kecepatan pengungkapan jawaban: jawaban pendek tetap terasa diketik, jawaban panjang tidak
 * pernah membuat pengguna menunggu lebih dari batasnya (audit UX 2026-10-08: 110 cps tetap
 * membuat jawaban 1.500 karakter berjalan ±14 detik).
 */
import { describe, expect, it } from 'vitest';
import { MAX_REVEAL_SECONDS, revealRate } from './assistant-reveal';

describe('revealRate', () => {
  it('jawaban pendek memakai kecepatan minimum', () => {
    expect(revealRate(100)).toBe(110);
  });

  it('jawaban panjang selesai dalam batas waktu', () => {
    for (const length of [500, 1500, 2200, 6000]) {
      expect(length / revealRate(length)).toBeLessThanOrEqual(MAX_REVEAL_SECONDS + 1e-9);
    }
    expect(revealRate(2200)).toBeCloseTo(1000);
  });
});
