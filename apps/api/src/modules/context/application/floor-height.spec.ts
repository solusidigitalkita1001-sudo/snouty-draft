/**
 * TC-H-02 / TC-G-01 (tes live 12 Okt 2026): tinggi lantai dari kalimat terbaca, nilai di luar
 * 2–10 m ditanyakan balik dan tidak dihitung, nilai dalam rentang dipakai sebagai data pengguna.
 */
import { CaseInputInvalidError } from '@snouty/engineering';
import { DEFAULT_LOCALE, type Recommendation, type RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { AnalysisService } from '../../recommendation/application/analysis.service.js';
import type { TraceToSave } from '../../recommendation/domain/recommendation.repository.js';
import { answerToUpdate } from '../domain/clarification.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { extractionToUpdates } from './extraction-to-updates.js';
import { followUpCard } from './message-pipeline.js';

const T0 = '2026-10-12T07:20:00.000Z';
const stateOf = (message: string): RequirementState =>
  withCompleteness(
    mergeRequirement(emptyRequirementState(T0), extractionToUpdates({}, message), T0).state,
  );

async function analyse(state: RequirementState) {
  let saved: { rec: Recommendation; traces: readonly TraceToSave[] } | null = null;
  const service = new AnalysisService(
    { findVersionById: async () => null } as never,
    {
      save: async (rec: Recommendation, traces: readonly TraceToSave[]) => {
        saved = { rec, traces };
      },
    } as never,
    { markSolutionReady: async () => undefined } as never,
    null,
    {
      activeVersion: async () =>
        ({ id: 'V'.repeat(26), label: 'x', kind: 'pralon', status: 'active' }) as never,
      listProducts: async () => ({ items: [], nextCursor: null }),
      candidatesFor: async () => [],
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), state, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

describe('TC-H-02 · tinggi lantai dari kalimat', () => {
  it('TC-H-02a / TC-G-01: 11 m terbaca, ditanya balik dengan isian angka, tidak ada tombol susun, analisis ditolak', async () => {
    const state = stateOf(
      'Rumah 2 lantai, tinggi tiap lantai 11 m, 2 kamar mandi, PDAM, air bersih',
    );
    expect(state.building.floorHeightM.value).toBe(11);
    expect(state.missingInformation).toEqual(['building.floorHeightM']);
    const card = followUpCard(state, DEFAULT_LOCALE);
    expect(card?.kind).toBe('clarification');
    const question = card?.kind === 'clarification' ? card.questions[0]! : null;
    expect(question).toMatchObject({ id: 'building.floorHeightM', options: [] });
    expect(question!.inputs![0]).toMatchObject({ min: 2, max: 10, unit: 'm' });
    // Tidak pernah dihitung dengan 3,5 m.
    await expect(analyse(state)).rejects.toBeInstanceOf(CaseInputInvalidError);
  });

  it('jawaban kartu: 4 m diterima, 11 m ditolak (bukan tebakan)', () => {
    const answer = (option: string) =>
      answerToUpdate({ id: 'building.floorHeightM', option }, () => null);
    expect(answer('value=4')).toEqual({
      path: 'building.floorHeightM',
      value: 4,
      source: 'user_stated',
    });
    expect(answer('value=11')).toBeNull();
  });

  it('TC-H-02b: 4 m dipakai sebagai data pengguna; beda tinggi PDAM = 4 + 2 = 6 m; tanpa asumsi 3,5 m', async () => {
    const state = stateOf(
      'Rumah 2 lantai, tinggi tiap lantai 4 m, 2 kamar mandi, PDAM, air bersih',
    );
    expect(state.building.floorHeightM).toMatchObject({ value: 4, source: 'user_stated' });
    expect(state.missingInformation).toEqual([]);
    const { rec, traces } = await analyse(state);
    expect(traces.some((t) => t.ruleId === 'ENG-004')).toBe(false);
    const route = traces.find((t) => t.ruleId === 'ENG-702')!;
    expect((route.output as { staticHeadM: number }).staticHeadM).toBe(6);
    expect(rec.assumptions.map((a) => a.text).join(' ')).not.toContain('3.5');
    expect(rec.assumptions.map((a) => a.text).join(' ')).not.toContain('3,5');
  });

  it('TC-H-02c: "floor height 3.8 m" terbaca', () => {
    expect(
      stateOf('2 storey house, floor height 3.8 m, 2 bathrooms, municipal water, clean water')
        .building.floorHeightM.value,
    ).toBe(3.8);
    expect(stateOf('rumah 2 lantai, tinggi lantai 3,8 meter').building.floorHeightM.value).toBe(
      3.8,
    );
  });

  it('angka lain tanpa "tinggi … lantai" tidak dibaca sebagai tinggi lantai', () => {
    expect(
      stateOf('rumah 2 lantai, jalur 11 m, 2 kamar mandi').building.floorHeightM.value,
    ).toBeNull();
  });
});
