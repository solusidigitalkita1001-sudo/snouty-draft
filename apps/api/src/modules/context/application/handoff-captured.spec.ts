/**
 * P31-73: kebutuhan yang dibawa ke kartu serah terima menyebut alat yang benar. Sekolah dengan
 * 24 toilet pernah muncul sebagai "48 titik: shower + kloset" — toilet umum tidak berisi shower,
 * dan laporannya sudah menulis "kloset + keran" sejak P22. Keduanya sekarang satu sumber.
 */
import { DEFAULT_LOCALE, type RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from '../domain/context-merger.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { capturedFrom } from './message-pipeline.js';

const T0 = '2026-10-27T03:00:00.000Z';
const stateOf = (paths: Array<[string, unknown]>): RequirementState =>
  mergeRequirement(
    emptyRequirementState(T0),
    paths.map(([path, value]) => ({ path: path as never, value, source: 'user_stated' as const })),
    T0,
  ).state;

const bathroomRow = (state: RequirementState): string | undefined =>
  capturedFrom(state, DEFAULT_LOCALE).find((r) => r.label === 'Kamar mandi')?.value;

describe('kebutuhan yang dibawa ke kartu serah terima', () => {
  it('sekolah: 24 toilet = 48 titik kloset dan keran, tanpa shower', () => {
    const state = stateOf([
      ['building.type', 'public_building'],
      ['building.floors', 3],
      ['fixtures.bathrooms', 24],
    ]);
    expect(bathroomRow(state)).toBe('24 ruang (48 titik: kloset + keran)');
  });

  it('masjid: sama seperti sekolah', () => {
    const state = stateOf([
      ['building.type', 'place_of_worship'],
      ['fixtures.bathrooms', 4],
    ]);
    expect(bathroomRow(state)).toBe('4 ruang (8 titik: kloset + keran)');
  });

  it('rumah: kamar mandi tetap shower dan kloset', () => {
    const state = stateOf([
      ['building.type', 'residential'],
      ['fixtures.bathrooms', 3],
    ]);
    expect(bathroomRow(state)).toBe('3 ruang (6 titik: shower + kloset)');
  });
});
