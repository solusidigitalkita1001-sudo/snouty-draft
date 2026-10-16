/**
 * P22-01: contoh rumah masuk sebagai ASUMSI bertanda contoh — kalah dari pernyataan pengguna, tampil
 * dengan alasan — dan kartu lanjutannya langsung ajakan menyusun rekomendasi.
 */
import { describe, expect, it } from 'vitest';
import { followUpCard } from '../application/message-pipeline.js';
import { houseExamplesFromRepo } from '../infrastructure/house-examples.js';
import { withCompleteness } from './completeness.js';
import { mergeRequirement, type FieldUpdate } from './context-merger.js';
import { houseExampleReason, houseExampleReply, houseExampleUserText } from './house-example.js';
import { emptyRequirementState } from './requirement-state.factory.js';

const T0 = '2026-10-16T00:00:00.000Z';
const t36 = houseExamplesFromRepo().find((e) => e.id === 'subsidi_36')!;

function applied(stated: readonly FieldUpdate[] = []) {
  const base = mergeRequirement(emptyRequirementState(T0), stated, T0).state;
  const reason = houseExampleReason(t36, 'id');
  const updates: FieldUpdate[] = t36.fields.map((f) => ({
    path: f.path,
    value: f.value,
    source: 'default_applied',
    provenance: 'ASSUMED',
    reason,
  }));
  return withCompleteness(mergeRequirement(base, updates, T0).state);
}

describe('contoh rumah subsidi tipe 36', () => {
  it('semua nilai ASUMSI beralasan "dari contoh", tidak ada yang kurang, kartu berikutnya Susun rekomendasi', () => {
    const state = applied();
    expect(state.building.floors).toMatchObject({ value: 1, provenance: 'ASSUMED' });
    expect(state.building.floors.reason).toContain('Rumah subsidi tipe 36');
    expect(state.water.source.value).toBe('rooftop_tank');
    expect(state.water.installationType.value).toBe('both');
    expect(state.building.dimensions.value).toMatchObject({ lengthM: 6, widthM: 6 });
    expect(state.missingInformation).toEqual([]);
    expect(followUpCard(state, 'id')).toMatchObject({ kind: 'cta', action: 'ANALYZE' });
  });

  it('yang sudah disebut pengguna tidak ditimpa contoh', () => {
    const state = applied([{ path: 'fixtures.bathrooms', value: 2, source: 'user_stated' }]);
    expect(state.fixtures.bathrooms).toMatchObject({ value: 2, source: 'user_stated' });
    expect(state.building.floors.value).toBe(1);
  });

  it('teks gelembung dan balasan menyebut contohnya dan cara mengubahnya, dua bahasa', () => {
    expect(houseExampleUserText(t36, 'id')).toBe('Mulai dari contoh: Rumah subsidi tipe 36');
    expect(houseExampleReply(t36, 'id')).toContain('Kalau rumah Anda berbeda, ketik saja bedanya');
    expect(houseExampleReply(t36, 'en')).toContain('press Compose recommendation');
  });
});
