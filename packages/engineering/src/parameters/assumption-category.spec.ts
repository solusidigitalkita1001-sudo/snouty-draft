/** P17-03 (DD-01 #10): kategori asumsi diturunkan dari registry, bukan dari daftar kalimat. */
import { describe, expect, it } from 'vitest';
import { ASSUMPTIONS } from './assumptions.js';
import { ASSUMPTION_CATEGORIES, assumptionCategory } from './assumption-category.js';

describe('assumptionCategory', () => {
  it('asumsi registry: kategori dari domain parameter yang diisinya', () => {
    expect(assumptionCategory({ assumptionId: 'HOUSE_KITCHEN_1', fieldPath: '' })).toBe('fixtures');
    expect(assumptionCategory({ assumptionId: 'TANK_STAND_1M', fieldPath: '' })).toBe(
      'water_source',
    );
    expect(assumptionCategory({ assumptionId: 'VELOCITY_MAX_PLASTIC', fieldPath: '' })).toBe(
      'engineering',
    );
  });

  it('bidang kebutuhan: menurut bagiannya; parameter sebagai fieldPath juga dikenali', () => {
    expect(assumptionCategory({ fieldPath: 'building.floorHeightM' })).toBe('building');
    expect(assumptionCategory({ fieldPath: 'fixtures.basins' })).toBe('fixtures');
    expect(assumptionCategory({ fieldPath: 'water.source' })).toBe('water_source');
    expect(assumptionCategory({ fieldPath: 'route_length' })).toBe('route');
  });

  it('baris cara hitung tanpa bidang → Teknik', () => {
    expect(assumptionCategory({ fieldPath: '' })).toBe('engineering');
  });

  it('setiap asumsi di registry punya kategori yang dikenal', () => {
    for (const a of ASSUMPTIONS) {
      expect(ASSUMPTION_CATEGORIES).toContain(
        assumptionCategory({ assumptionId: a.id, fieldPath: '' }),
      );
    }
  });
});
