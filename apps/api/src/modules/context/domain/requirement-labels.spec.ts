/** Label kebutuhan dwibahasa: Indonesia tetap seperti semula, Inggris dengan struktur sama. */
import { describe, expect, it } from 'vitest';
import {
  hasPublicToilets,
  requirementFieldLabel,
  requirementValueLabel,
} from './requirement-labels.js';

describe('requirementValueLabel', () => {
  it('id tidak berubah', () => {
    expect(requirementValueLabel('building.floors', 2)).toBe('2 lantai');
    // Review laporan 0015: kamar mandi adalah ruang berisi dua titik air.
    expect(requirementValueLabel('fixtures.bathrooms', 3)).toBe(
      '3 ruang (6 titik: shower + kloset)',
    );
    expect(requirementValueLabel('fixtures.bathrooms', 2, 'id', { bathroomHasTap: true })).toBe(
      '2 ruang (4 titik: kloset + keran)',
    );
    expect(requirementValueLabel('fixtures.basins', 1)).toBe('1 titik');
    expect(requirementValueLabel('water.boosterPump', true)).toBe('Ya');
    expect(requirementValueLabel('water.source', 'rooftop_tank')).toBe('Toren atap');
    expect(requirementFieldLabel('building.floors')).toBe('Jumlah lantai');
  });

  it('en berbahasa Inggris', () => {
    expect(requirementValueLabel('building.floors', 2, 'en')).toBe('2 floors');
    expect(requirementValueLabel('fixtures.bathrooms', 3, 'en')).toBe(
      '3 rooms (6 outlets: shower + toilet)',
    );
    expect(requirementValueLabel('water.boosterPump', false, 'en')).toBe('No');
    expect(requirementValueLabel('water.source', 'rooftop_tank', 'en')).toBe('Rooftop tank');
    expect(requirementValueLabel('building.floorHeightM', 3.5, 'en')).toBe('3.5 m');
    expect(requirementFieldLabel('building.floors', 'en')).toBe('Number of floors');
  });
});

describe('hasPublicToilets', () => {
  it('hanya rumah ibadah dan bangunan umum berisi toilet umum', () => {
    expect(hasPublicToilets('place_of_worship')).toBe(true);
    expect(hasPublicToilets('public_building')).toBe(true);
    expect(hasPublicToilets('residential')).toBe(false);
    expect(hasPublicToilets('boarding_house')).toBe(false);
    expect(hasPublicToilets(null)).toBe(false);
  });
});
