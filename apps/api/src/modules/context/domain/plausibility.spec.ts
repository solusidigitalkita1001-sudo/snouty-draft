/** Review putaran 3, kelompok 2: kartu tanya balik, penegasan, dan catatan laporan. */
import type { RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeRequirement, type FieldUpdate } from './context-merger.js';
import { emptyRequirementState } from './requirement-state.factory.js';
import { followUpCard } from '../application/message-pipeline.js';
import { withCompleteness } from './completeness.js';
import {
  confirmOutliers,
  outlierAnswer,
  outlierAssumptions,
  pendingOutliers,
} from './plausibility.js';

const NOW = '2026-10-13T00:00:00.000Z';
const user = (path: FieldUpdate['path'], value: unknown): FieldUpdate => ({
  path,
  value,
  source: 'user_stated',
});

/** U3: 2 lantai, 2 × 2 m, 6 KM, PDAM, air bersih. */
function u3(): RequirementState {
  return withCompleteness(
    mergeRequirement(
      emptyRequirementState(NOW),
      [
        user('building.type', 'residential'),
        user('building.floors', 2),
        user('fixtures.bathrooms', 6),
        user('building.dimensions', { lengthM: 2, widthM: 2 }),
        user('water.source', 'municipal'),
        user('water.installationType', 'clean_water'),
      ],
      NOW,
    ).state,
  );
}

describe('kewajaran masukan rumah', () => {
  it('U3: tombol Susun ditahan, kartu tanya balik dengan isian ukuran', () => {
    const card = followUpCard(u3(), 'id');
    expect(card?.kind).toBe('clarification');
    if (card?.kind !== 'clarification') throw new Error('kartu');
    const question = card.questions[0]!;
    expect(question).toMatchObject({
      id: 'outlier.area_per_bathroom',
      options: ['Sudah benar'],
      allowUnknown: false,
    });
    expect(question.inputs!.length).toBe(4);
  });

  it('"Sudah benar" → ditegaskan, tombol Susun muncul, laporan tetap mencatat', () => {
    const answer = outlierAnswer({ id: 'outlier.area_per_bathroom', option: 'Sudah benar' });
    expect(answer).toEqual({ confirm: 'area_per_bathroom' });
    const confirmed = confirmOutliers(u3(), ['area_per_bathroom']);
    expect(confirmed.changed).toBe(true);
    expect(pendingOutliers(confirmed.state)).toEqual([]);
    expect(followUpCard(confirmed.state, 'id')).toEqual({ kind: 'cta', action: 'ANALYZE' });
    expect(outlierAssumptions(confirmed.state, 'id')[0]!.text).toMatch(
      /^Data di luar kewajaran, mohon diverifikasi: Bangunan 2 × 2 m 2 lantai/,
    );
    // Banner Ringkasan dan sampul laporan membaca penanda ini, bukan teksnya (putaran 4, 6b).
    expect(outlierAssumptions(confirmed.state, 'id')[0]!.needsVerification).toBe(true);
  });

  it('ukuran baru lewat kartu → pembaruan ukuran bangunan dari pengguna', () => {
    expect(
      outlierAnswer({ id: 'outlier.area_per_bathroom', option: 'lengthM=8;widthM=10' }),
    ).toEqual({
      update: {
        path: 'building.dimensions',
        value: { lengthM: 8, widthM: 10 },
        source: 'user_stated',
      },
    });
    expect(outlierAnswer({ id: 'outlier.unknown', option: 'Sudah benar' })).toBeNull();
  });

  it('data wajar → tidak ada catatan', () => {
    const fine = mergeRequirement(
      u3(),
      [user('building.dimensions', { lengthM: 8, widthM: 10 })],
      NOW,
    ).state;
    expect(pendingOutliers(fine)).toEqual([]);
    expect(outlierAssumptions(fine, 'id')).toEqual([]);
  });
});
