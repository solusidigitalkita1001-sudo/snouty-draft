/** P22-05: parameter kasus SPAM dan sewerage → masukan engine; label, highlight, dan skema. */
import { computeGravity, computeNetwork, gravitySchematic } from '@snouty/engineering';
import type { RequirementState, TechnicalParameter } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import {
  gravityHighlights,
  gravityPlanFrom,
  gravityProse,
  networkInputFrom,
} from './gravity-view.js';

const T0 = '2026-10-16T00:00:00.000Z';

function technical(caseId: string, values: Record<string, number>): RequirementState {
  const parameters: Record<string, TechnicalParameter> = {};
  for (const [key, value] of Object.entries(values)) {
    parameters[key] = {
      key,
      value,
      origin: 'known',
      source: String(value),
    } as unknown as TechnicalParameter;
  }
  return { ...emptyRequirementState(T0), useCase: { kind: 'technical', caseId, parameters } };
}

describe('sewerage', () => {
  it('sambungan rumah → masukan sewer; jiwa saja juga cukup; tanpa keduanya dan tanpa debit → null', () => {
    const plan = gravityPlanFrom(
      technical('sewerage', { number_of_connections: 200, route_length: 1500 }),
    );
    expect(plan).toMatchObject({ input: { kind: 'sewer', connections: 200 }, pipeLengthM: 1500 });
    const byPeople = gravityPlanFrom(technical('sewerage', { number_of_occupants: 1000 }));
    expect(byPeople?.input).toMatchObject({ kind: 'sewer', population: 1000 });
    expect(gravityPlanFrom(technical('sewerage', { route_length: 500 }))).toBeNull();
  });

  it('judul, highlight, dan skema menyebut jaringan air limbah, sambungan, dan ukuran minimum', () => {
    const plan = gravityPlanFrom(
      technical('sewerage', { number_of_connections: 200, route_length: 1500 }),
    )!;
    const result = computeGravity(plan.input, 'id');
    const prose = gravityProse(result, 'id');
    expect(prose.headline).toMatch(/^Jaringan air limbah: pipa PVC D 6"/);
    expect(prose.body).toContain('Air limbah dari 200 sambungan rumah');
    expect(prose.body).toContain('minimal 6"');
    expect(prose.body).toContain('Pada debit rencana pipa terisi');
    expect(prose.body).toContain('manhole sekitar');
    const highlights2 = gravityHighlights(result, 2, 'id');
    expect(highlights2.some((h) => h.label === 'Manhole')).toBe(true);
    const highlights = gravityHighlights(result, 2, 'id');
    expect(highlights[0]).toEqual({ label: 'Sambungan rumah', value: '200 SR' });
    const schematic = gravitySchematic({ pipeLengthM: 1500 }, result, 'erp-2026-10-06', 'id');
    expect(JSON.stringify(schematic)).toContain('SK-08 AIR LIMBAH');
    expect(JSON.stringify(schematic)).toContain('IPAL / PENGOLAHAN');
  });
});

describe('water_supply_network (SPAM)', () => {
  it('SR, panjang, beda tinggi → masukan jaringan berjenis air minum; jiwa menggantikan SR', () => {
    const input = networkInputFrom(
      technical('water_supply_network', {
        number_of_connections: 500,
        route_length: 2000,
        static_head: 20,
      }),
    );
    expect(input).toMatchObject({ kind: 'water_supply', connections: 500, routeLengthM: 2000 });
    const byPeople = networkInputFrom(
      technical('water_supply_network', {
        number_of_occupants: 2000,
        route_length: 3000,
        static_head: 15,
      }),
    );
    expect(byPeople).toMatchObject({ kind: 'water_supply', population: 2000 });
    expect(byPeople?.connections).toBeUndefined();
    expect(computeNetwork(byPeople!).connections).toBe(400);
  });

  it('cluster tidak berubah: jenis cluster, jiwa tidak dibaca', () => {
    const input = networkInputFrom(
      technical('residential_cluster', {
        number_of_occupants: 400,
        route_length: 300,
        static_head: 10,
      }),
    );
    expect(input).toBeNull();
    const withUnits = networkInputFrom(
      technical('residential_cluster', {
        number_of_connections: 120,
        route_length: 300,
        static_head: 10,
      }),
    );
    expect(withUnits).toMatchObject({ kind: 'cluster', connections: 120 });
  });
});

describe('audit PDAM 2026-10-16: bahan pilihan dan angka pengguna dipertahankan', () => {
  it('HDPE dipilih → masukan jaringan membawa HDPE; PVC → PVC; tanpa pilihan → aturan panjang jalur', async () => {
    const { networkFamilyOf } = await import('./flow-schematic.js');
    const base = { number_of_connections: 500, route_length: 150, static_head: 20 };
    const hdpe = networkInputFrom({
      ...technical('water_supply_network', base),
      useCase: {
        kind: 'technical',
        caseId: 'water_supply_network',
        parameters: {
          ...(
            technical('water_supply_network', base).useCase as {
              parameters: Record<string, unknown>;
            }
          ).parameters,
          material: {
            key: 'material',
            value: 'HDPE',
            origin: 'known',
            source: 'HDPE',
            label: 'Bahan',
          },
        },
      },
    } as unknown as RequirementState)!;
    expect(hdpe.material).toBe('HDPE');
    expect(networkFamilyOf(hdpe)).toBe('HDPE');
    const none = networkInputFrom(technical('water_supply_network', base))!;
    expect(none.material).toBeUndefined();
    // 150 m tanpa pilihan: aturan panjang → PVC AW; 1 500 m → HDPE.
    expect(networkFamilyOf(none)).toBe('PVC AW');
    expect(networkFamilyOf({ ...none, routeLengthM: 1500 })).toBe('HDPE');
    const pvc = { ...none, material: 'PVC' as const };
    expect(networkFamilyOf({ ...pvc, routeLengthM: 1500 })).toBe('PVC AW');
  });
});
