/** P22-01: contoh rumah dari data — valid, unik, dan setiap nilainya lolos skema edit. */
import { describe, expect, it } from 'vitest';
import { findHouseExamplesDir, houseExamplesFromRepo, loadHouseExamples } from './house-examples.js';

describe('house examples (data/house-examples)', () => {
  it('berkas repo ditemukan ke atas dari apps/api dan memuat contoh rumah subsidi', () => {
    const dir = findHouseExamplesDir();
    expect(dir).not.toBeNull();
    const examples = loadHouseExamples(dir!);
    expect(examples.map((e) => e.id)).toContain('subsidi_36');
    const t36 = examples.find((e) => e.id === 'subsidi_36')!;
    expect(t36.fields).toContainEqual({ path: 'water.source', value: 'rooftop_tank' });
    expect(t36.label.en).toMatch(/type 36/);
  });

  it('tanpa folder → daftar kosong, bukan galat', () => {
    expect(houseExamplesFromRepo('C:/')).toEqual([]);
  });
});
