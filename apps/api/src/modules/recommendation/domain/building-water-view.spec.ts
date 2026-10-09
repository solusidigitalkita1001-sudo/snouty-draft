/**
 * Layar solusi gedung bertingkat: masukan dari parameter kasus, baris sistem menunjuk trace
 * bagiannya sendiri, prosa membawa angka hasil hitungan.
 */
import { computeBuildingWater } from '@snouty/engineering';
import type { RequirementState } from '@snouty/shared-types';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { describe, expect, it } from 'vitest';
import {
  buildingAssumptions,
  buildingProse,
  buildingSystemLines,
  buildingTraceParts,
  buildingWaterInputFrom,
} from './building-water-view.js';
import type { IdentifiedTrace } from './solution-view.js';

function stateWith(parameters: Record<string, number | string>): RequirementState {
  const base = emptyRequirementState('2026-10-09T00:00:00.000Z');
  return {
    ...base,
    useCase: {
      kind: 'technical',
      caseId: 'multistorey_building_water',
      parameters: Object.fromEntries(
        Object.entries(parameters).map(([k, value]) => [k, { label: k, value, origin: 'known' }]),
      ),
    },
  } as RequirementState;
}

const identify = (traces: readonly object[]): IdentifiedTrace[] =>
  traces.map((t, i) => ({ ...(t as IdentifiedTrace), id: `T${i}` }));

describe('buildingWaterInputFrom', () => {
  it('lantai + luas; tinggi total dibagi per lantai; bahan dari label', () => {
    expect(
      buildingWaterInputFrom(
        stateWith({
          building_floors: 12,
          floor_area: 3000,
          building_height: 48,
          material: 'HDPE',
        }),
      ),
    ).toEqual({ floors: 12, floorAreaM2: 3000, floorHeightM: 4, material: 'HDPE' });
  });

  it('penghuni yang disebut mengalahkan luas; tanpa keduanya → null', () => {
    expect(
      buildingWaterInputFrom(
        stateWith({ building_floors: 6, number_of_occupants: 120, floor_area: 500 }),
      ),
    ).toEqual({ floors: 6, occupants: 120 });
    expect(buildingWaterInputFrom(stateWith({ building_floors: 6 }))).toBeNull();
  });
});

describe('tampilan hasil gedung', () => {
  const result = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
  const traces = identify(result.traces);

  it('trace dipecah per bagian tanpa tumpang tindih', () => {
    const parts = buildingTraceParts(result, traces);
    expect(parts.demand.map((t) => t.ruleId)).toEqual(['ENG-501', 'ENG-502', 'ENG-503', 'ENG-506']);
    expect(parts.transfer[0]!.ruleId).toBe('ENG-205');
    expect(parts.split.map((t) => t.ruleId)).toEqual(['ENG-504']);
    expect(parts.riser[0]!.ruleId).toBe('ENG-205');
    expect(
      parts.demand.length + parts.transfer.length + parts.split.length + parts.riser.length,
    ).toBe(traces.length);
  });

  it('baris sistem: transfer, riser, pompa, zona — tidak ada yang VERIFIED', () => {
    const lines = buildingSystemLines(result, traces);
    expect(lines.map((l) => l.role)).toEqual(['main', 'riser', 'fitting', 'branch', 'fitting']);
    expect(lines[0]!.size).toBe('6"');
    expect(lines[1]!.name).toBe('Riser distribusi PVC AW (2×)');
    expect(lines[2]!.size).toBe('108 m³/jam @ 47,82 m');
    expect(lines.every((l) => l.provenance !== 'VERIFIED')).toBe(true);
  });

  it('prosa dan asumsi membawa angka hasil hitungan', () => {
    const prose = buildingProse(result, 12);
    expect(prose.headline).toBe('Gedung 12 lantai: transfer PVC AW 6", 2 riser 6", 2 zona tekanan');
    expect(prose.body).toContain('3.600 orang memakai sekitar 540 m³ air per hari');
    expect(prose.body).toContain('2 lantai teratas butuh pompa booster');
    const ids = buildingAssumptions(result, traces).map((a) => a.assumptionId);
    expect(ids).toEqual(expect.arrayContaining(['OCCUPANT_AREA_10M2', 'ZONE_MAX_STATIC_4BAR']));
  });
});

describe('pipa tiap lantai di layar solusi', () => {
  it('titik air per lantai → baris induk lantai + sambungan titik, trace bagiannya sendiri', () => {
    const input = buildingWaterInputFrom(
      stateWith({
        building_floors: 12,
        floor_area: 3000,
        bathrooms_per_floor: 6,
        basins_per_floor: 4,
      }),
    )!;
    expect(input).toMatchObject({ bathroomsPerFloor: 6, basinsPerFloor: 4 });
    const result = computeBuildingWater(input);
    const traces = identify(result.traces);
    const parts = buildingTraceParts(result, traces);
    expect(parts.floor.map((t) => t.ruleId).slice(0, 4)).toEqual([
      'ENG-001',
      'ENG-003',
      'ENG-005',
      'ENG-505',
    ]);
    const lines = buildingSystemLines(result, traces);
    expect(lines.map((l) => l.name)).toEqual(
      expect.arrayContaining(['Pipa induk lantai PVC AW', 'Sambungan titik air']),
    );
    expect(lines.find((l) => l.name === 'Sambungan titik air')!.size).toBe('1/2"');
  });
});
