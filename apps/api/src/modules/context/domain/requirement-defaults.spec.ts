/**
 * P4-04a — default "Belum tahu" + kartu asumsi.
 * CONTEXT_ENGINE §9 #2 (ASSUMED selalu ber-reason, muncul di kartu) & #8.
 */
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from './context-merger.js';
import { assumptionCard, defaultUpdateFor, REQUIREMENT_DEFAULTS } from './requirement-defaults.js';
import { fieldEntries, readField } from './requirement-field.js';
import { emptyRequirementState } from './requirement-state.factory.js';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:01:00.000Z';

describe('default "Belum tahu"', () => {
  // §9 #8 — default diterapkan, ditandai ASSUMED, muncul di kartu asumsi
  it('menerapkan default sebagai ASSUMED dengan reason, lalu muncul di kartu', () => {
    const update = defaultUpdateFor('water.source')!;
    const { state } = mergeRequirement(emptyRequirementState(T0), [update], T1);

    const field = readField(state, 'water.source');
    expect(field).toMatchObject({
      value: 'rooftop_tank',
      provenance: 'ASSUMED',
      source: 'default_applied',
      reason: 'Sumber distribusi adalah toren atap, tanpa pompa pendorong.',
      ruleId: 'ENG-014',
    });

    const card = assumptionCard(fieldEntries(state));
    expect(card).toContainEqual({
      path: 'water.source',
      reason: 'Sumber distribusi adalah toren atap, tanpa pompa pendorong.',
      ruleId: 'ENG-014',
    });
  });

  it('default tidak menimpa nilai yang sudah disebut pengguna', () => {
    const stated = mergeRequirement(
      emptyRequirementState(T0),
      [{ path: 'water.source', value: 'pump', source: 'user_stated' }],
      T0,
    ).state;
    const { state } = mergeRequirement(stated, [defaultUpdateFor('water.source')!], T1);
    const field = readField(state, 'water.source');
    expect(field.value).toBe('pump');
    expect(field.provenance).toBe('VERIFIED');
  });

  it('field tanpa default mengembalikan null (dimensions → BOM ESTIMATED, bukan diisi)', () => {
    expect(defaultUpdateFor('building.dimensions')).toBeNull();
  });

  // §9 #2 — tidak ada field ASSUMED tanpa reason
  it('setiap default membawa reason (invarian TV-1)', () => {
    for (const def of REQUIREMENT_DEFAULTS) {
      expect(def.reason.length).toBeGreaterThan(0);
    }
  });

  it('kartu asumsi menolak field ASSUMED tanpa reason', () => {
    const entries = [
      [
        'water.source',
        { value: 'pump', provenance: 'ASSUMED', source: 'default_applied', updatedAt: T0 },
      ],
    ] as const;
    expect(() => assumptionCard(entries)).toThrow(/TV-1/);
  });

  it('kartu asumsi mengabaikan field VERIFIED', () => {
    const stated = mergeRequirement(
      emptyRequirementState(T0),
      [{ path: 'building.floors', value: 2, source: 'user_stated' }],
      T0,
    ).state;
    expect(assumptionCard(fieldEntries(stated))).toEqual([]);
  });
});
