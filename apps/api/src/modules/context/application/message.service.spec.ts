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
    find: vi.fn(async () => ({ title: null })),
    messages: vi.fn(async () => []),
    rename: vi.fn(async () => undefined),
    appendUserMessage: vi.fn(async () => undefined),
    appendAssistantMessage: vi.fn(async () => undefined),
  };
  const store = { current: vi.fn(async () => null), append: vi.fn(async () => undefined) };
  const ai = { classifyIntent: vi.fn(), titleFor: vi.fn(async () => 'Rumah 2 lantai') };
  const service = new MessageService(
    conversations as never,
    store as never,
    router as never,
    {} as never,
    {} as never,
    null,
    ai as never,
  );
  return { service, conversations, store, ai };
}

describe('MessageService — judul dari pesan pertama', () => {
  it('percakapan tanpa judul diberi judul dari model saat pesan pertama', async () => {
    const { service, conversations } = serviceWith({
      route: () => Promise.reject(new LlmUnavailableError(503)),
    });
    await service.handle('C'.repeat(26), ACTOR, 'rumah 2 lantai 3 kamar mandi', 'x');
    expect(conversations.rename).toHaveBeenCalledWith('C'.repeat(26), ACTOR, 'Rumah 2 lantai');
  });

  it('model gagal memberi judul → potongan pesannya; percakapan berjudul tidak diubah', async () => {
    const { service, conversations, ai } = serviceWith({
      route: () => Promise.reject(new LlmUnavailableError(503)),
    });
    ai.titleFor.mockRejectedValueOnce(new Error('putus'));
    await service.handle('C'.repeat(26), ACTOR, '  rumah   2 lantai  ', 'x');
    expect(conversations.rename).toHaveBeenCalledWith('C'.repeat(26), ACTOR, 'rumah 2 lantai');

    conversations.rename.mockClear();
    conversations.find.mockResolvedValueOnce({ title: 'Sudah ada' } as never);
    await service.handle('C'.repeat(26), ACTOR, 'lanjut', 'x');
    expect(conversations.rename).not.toHaveBeenCalled();
  });
});

describe('MessageService.requirement — state untuk membuka kembali riwayat', () => {
  it('memeriksa kepemilikan lalu mengembalikan snapshot terkini (null bila belum ada)', async () => {
    const { service, conversations, store } = serviceWith({ route: () => Promise.resolve({}) });

    expect(await service.requirement('C'.repeat(26), ACTOR)).toBeNull();
    expect(conversations.find).toHaveBeenCalledWith('C'.repeat(26), ACTOR);
    expect(store.current).toHaveBeenCalledWith('C'.repeat(26));
  });
});

describe('MessageService.edit — edit inline tanpa LLM', () => {
  it('menyimpan snapshot user_edit bila ada yang berubah, tanpa menyentuh model', async () => {
    const { service, store } = serviceWith({ route: () => Promise.resolve({}) });

    const state = await service.edit(
      'C'.repeat(26),
      ACTOR,
      [{ path: 'building.floors', value: 3 }],
      '2026-10-05T00:00:00.000Z',
    );

    expect(state.building.floors.value).toBe(3);
    expect(state.building.floors.source).toBe('user_edited');
    expect(store.append).toHaveBeenCalledWith('C'.repeat(26), state, 'user_edit');
  });

  it('memeriksa kepemilikan sebelum menyentuh snapshot', async () => {
    const { service, conversations } = serviceWith({ route: () => Promise.resolve({}) });
    conversations.find.mockRejectedValueOnce(new Error('bukan milik'));

    await expect(
      service.edit('C'.repeat(26), ACTOR, [{ path: 'building.floors', value: 3 }], 'x'),
    ).rejects.toThrow('bukan milik');
  });
});

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
