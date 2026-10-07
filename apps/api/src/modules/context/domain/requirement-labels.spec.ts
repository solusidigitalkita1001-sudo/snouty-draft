/** Label kebutuhan dwibahasa: Indonesia tetap seperti semula, Inggris dengan struktur sama. */
import { describe, expect, it } from 'vitest';
import { requirementFieldLabel, requirementValueLabel } from './requirement-labels.js';

describe('requirementValueLabel', () => {
  it('id tidak berubah', () => {
    expect(requirementValueLabel('building.floors', 2)).toBe('2 lantai');
    expect(requirementValueLabel('fixtures.bathrooms', 3)).toBe('3 titik');
    expect(requirementValueLabel('water.boosterPump', true)).toBe('Ya');
    expect(requirementValueLabel('water.source', 'rooftop_tank')).toBe('Toren atap');
    expect(requirementFieldLabel('building.floors')).toBe('Jumlah lantai');
  });

  it('en berbahasa Inggris', () => {
    expect(requirementValueLabel('building.floors', 2, 'en')).toBe('2 floors');
    expect(requirementValueLabel('fixtures.bathrooms', 3, 'en')).toBe('3 points');
    expect(requirementValueLabel('water.boosterPump', false, 'en')).toBe('No');
    expect(requirementValueLabel('water.source', 'rooftop_tank', 'en')).toBe('Rooftop tank');
    expect(requirementValueLabel('building.floorHeightM', 3.5, 'en')).toBe('3.5 m');
    expect(requirementFieldLabel('building.floors', 'en')).toBe('Number of floors');
  });
});
