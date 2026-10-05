/**
 * Model yang terkonfigurasi tetapi tidak terjangkau diperlakukan seperti tanpa model:
 * event LLM_UNAVAILABLE yang retryable, pesan pengguna tetap tersimpan, giliran tidak
 * jatuh menjadi 503. Ditemukan live 2026-10-05 dengan kunci OpenRouter berlimit $0.
 */
import { describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import { MessageService } from './message.service.js';

const ACTOR = { kind: 'guest', id: 'G'.repeat(26), tier: 'guest', roles: [] } as const;

function serviceWith(router: { route: () => Promise<unknown> }) {
  const conversations = {
    find: vi.fn(async () => ({})),
    messages: vi.fn(async () => []),
    appendUserMessage: vi.fn(async () => undefined),
    appendAssistantMessage: vi.fn(async () => undefined),
  };
  const store = { current: vi.fn(async () => null), append: vi.fn(async () => undefined) };
  const ai = { classifyIntent: vi.fn() };
  const service = new MessageService(
    conversations as never,
    store as never,
    router as never,
    {} as never,
    {} as never,
    null,
    ai as never,
  );
  return { service, conversations, store };
}

describe('MessageService — model tidak terjangkau', () => {
  it('LlmUnavailableError dari router → event LLM_UNAVAILABLE retryable, bukan lemparan', async () => {
    const { service, conversations } = serviceWith({
      route: () => Promise.reject(new LlmUnavailableError(403)),
    });

    const events = await service.handle('C'.repeat(26), ACTOR, 'hai jo', '2026-10-05T00:00:00Z');

    expect(events.map((e) => e.type)).toEqual(['message.start', 'error', 'message.end']);
    expect(events[1]).toMatchObject({ code: 'LLM_UNAVAILABLE', retryable: true });
    // Pesan pengguna tidak hilang — ia sudah tersimpan sebelum model dipanggil.
    expect(conversations.appendUserMessage).toHaveBeenCalledTimes(1);
  });

  it('galat lain tetap dilempar — hanya ketiadaan model yang dijinakkan', async () => {
    const { service } = serviceWith({ route: () => Promise.reject(new Error('rusak')) });

    await expect(
      service.handle('C'.repeat(26), ACTOR, 'hai jo', '2026-10-05T00:00:00Z'),
    ).rejects.toThrow('rusak');
  });
});
