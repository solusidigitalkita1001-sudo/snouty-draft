/** P22-03: baris "Pekerjaan" di panel kanan — pilihan boolean yang dikirim sebagai boolean. */
import type { RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { requirementRows } from './requirement-rows';

const tracked = <T>(value: T | null) => ({
  value,
  provenance: value === null ? ('UNAVAILABLE' as const) : ('VERIFIED' as const),
  source: 'user_stated' as const,
  updatedAt: '2026-10-16T00:00:00.000Z',
});

const base = {
  version: 1,
  intent: 'REQUIREMENT_STATEMENT',
  building: {
    type: tracked('residential'),
    floors: tracked(1),
    floorHeightM: tracked(null),
    dimensions: tracked(null),
  },
  fixtures: {
    bathrooms: tracked(1),
    basins: tracked(0),
    kitchens: tracked(1),
    outletCount: tracked(null),
  },
  water: {
    source: tracked('rooftop_tank'),
    installationType: tracked('both'),
    boosterPump: tracked(null),
  },
  missingInformation: [],
  completeness: { filled: 4, required: 4 },
} as unknown as RequirementState;

describe('baris Pekerjaan', () => {
  it('tampil sebagai pilihan boolean bila state punya field-nya', () => {
    const state = {
      ...base,
      water: { ...base.water, replaceExisting: tracked(true) },
    } as RequirementState;
    const row = requirementRows(state).find((r) => r.path === 'water.replaceExisting')!;
    expect(row.display).toBe('Ganti pipa lama');
    expect(row.raw).toBe(true);
    expect(row.editor).toMatchObject({ kind: 'select', boolean: true });
    expect(row.editor.kind === 'select' && row.editor.options.map((o) => o.label)).toEqual([
      'Instalasi baru',
      'Ganti pipa lama',
    ]);
  });

  it('state lama tanpa field → tidak ada baris', () => {
    expect(requirementRows(base).some((r) => r.path === 'water.replaceExisting')).toBe(false);
  });
});
