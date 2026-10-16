/**
 * P22-02: pertanyaan bentuk sistem pipa ("arah pipanya gimana", "fitting apa saja") membawa gambar
 * potongan instalasi — hanya bila solusinya sudah dihitung dan masih berlaku.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AiService } from '../../ai/domain/ai.port.js';
import { understood } from '../../understanding/testing/understood.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import type { ActiveSolution } from '../domain/active-solution.port.js';
import { drawingCardFor, runUnderstanding } from './message-pipeline.js';

const T0 = '2026-10-16T00:00:00.000Z';
const needs = [
  { kind: 'building', count: 1, building: { type: 'residential', floors: 1, floorHeightM: 3.5 } },
  { kind: 'rooftop_tank', count: 1 },
] as const;
const solution = {
  recommendation: {
    needs,
    systemLines: [],
    bom: [],
  } as unknown as ActiveSolution['recommendation'],
  stale: false,
} satisfies ActiveSolution;

describe('drawingCardFor', () => {
  it('pertanyaan bentuk sistem + solusi berlaku → kartu gambar dengan kebutuhan yang sama', () => {
    expect(drawingCardFor('system_layout_question', solution)).toEqual({ kind: 'drawing', needs });
  });

  it('tanpa solusi, solusi usang, atau pertanyaan lain → tidak ada gambar', () => {
    expect(drawingCardFor('system_layout_question', null)).toBeNull();
    expect(drawingCardFor('system_layout_question', { ...solution, stale: true })).toBeNull();
    expect(drawingCardFor('explanation_request', solution)).toBeNull();
    expect(
      drawingCardFor('system_layout_question', {
        recommendation: {} as ActiveSolution['recommendation'],
        stale: false,
      }),
    ).toBeNull();
  });
});

describe('runUnderstanding — pertanyaan bentuk sistem pipa', () => {
  const state = withCompleteness(
    mergeRequirement(
      emptyRequirementState(T0),
      [
        { path: 'building.floors', value: 1, source: 'user_stated' },
        { path: 'fixtures.bathrooms', value: 1, source: 'user_stated' },
        { path: 'water.source', value: 'rooftop_tank', source: 'user_stated' },
      ],
      T0,
    ).state,
  );
  const noModel = {
    extract: vi.fn(() => Promise.resolve({})),
    classifyIntent: vi.fn(),
    titleFor: vi.fn(),
    writeProse: vi.fn(() => Promise.resolve(null)),
  } as unknown as AiService;

  it('balasan teks diikuti kartu gambar sebelum giliran ditutup', async () => {
    const result = await runUnderstanding(noModel, {
      messageId: 'M'.repeat(26),
      message: 'arah jalur pipanya gimana?',
      decision: {
        intent: 'EXPLANATION_REQUEST',
        confidence: 1,
        shouldExtract: false,
        mutatesState: false,
      },
      state,
      now: T0,
      understanding: understood('arah jalur pipanya gimana?', { intent: 'system_layout_question' }),
      solution,
    });
    const types = result.events.map((e) => e.type);
    expect(types).toEqual(['message.start', 'token', 'card', 'message.end']);
    const card = result.events.find((e) => e.type === 'card');
    expect(card).toMatchObject({ card: { kind: 'drawing' } });
  });
});
