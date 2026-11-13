import { describe, expect, it } from 'vitest';
import { funnelTone, TONE_STEPS } from './funnel-tone';

describe('kepekatan kartu tahap 5A', () => {
  it('tahap tanpa seorang pun tidak diwarnai', () => {
    expect(funnelTone(0, 7)).toBe(0);
  });

  it('tahap teramai mendapat tingkat tertinggi, berapa pun urutannya', () => {
    expect(funnelTone(7, 7)).toBe(TONE_STEPS);
    expect(funnelTone(1, 1)).toBe(TONE_STEPS);
  });

  /** Inti perbaikannya: yang isinya lebih banyak tidak boleh lebih pucat. */
  it('kepekatan naik bersama jumlahnya, tidak pernah turun', () => {
    const busiest = 10;
    const tones = [0, 1, 2, 3, 5, 8, 10].map((n) => funnelTone(n, busiest));
    expect(tones).toEqual([...tones].sort((a, b) => a - b));
    expect(funnelTone(1, busiest)).toBeLessThan(funnelTone(10, busiest));
  });

  it('papan yang masih kosong tidak mewarnai apa pun', () => {
    expect(funnelTone(0, 0)).toBe(0);
  });
});
