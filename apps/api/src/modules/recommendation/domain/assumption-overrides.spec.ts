/**
 * "Perbaiki asumsi ini" (pemilik 2026-10-09): nilai pengganti tersimpan di kasus, dipakai engine,
 * baris asumsi membawa nilai yang bisa diubah, dan nilai yang tidak bisa dihitung ditolak.
 */
import type { Recommendation, RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { overrideAssumption } from '../application/analysis.service.js';
import {
  AssumptionValueRejectedError,
  overridesOf,
  withAssumptionOverride,
  withEditableAssumptions,
} from './assumption-overrides.js';
import { flowSchematicFor } from './flow-schematic.js';

const building = {
  ...emptyRequirementState('2026-10-09T00:00:00.000Z'),
  useCase: {
    kind: 'technical',
    caseId: 'multistorey_building_water',
    parameters: {
      building_floors: { label: 'Jumlah lantai', value: 12, origin: 'known' },
      floor_area: { label: 'Luas per lantai', value: 3000, origin: 'known' },
    },
  },
} as RequirementState;

describe('nilai pengganti asumsi', () => {
  it('disimpan per ID, dipakai hitungan, dan bisa dikembalikan ke nilai baku', () => {
    const changed = overrideAssumption(building, 'DEMAND_LPCD_150', 200, 'id');
    expect(overridesOf(changed)).toEqual({ DEMAND_LPCD_150: 200 });
    const before = flowSchematicFor(building, 'erp', 'id')!;
    const after = flowSchematicFor(changed, 'erp', 'id')!;
    expect(before.nodes[0]!.detail).toContain('540 m³/hari');
    expect(after.nodes[0]!.detail).toContain('720 m³/hari');
    expect(overridesOf(withAssumptionOverride(changed, 'DEMAND_LPCD_150', null))).toEqual({});
  });

  it('ditolak: ID tidak dikenal, bukan angka positif, atau di luar batas hitung', () => {
    expect(() => withAssumptionOverride(building, 'TIDAK_ADA', 1)).toThrow(
      AssumptionValueRejectedError,
    );
    expect(() => withAssumptionOverride(building, 'DEMAND_LPCD_150', 0)).toThrow(
      AssumptionValueRejectedError,
    );
    // 5000 l/orang/hari di luar batas aturan kebutuhan air (maks 1000).
    expect(() => overrideAssumption(building, 'DEMAND_LPCD_150', 5000, 'id')).toThrow(
      'Nilai itu di luar batas hitung',
    );
    // Irigasi belum punya asumsi yang bisa diubah.
    const irrigation = {
      ...emptyRequirementState('T'),
      useCase: { kind: 'irrigation' },
    } as unknown as RequirementState;
    expect(() => withAssumptionOverride(irrigation, 'DEMAND_LPCD_150', 200)).toThrow(
      AssumptionValueRejectedError,
    );
  });

  it('jalur bangunan (rumah, tempat ibadah) menyimpan nilai pengganti di state (pemilik 2026-10-12)', () => {
    const changed = withAssumptionOverride(emptyRequirementState('T'), 'WUDHU_TAP_SPACING_0_8M', 1);
    expect(changed.assumptionOverrides).toEqual({ WUDHU_TAP_SPACING_0_8M: 1 });
    expect(overridesOf(changed)).toEqual({ WUDHU_TAP_SPACING_0_8M: 1 });
    expect(overridesOf(withAssumptionOverride(changed, 'WUDHU_TAP_SPACING_0_8M', null))).toEqual(
      {},
    );
  });

  it('baris asumsi membawa nilai + satuan; nilai dari pengguna tampil sebagai baris sendiri', () => {
    const recommendation = {
      assumptions: [
        { text: 'Cara hitungnya: …', fieldPath: '' },
        {
          text: 'Air dipakai selama 10 jam per hari.',
          fieldPath: 'operating_hours',
          assumptionId: 'USAGE_HOURS_10',
        },
      ],
    } as unknown as Recommendation;
    const changed = withAssumptionOverride(building, 'DEMAND_LPCD_150', 200);
    const rows = withEditableAssumptions(recommendation, changed, 'id').assumptions;
    expect(rows[0]).not.toHaveProperty('value');
    expect(rows[1]).toMatchObject({ value: 10, unit: 'jam/hari' });
    expect(rows[2]).toMatchObject({
      assumptionId: 'DEMAND_LPCD_150',
      value: 200,
      userSet: true,
      text: 'Kebutuhan air 150 liter per orang per hari — Anda ubah menjadi 200 l/orang/hari.',
    });
  });
});
