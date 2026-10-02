/**
 * P4-02a — ContextMerger, inti deterministik Context Engine.
 * docs/CONTEXT_ENGINE.md §9 tes #1, #3, #4 (plus presedensi penuh).
 *
 * Tes #2 (ASSUMED selalu ber-reason) dan #8 ("Belum tahu") hidup bersama
 * default-applier (P4-04a); #5 (append-only, version monoton) bersama repo
 * snapshot (P4-06a). Di sini: aturan merge murni.
 */
import { describe, expect, it } from 'vitest';
import { mergeRequirement, type FieldUpdate } from './context-merger.js';
import { readField } from './requirement-field.js';
import { emptyRequirementState } from './requirement-state.factory.js';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T00:01:00.000Z';

function state() {
  return emptyRequirementState(T0);
}

describe('ContextMerger', () => {
  it('menuliskan nilai pengguna dengan provenance VERIFIED', () => {
    const updates: FieldUpdate[] = [
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 3, source: 'user_stated' },
    ];
    const { state: next, changed } = mergeRequirement(state(), updates, T1);

    expect(readField(next, 'building.floors')).toMatchObject({
      value: 2,
      provenance: 'VERIFIED',
      source: 'user_stated',
      updatedAt: T1,
    });
    expect(changed).toEqual(['building.floors', 'fixtures.bathrooms']);
  });

  // §9 #1 — default_applied tidak pernah menimpa user_stated
  it('tidak pernah membiarkan default menimpa nilai yang disebut pengguna', () => {
    const stated = mergeRequirement(
      state(),
      [{ path: 'water.source', value: 'pump', source: 'user_stated' }],
      T0,
    ).state;

    const afterDefault = mergeRequirement(
      stated,
      [
        {
          path: 'water.source',
          value: 'rooftop_tank',
          source: 'default_applied',
          reason: 'Sumber distribusi adalah toren atap, tanpa pompa pendorong.',
        },
      ],
      T1,
    );

    expect(readField(afterDefault.state, 'water.source').value).toBe('pump');
    expect(afterDefault.changed).toEqual([]);
  });

  it('membiarkan user_edited menimpa user_stated (presedensi lebih kuat)', () => {
    const stated = mergeRequirement(
      state(),
      [{ path: 'fixtures.bathrooms', value: 3, source: 'user_stated' }],
      T0,
    ).state;
    const edited = mergeRequirement(
      stated,
      [{ path: 'fixtures.bathrooms', value: 4, source: 'user_edited' }],
      T1,
    );
    expect(readField(edited.state, 'fixtures.bathrooms').value).toBe(4);
  });

  it('nilai yang sama kuat: yang terbaru menang (pengguna menyebut ulang)', () => {
    const first = mergeRequirement(
      state(),
      [{ path: 'building.floors', value: 2, source: 'user_stated' }],
      T0,
    ).state;
    const second = mergeRequirement(
      first,
      [{ path: 'building.floors', value: 3, source: 'user_stated' }],
      T1,
    );
    expect(readField(second.state, 'building.floors').value).toBe(3);
  });

  // §9 #4 — undefined tidak menghapus field yang sudah terisi
  it('mengabaikan update undefined — "tidak disebut di pesan ini"', () => {
    const stated = mergeRequirement(
      state(),
      [{ path: 'building.floors', value: 2, source: 'user_stated' }],
      T0,
    ).state;
    const merged = mergeRequirement(
      stated,
      [{ path: 'building.floors', value: undefined, source: 'user_stated' }],
      T1,
    );
    expect(readField(merged.state, 'building.floors').value).toBe(2);
    expect(merged.changed).toEqual([]);
  });

  // §9 #4 — null juga tidak menghapus (null dari ekstraksi = "tidak disebut")
  it('mengabaikan update null — null berarti tidak disebut, bukan dihapus', () => {
    const stated = mergeRequirement(
      state(),
      [{ path: 'fixtures.kitchens', value: 2, source: 'user_stated' }],
      T0,
    ).state;
    const merged = mergeRequirement(
      stated,
      [{ path: 'fixtures.kitchens', value: null, source: 'user_stated' }],
      T1,
    );
    expect(readField(merged.state, 'fixtures.kitchens').value).toBe(2);
  });

  // §9 #3 — "tidak ada dapur" = value 0 user_stated, bukan null
  it('menerima 0 sebagai pernyataan ketiadaan yang eksplisit', () => {
    const merged = mergeRequirement(
      state(),
      [{ path: 'fixtures.kitchens', value: 0, source: 'user_stated' }],
      T1,
    );
    const field = readField(merged.state, 'fixtures.kitchens');
    expect(field.value).toBe(0);
    expect(field.source).toBe('user_stated');
    expect(field.provenance).toBe('VERIFIED');
  });

  it('tidak memutasi state masukan (kemurnian)', () => {
    const original = state();
    const snapshot = JSON.stringify(original);
    mergeRequirement(original, [{ path: 'building.floors', value: 2, source: 'user_stated' }], T1);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
