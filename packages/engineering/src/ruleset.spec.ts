import { describe, expect, it } from 'vitest';
import { computeSolution } from './compute-solution.js';
import { outdatedRules, rulesetStamp } from './ruleset.js';

describe('versi aturan hasil hitung (temuan laporan SNTY-2026-10-0002)', () => {
  const current = computeSolution({
    buildingType: 'residential',
    floors: 2,
    bathrooms: 3,
    basins: 0,
    kitchens: null,
    waterSource: 'municipal',
    installationType: 'both',
    floorHeightM: null,
    mainRunMeters: null,
  }).traces;

  it('hasil engine sekarang tidak usang; stempelnya stabil', () => {
    expect(outdatedRules(current)).toEqual([]);
    expect(rulesetStamp(current)).toMatch(/^[0-9a-f]{8}$/);
    expect(rulesetStamp(current)).toBe(rulesetStamp([...current].reverse()));
  });

  it('trace laporan 0002 (ENG-002, ENG-009, ENG-011 dihapus; ENG-001/003 v1) dikenali usang', () => {
    const old = ['ENG-001@1', 'ENG-002@1', 'ENG-003@1', 'ENG-009@1', 'ENG-011@1', 'ENG-601@1'].map(
      (u) => ({ ruleId: u.split('@')[0]!, ruleVersion: u.split('@')[1]! }),
    );
    expect(outdatedRules(old)).toEqual([
      'ENG-001@1',
      'ENG-002@1',
      'ENG-003@1',
      'ENG-009@1',
      'ENG-011@1',
      // ENG-601 v2 (2026-10-12): talang wudhu masuk beban air bekas.
      'ENG-601@1',
    ]);
    expect(rulesetStamp(old)).not.toBe(rulesetStamp(current));
  });
});
