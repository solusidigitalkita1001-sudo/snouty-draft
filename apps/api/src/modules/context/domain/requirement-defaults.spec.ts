/**
 * P4-04a — default "Belum tahu" + kartu asumsi.
 * CONTEXT_ENGINE §9 #2 (ASSUMED selalu ber-reason, muncul di kartu) & #8.
 */
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from './context-merger.js';
import { withCompleteness } from './completeness.js';
import {
  assumptionCard,
  defaultUpdateFor,
  assumableUpdates,
  houseAssumptionUpdates,
  REQUIREMENT_DEFAULTS,
} from './requirement-defaults.js';
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

describe('kartu asumsi dwibahasa', () => {
  const update = defaultUpdateFor('water.source')!;
  const { state } = mergeRequirement(emptyRequirementState(T0), [update], T1);

  it('id tetap kalimat tabel; en memakai kalimat Inggris dengan path dan ruleId sama', () => {
    expect(assumptionCard(fieldEntries(state), 'id')).toEqual(assumptionCard(fieldEntries(state)));
    expect(assumptionCard(fieldEntries(state), 'en')).toContainEqual({
      path: 'water.source',
      reason: 'The distribution source is a rooftop tank, with no booster pump.',
      ruleId: 'ENG-014',
    });
  });
});

describe('hitung dulu + anggapan rumah (pemilik 2026-10-20)', () => {
  const house = (floors: number | null, bathrooms: number | null) => {
    const updates = [
      { path: 'building.type' as const, value: 'residential', source: 'user_stated' as const },
      ...(floors === null
        ? []
        : [{ path: 'building.floors' as const, value: floors, source: 'user_stated' as const }]),
      ...(bathrooms === null
        ? []
        : [
            {
              path: 'fixtures.bathrooms' as const,
              value: bathrooms,
              source: 'user_stated' as const,
            },
          ]),
    ];
    return withCompleteness(mergeRequirement(emptyRequirementState(T0), updates, T1).state);
  };

  it('lantai disebut: kamar mandi 1 per lantai, toren atap, air bersih — semuanya ASSUMED ber-reason', () => {
    const updates = houseAssumptionUpdates(house(3, null));
    expect(updates.map((u) => [u.path, u.value])).toEqual(
      [
        ['water.source', 'rooftop_tank'],
        ['water.installationType', 'clean_water'],
        ['fixtures.bathrooms', 3],
      ].sort(
        (a, b) =>
          updates.findIndex((u) => u.path === a[0]) - updates.findIndex((u) => u.path === b[0]),
      ),
    );
    for (const u of updates) expect(u).toMatchObject({ provenance: 'ASSUMED', ruleId: 'ENG-014' });
    expect(updates.find((u) => u.path === 'fixtures.bathrooms')!.reason).toBe(
      'Jumlah kamar mandi diasumsikan 1 per lantai.',
    );
  });

  it('lantai belum disebut: tanpa anggapan — yang kurang ditanyakan', () => {
    expect(houseAssumptionUpdates(house(null, 2))).toEqual([]);
  });

  // Produksi 2026-10-26: ruko 3 lantai, 3 toilet, PDAM, toren atap — yang kurang hanya jenis
  // instalasi, dan "udah, itung aja" mendapat pertanyaan yang sama persis dua kali.
  it('ruko: anggapan sama tersedia untuk jenis bangunan selain rumah tinggal', () => {
    const ruko = withCompleteness(
      mergeRequirement(
        emptyRequirementState(T0),
        [
          {
            path: 'building.type' as const,
            value: 'light_commercial',
            source: 'user_stated' as const,
          },
          { path: 'building.floors' as const, value: 3, source: 'user_stated' as const },
          { path: 'fixtures.bathrooms' as const, value: 3, source: 'user_stated' as const },
          { path: 'water.source' as const, value: 'rooftop_tank', source: 'user_stated' as const },
        ],
        T1,
      ).state,
    );

    expect(houseAssumptionUpdates(ruko)).toEqual([]);
    expect(assumableUpdates(ruko).map((u) => [u.path, u.value])).toEqual([
      ['water.installationType', 'clean_water'],
    ]);
    for (const u of assumableUpdates(ruko)) expect(u.provenance).toBe('ASSUMED');
  });

  it('"Belum tahu" kamar mandi: jumlah lantai bila diketahui, tanpa lantai tetap kosong', () => {
    expect(defaultUpdateFor('fixtures.bathrooms', house(2, null))).toMatchObject({ value: 2 });
    expect(defaultUpdateFor('fixtures.bathrooms', house(null, null))).toBeNull();
    expect(defaultUpdateFor('fixtures.bathrooms')).toBeNull();
  });
});
