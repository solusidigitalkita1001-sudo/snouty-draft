/**
 * Smoke test 13 Nov 2026, temuan 13: jalur air bekas 2" dengan beban 7 dari kapasitas 8 lolos UPC
 * tetapi mepet, dan tidak ada apa pun di layar yang mengatakannya. Ukurannya belum dinaikkan —
 * itu keputusan Pralon (OQ-102) — tetapi tipisnya cadangan dikatakan.
 */
import { describe, expect, it } from 'vitest';
import { ENG_602 } from './rules/group-j-waste.js';

const run = (dfu: number) =>
  ENG_602.compute(
    ENG_602.parseInput({ dfu, minimumSize: '2"', branchStackSize: null, nearCapacityPct: 75 }),
  );

describe('cadangan kapasitas jalur pembuangan', () => {
  it('beban 7 dari kapasitas 8: ukurannya tetap 2", tetapi tipisnya dikatakan', () => {
    const out = run(7);
    expect(out.size).toBe('2"');
    expect(out.capacityUsedPct).toBe(88);
    expect(out.nearCapacity).toBe(true);
    const reason = ENG_602.explain!(
      ENG_602.parseInput({ dfu: 7, minimumSize: '2"', branchStackSize: null, nearCapacityPct: 75 }),
      out,
      'id',
    );
    expect(reason).toContain('88 % kapasitas');
    expect(reason).toContain('tanpa banyak cadangan');
  });

  it('beban 4 dari kapasitas 8: tidak ada peringatan yang tidak perlu', () => {
    const out = run(4);
    expect(out.capacityUsedPct).toBe(50);
    expect(out.nearCapacity).toBe(false);
    expect(
      ENG_602.explain!(
        ENG_602.parseInput({
          dfu: 4,
          minimumSize: '2"',
          branchStackSize: null,
          nearCapacityPct: 75,
        }),
        out,
        'id',
      ),
    ).not.toContain('cadangan');
  });
});
