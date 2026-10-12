import { describe, expect, it } from 'vitest';
import { computeSolution } from '../compute-solution.js';
import { stepFormula } from './step-formulas.js';

// Rumah contoh kerja desain: 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur, toren atap.
const result = computeSolution({
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
});
const formula = (ruleId: string, locale: 'id' | 'en' = 'id') => {
  const trace = result.traces.find((t) => t.ruleId === ruleId)!;
  return stepFormula(ruleId, trace.inputs, trace.output, locale);
};

describe('rumus singkat langkah hitung', () => {
  it('titik air dan beban suplai ditulis sebagai rumus dengan angka trace', () => {
    expect(formula('ENG-001')).toBe(
      'Titik air = 3 kamar mandi × 2 + 4 wastafel + 1 dapur = 11 titik',
    );
    expect(formula('ENG-701')).toBe(
      'Beban = 3 × 2,2 + 3 × 1 + 4 × 0,5 + 1 × 1 = 12,6 unit → Q = 1,03 l/s (kurva Hunter)',
    );
  });

  it('setiap langkah rumah yang punya rumus memakai desimal sesuai bahasa', () => {
    for (const trace of result.traces) {
      const id = stepFormula(trace.ruleId, trace.inputs, trace.output, 'id');
      const en = stepFormula(trace.ruleId, trace.inputs, trace.output, 'en');
      if (id === null) continue;
      expect(id).not.toContain('?');
      expect(en).not.toBeNull();
      expect(en).not.toMatch(/\d,\d/);
    }
    expect(formula('ENG-701', 'en')).toContain('12.6 units');
  });

  it('aturan tanpa rumus atau trace yang tidak dikenali → null, bukan rumus setengah', () => {
    expect(stepFormula('ENG-999', {}, {})).toBeNull();
    expect(stepFormula('ENG-001', { bathrooms: 3 }, {})).toBeNull();
  });
});
