/**
 * Skema endpoint: kasus teknis dan irigasi dibentuk ulang dari snapshot sebagai skema aliran
 * dengan hitungan yang sama seperti solusinya; kebutuhan bangunan biasa → `null` (skema lantai).
 */
import type { RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { flowSchematicFor, networkFamilyFor } from './flow-schematic.js';

const T0 = '2026-10-09T00:00:00.000Z';

function technical(caseId: string, parameters: Record<string, number | string>): RequirementState {
  return {
    ...emptyRequirementState(T0),
    useCase: {
      kind: 'technical',
      caseId,
      parameters: Object.fromEntries(
        Object.entries(parameters).map(([k, value]) => [k, { label: k, value, origin: 'known' }]),
      ),
    },
  } as RequirementState;
}

describe('flowSchematicFor', () => {
  it('rumah biasa → null, skema lantai yang dipakai', () => {
    expect(flowSchematicFor(emptyRequirementState(T0), 'erp', 'id')).toBeNull();
  });

  it('kolam, gedung, cluster, sumur → skema aliran sesuai kasus', () => {
    const pond = flowSchematicFor(
      technical('fish_pond', { pond_length: 4, pond_width: 4 }),
      'erp',
      'id',
    );
    expect(pond?.titleBlock.drawing).toBe('SK-02 KOLAM');

    const building = flowSchematicFor(
      technical('multistorey_building_water', { building_floors: 12, floor_area: 3000 }),
      'erp',
      'id',
    );
    expect(building?.nodes[0]!.title).toBe('TANGKI BAWAH');
    expect(building?.titleBlock.basis).toBe('12 LANTAI · 2 ZONA');

    const cluster = flowSchematicFor(
      technical('residential_cluster', {
        number_of_connections: 120,
        route_length: 500,
        static_head: 5,
      }),
      'erp',
      'id',
    );
    expect(cluster?.links.some((l) => l.label.endsWith('HDPE'))).toBe(true);

    const well = flowSchematicFor(
      technical('well_distribution', {
        well_depth: 60,
        design_flow: 1,
        tank_elevation: 10,
        route_length: 50,
      }),
      'erp',
      'id',
    );
    expect(well?.nodes[0]!.title).toBe('SUMUR');
  });

  it('keluarga pipa cluster sama dengan aturan runner', () => {
    expect(networkFamilyFor(199)).toBe('PVC AW');
    expect(networkFamilyFor(500)).toBe('HDPE');
  });
});
