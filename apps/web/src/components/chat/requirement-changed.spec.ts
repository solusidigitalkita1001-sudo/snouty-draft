/**
 * Pemilik 2026-10-12: "pastiin ketika menyusun, ngitung ulang" — solusi di memori halaman dibuang
 * begitu data kebutuhan berubah, jadi yang tampil selalu hasil Susun rekomendasi yang baru.
 */
import type { RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { requirementChanged } from './chat-workspace';

const tracked = (value: unknown) => ({
  value,
  provenance: 'VERIFIED',
  source: 'user_stated',
  updatedAt: 'T',
});
const state = (bathrooms: number) =>
  ({
    building: { floors: tracked(2) },
    fixtures: { bathrooms: tracked(bathrooms) },
    water: { source: tracked('municipal') },
    subject: { kind: 'case' },
  }) as unknown as RequirementState;

describe('requirementChanged', () => {
  it('jumlah kamar mandi berubah → berubah', () => {
    expect(requirementChanged(state(2), state(3))).toBe(true);
  });
  it('hanya subjek percakapan yang berganti → tidak berubah', () => {
    const next = { ...state(2), subject: { kind: 'product', entity: 'hdpe' } } as never;
    expect(requirementChanged(state(2), next)).toBe(false);
  });
  it('asumsi diganti pengguna → berubah', () => {
    const next = { ...state(2), assumptionOverrides: { WUDHU_TAP_SPACING_0_8M: 1 } } as never;
    expect(requirementChanged(state(2), next)).toBe(true);
  });
});
