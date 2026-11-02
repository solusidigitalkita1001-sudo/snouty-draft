/**
 * Pesan pembuka tanpa satu pun fakta: ajakan bertanya ditulis kode, bukan model (P32-01).
 *
 * Diukur di produksi 2026-11-02 — jalur ini memanggil model tanpa DATA, dan pagar prosa yang
 * memeriksa angka/merek/struktur tidak bisa membantah kalimat yang tidak memuat angka: pertanyaan
 * sprinkler dijawab 77,5 detik dengan cerita tentang penggunanya sendiri dan batas Pralon yang
 * dikarang, pertanyaan septic tank 40,4 detik dengan kalimat yang berbunyi seperti bot.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({ LLM_CHAT_REPLY: true, LLM_STRUCTURED_RETRY: false, LLM_SOLUTION_PROSE: false }),
}));
import type { AiService } from '../../ai/domain/ai.port.js';
import type { ReplyWriter } from './reply-writer.js';
import type { RoutingDecision } from './intent-router.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { understood } from '../../understanding/testing/understood.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';

const T0 = '2026-11-02T00:00:00.000Z';
const decision: RoutingDecision = {
  intent: 'REQUIREMENT_STATEMENT',
  confidence: 0.9,
  shouldExtract: true,
  mutatesState: false,
};

function aiWithoutFacts(): AiService {
  return {
    extract: vi.fn(() => Promise.resolve({ building: {}, fixtures: {}, water: {} })),
    classifyIntent: vi.fn(),
    titleFor: vi.fn(),
    writeProse: vi.fn(() => Promise.resolve(null)),
  } as unknown as AiService;
}

function writer() {
  const write = vi.fn(() => Promise.resolve({ text: 'prosa model', source: 'llm' as const }));
  return { reply: { write } as unknown as ReplyWriter, write };
}

const input = (message: string, locale?: 'id' | 'en'): PipelineInput => ({
  messageId: '01JBMESSAGE00000000000000AB',
  message,
  decision,
  state: emptyRequirementState(T0),
  now: T0,
  ...(locale ? { locale } : {}),
});

describe('pembuka tanpa DATA (P32-01)', () => {
  it('pesan tanpa fakta dijawab ajakan bertanya tanpa memanggil model', async () => {
    for (const message of [
      'mau pasang sprinkler kebakaran, pipanya pralon ada?',
      'septic tank biofil ada?',
      'minta penawaran harga 500 batang aw 4 inci, kirim ke proyek cikarang',
      'mau nanya2 dong',
    ]) {
      const { reply, write } = writer();
      const { events } = await runUnderstanding(aiWithoutFacts(), input(message), reply);
      expect(write).not.toHaveBeenCalled();
      const token = events.find((e) => e.type === 'token') as { text: string } | undefined;
      expect(token?.text).toContain('Silakan, tanyakan saja');
    }
  });

  // Produksi 2026-11-02: "ok lanjut" di percakapan kosong 25,9 detik, jawabannya menanyakan hal
  // yang sama dengan perkenalan yang sudah ada.
  it('lanjutan di percakapan kosong dijawab perkenalan tanpa model', async () => {
    const { reply, write } = writer();
    const { events } = await runUnderstanding(
      aiWithoutFacts(),
      {
        ...input('ok lanjut'),
        decision: {
          intent: 'OUT_OF_SCOPE',
          confidence: 1,
          shouldExtract: false,
          mutatesState: false,
        },
        understanding: understood('ok lanjut', { intent: 'follow_up_continue' }),
      },
      reply,
    );
    expect(write).not.toHaveBeenCalled();
    const token = events.find((e) => e.type === 'token') as { text: string } | undefined;
    expect(token?.text).toContain('SNOUTY');
  });

  it('bahasa Inggris memakai ajakan bertanya bahasa Inggris, juga tanpa model', async () => {
    const { reply, write } = writer();
    const { events } = await runUnderstanding(
      aiWithoutFacts(),
      input('do you supply fire sprinkler pipe?', 'en'),
      reply,
    );
    expect(write).not.toHaveBeenCalled();
    const token = events.find((e) => e.type === 'token') as { text: string } | undefined;
    expect(token?.text).toContain('Go ahead and ask');
  });
});
