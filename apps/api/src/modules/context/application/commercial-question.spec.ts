/**
 * Penawaran, pengiriman, minimum order, garansi, dan klaim (P32-03): dikatakan apa adanya bahwa
 * angkanya ada di tim Pralon, lalu kartu yang menghubungkan — tanpa model, tanpa kuliah umur pakai.
 *
 * Produksi 2026-11-02: "garansi pipa pralon berapa lama" dijawab bahwa harga tidak ditampilkan,
 * "pipa pralon gw pecah baru 2 taun, garansi gimana" dijawab penjelasan umur pakai (contoh
 * "garansi pipa berapa lama?" memang tertulis di topik umur pakai — sekarang tidak lagi), dan
 * permintaan penawaran 500 batang dijawab ajakan bertanya setelah menunggu 42,5 detik.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({ LLM_CHAT_REPLY: true, LLM_STRUCTURED_RETRY: false, LLM_SOLUTION_PROSE: false }),
}));
import type { AiService } from '../../ai/domain/ai.port.js';
import type { ReplyWriter } from './reply-writer.js';
import { IntentRouter, type RoutingDecision } from './intent-router.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { understood } from '../../understanding/testing/understood.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';

const T0 = '2026-11-02T00:00:00.000Z';
const decision: RoutingDecision = {
  intent: 'OUT_OF_SCOPE',
  confidence: 1,
  shouldExtract: false,
  mutatesState: false,
};

function writer() {
  const write = vi.fn(() => Promise.resolve({ text: 'prosa model', source: 'llm' as const }));
  return { reply: { write } as unknown as ReplyWriter, write };
}

const input = (message: string): PipelineInput => ({
  messageId: '01JBMESSAGE00000000000000AB',
  message,
  decision,
  state: emptyRequirementState(T0),
  now: T0,
  understanding: understood(message, { intent: 'commercial_question' }),
});

describe('pertanyaan komersial dan purna jual', () => {
  it('dijawab tim Pralon beserta kartu sales, tanpa memanggil model', async () => {
    for (const message of [
      'garansi pipa pralon berapa lama',
      'minta penawaran harga 500 batang aw 4 inci, kirim ke proyek cikarang',
      'minimum order berapa batang?',
    ]) {
      const { reply, write } = writer();
      const { events, changed } = await runUnderstanding(null, input(message), reply);
      expect(write).not.toHaveBeenCalled();
      const token = events.find((e) => e.type === 'token') as { text: string } | undefined;
      expect(token?.text).toContain('tim Pralon');
      expect(token?.text).toContain('garansi');
      const card = events.find((e) => e.type === 'card') as
        | { card: { kind: string; action?: string } }
        | undefined;
      expect(card?.card).toEqual({ kind: 'cta', action: 'CONTACT_SALES' });
      expect(changed).toBe(false);
    }
  });

  it('dirutekan tanpa model, dan lebih dulu daripada topik pengetahuan', async () => {
    const ai = { classifyIntent: vi.fn() } as unknown as AiService;
    const router = new IntentRouter(ai);
    const routed = await router.route(
      understood('pipa pralon saya pecah baru 2 tahun, garansi gimana', {
        intent: 'commercial_question',
        knowledgeTopics: ['umur pakai'],
      }),
      false,
    );
    expect(routed.intent).toBe('OUT_OF_SCOPE');
    expect(routed.shouldExtract).toBe(false);
    expect(ai.classifyIntent).not.toHaveBeenCalled();
  });
});
