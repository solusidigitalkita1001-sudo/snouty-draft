/**
 * Dua aturan dari lembar mascot yang wajib jadi tes (docs/DESIGN_IMPLEMENTATION.md §7):
 * `fail` tidak pernah untuk di luar cakupan (pakai `focus`) maupun data kurang (pakai
 * `confused`) — `fail` hanya untuk error sistem. Sisanya memaku urutan evaluasi tabel.
 */
import { describe, expect, it } from 'vitest';
import { MOODS, moodFor, moodForCards } from './mood';

describe('moodFor', () => {
  it('fail hanya untuk error sistem — bukan di luar cakupan, bukan data kurang', () => {
    expect(moodFor({ systemError: true })).toBe('fail');
    expect(moodFor({ outOfScope: true })).toBe('focus');
    expect(moodFor({ clarifying: true })).toBe('confused');
    expect(moodFor({ unavailable: true })).toBe('sorry');
  });

  it('mengikuti urutan tabel: error sistem mengalahkan segalanya', () => {
    expect(
      moodFor({ systemError: true, clarifying: true, solutionReady: true, asleep: true }),
    ).toBe('fail');
    expect(moodFor({ unavailable: true, clarifying: true })).toBe('sorry');
    expect(moodFor({ clarifying: true, outOfScope: true })).toBe('confused');
  });

  it('tahap awal berpikir, tahap akhir menulis', () => {
    expect(moodFor({ stage: 'UNDERSTANDING' })).toBe('think');
    expect(moodFor({ stage: 'ANALYZING_INSTALLATION' })).toBe('think');
    expect(moodFor({ stage: 'MATCHING_PRODUCTS' })).toBe('write');
    expect(moodFor({ stage: 'COMPOSING' })).toBe('write');
    expect(moodFor({ stage: 'PREPARING_SCHEMATIC' })).toBe('write');
  });

  it('solusi siap → happy, tersimpan → thanks, tips → wink, diam → sleep, selain itu idle', () => {
    expect(moodFor({ solutionReady: true })).toBe('happy');
    expect(moodFor({ thanked: true })).toBe('thanks');
    expect(moodFor({ tip: true })).toBe('wink');
    expect(moodFor({ lightLoading: true })).toBe('drip');
    expect(moodFor({ asleep: true })).toBe('sleep');
    expect(moodFor({})).toBe('idle');
  });

  it('setiap mood yang dikembalikan bisa digambar', () => {
    const states = [
      { systemError: true },
      { unavailable: true },
      { clarifying: true },
      { outOfScope: true },
      { surprised: true },
      { stage: 'UNDERSTANDING' as const },
      { stage: 'COMPOSING' as const },
      { solutionReady: true },
      { thanked: true },
      { tip: true },
      { lightLoading: true },
      { asleep: true },
      {},
    ];
    for (const state of states) expect(MOODS).toContain(moodFor(state));
  });
});

describe('moodForCards', () => {
  it('memetakan kartu seperti moodOf prototipe', () => {
    expect(moodForCards([{ kind: 'unsupported', reason: 'x', message: 'y' } as never])).toBe(
      'focus',
    );
    expect(moodForCards([{ kind: 'criteria', items: [] }])).toBe('wink');
    expect(moodForCards([{ kind: 'clarification', questions: [] }])).toBe('confused');
    expect(moodForCards([{ kind: 'cta', action: 'ANALYZE' }])).toBe('happy');
    expect(moodForCards([])).toBe('idle');
  });
});
