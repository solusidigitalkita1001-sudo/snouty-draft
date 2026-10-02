/**
 * P4-10a — bentuk event SSE sesuai kontrak; edit inline nol panggilan LLM (§9 #9);
 * ekstraksi gagal → klarifikasi, bukan giliran jatuh.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AiService } from '../../ai/domain/ai.port.js';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import type { Extraction } from '../../ai/domain/extraction-schema.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { applyEdit, runUnderstanding, type PipelineInput } from './message-pipeline.js';
import type { RoutingDecision } from './intent-router.js';

const T0 = '2026-01-01T00:00:00.000Z';

const extractDecision: RoutingDecision = {
  intent: 'REQUIREMENT_STATEMENT',
  confidence: 0.9,
  shouldExtract: true,
  mutatesState: false,
};

function aiExtracting(extraction: Extraction): AiService {
  return {
    extract: vi.fn(() => Promise.resolve(extraction)),
    classifyIntent: vi.fn(),
    titleFor: vi.fn(),
  } as unknown as AiService;
}

function input(over: Partial<PipelineInput> = {}): PipelineInput {
  return {
    messageId: '01JBMESSAGE00000000000000AB',
    message: 'rumah 2 lantai, 3 kamar mandi',
    decision: extractDecision,
    state: emptyRequirementState(T0),
    now: T0,
    ...over,
  };
}

describe('runUnderstanding — bentuk event SSE', () => {
  it('data tidak lengkap: start → stage active → requirement.updated → stage done → card clarification → end', async () => {
    const ai = aiExtracting({ building: { floors: 2 }, fixtures: { bathrooms: 3 } });
    const { events } = await runUnderstanding(ai, input());

    expect(events.map((e) => e.type)).toEqual([
      'message.start',
      'stage',
      'requirement.updated',
      'stage',
      'card',
      'message.end',
    ]);
    const active = events[1] as { stage: string; status: string };
    expect(active).toMatchObject({ stage: 'UNDERSTANDING', status: 'active' });
    const done = events[3] as { status: string; detail: string };
    expect(done.status).toBe('done');
    expect(done.detail).toBe('2 DATA');
    const card = events[4] as { card: { kind: string } };
    expect(card.card.kind).toBe('clarification');
  });

  it('data inti lengkap: kartu CTA ANALYZE, bukan klarifikasi', async () => {
    const ai = aiExtracting({
      building: { floors: 2 },
      fixtures: { bathrooms: 3 },
      water: { source: 'rooftop_tank', installationType: 'clean_water' },
    });
    const { events, nextState } = await runUnderstanding(ai, input());
    const card = events.find((e) => e.type === 'card') as {
      card: { kind: string; action?: string };
    };
    expect(card.card.kind).toBe('cta');
    expect(card.card.action).toBe('ANALYZE');
    expect(nextState.missingInformation).toEqual([]);
  });

  it('ekstraksi tidak valid → stage failed + klarifikasi, giliran tidak jatuh', async () => {
    const ai = {
      extract: vi.fn(() => Promise.reject(new AiOutputInvalidError('extraction', 'x'))),
      classifyIntent: vi.fn(),
      titleFor: vi.fn(),
    } as unknown as AiService;

    const { events, changed } = await runUnderstanding(ai, input());
    const types = events.map((e) => e.type);
    expect(types).toContain('message.end'); // tidak melempar
    const failed = events.find(
      (e) => e.type === 'stage' && (e as { status: string }).status === 'failed',
    );
    expect(failed).toBeDefined();
    expect(changed).toBe(false);
  });

  it('intent yang tidak mengekstrak: hanya start + end (diserahkan ke fase berikut)', async () => {
    const ai = aiExtracting({});
    const decision: RoutingDecision = {
      intent: 'EXPLANATION_REQUEST',
      confidence: 0.9,
      shouldExtract: false,
      mutatesState: false,
    };
    const { events } = await runUnderstanding(ai, input({ decision }));
    expect(events.map((e) => e.type)).toEqual(['message.start', 'message.end']);
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe('applyEdit — nol panggilan LLM (§9 #9)', () => {
  it('menggabungkan edit sebagai user_edited tanpa menyentuh AiService', () => {
    const base = withCompleteness(
      mergeRequirement(
        emptyRequirementState(T0),
        [{ path: 'fixtures.bathrooms', value: 3, source: 'user_stated' }],
        T0,
      ).state,
    );
    const { state, changed } = applyEdit(base, [{ path: 'fixtures.bathrooms', value: 4 }], T0);
    expect(state.fixtures.bathrooms.value).toBe(4);
    expect(state.fixtures.bathrooms.source).toBe('user_edited');
    expect(changed).toBe(true);
    // Tidak ada parameter AiService sama sekali — jaminan struktural, bukan janji.
    expect(applyEdit.length).toBe(3);
  });
});
