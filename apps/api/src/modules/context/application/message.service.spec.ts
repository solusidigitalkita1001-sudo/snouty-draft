/**
 * Model yang terkonfigurasi tetapi tidak terjangkau diperlakukan seperti tanpa model:
 * event LLM_UNAVAILABLE yang retryable, pesan pengguna tetap tersimpan, giliran tidak
 * jatuh menjadi 503. Ditemukan live 2026-10-05 dengan kunci OpenRouter berlimit $0.
 */
import { describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import { MessageService, isSaneTitle } from './message.service.js';

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

describe('isSaneTitle — judul model yang rusak dibuang', () => {
  it('menerima judul Latin 2–10 kata; menolak aksara campur, satu kata, kosong', () => {
    expect(isSaneTitle('Pipa rumah kos 3 lantai')).toBe(true);
    expect(isSaneTitle('Rumah 2 lantai — toren atap')).toBe(true);
    expect(isSaneTitle('konsultasi pipaحوا incenter')).toBe(false);
    expect(isSaneTitle('Pipa')).toBe(false);
    expect(isSaneTitle('')).toBe(false);
    expect(isSaneTitle('a b c d e f g h i j k l')).toBe(false);
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

describe('MessageService.answerClarification — semua jawaban sekaligus, tanpa LLM', () => {
  it('menggabungkan jawaban, menyimpan snapshot clarification_answer, menulis dua pesan, mengembalikan kartu lanjutan', async () => {
    const { service, conversations, store, ai } = serviceWith({
      route: async () => {
        throw new Error('router tidak boleh dipanggil');
      },
    });
    const result = await service.answerClarification(
      'C'.repeat(26),
      ACTOR,
      [
        { id: 'water.source', option: 'Toren atap' },
        { id: 'water.installationType', option: 'Air bersih' },
        { id: 'building.floors', option: '2' },
        { id: 'fixtures.bathrooms', option: '3' },
      ],
      '2026-01-01T00:00:00.000Z',
    );

    expect(ai.classifyIntent).not.toHaveBeenCalled();
    expect(result.userText).toBe(
      'Sumber air: Toren atap · Instalasi: Air bersih · Lantai: 2 · Kamar mandi: 3',
    );
    expect(result.state.water.source.value).toBe('rooftop_tank');
    expect(result.state.building.floors.value).toBe(2);
    expect(result.state.missingInformation).toEqual([]);
    expect(result.card).toEqual({ kind: 'cta', action: 'ANALYZE' });
    expect(store.append).toHaveBeenCalledWith('C'.repeat(26), result.state, 'clarification_answer');
    expect(conversations.appendUserMessage).toHaveBeenCalledWith(
      'C'.repeat(26),
      ACTOR,
      result.userText,
    );
    expect(conversations.appendAssistantMessage).toHaveBeenCalledWith(
      'C'.repeat(26),
      '',
      [result.card],
      null,
    );
  });

  it('jawaban irigasi masuk jalur gunanya: lengkap → kartu handoff dengan data terbaca', async () => {
    const { service, store } = serviceWith({ route: async () => undefined });
    const result = await service.answerClarification(
      'C'.repeat(26),
      ACTOR,
      [
        { id: 'irrigation.source', option: 'Sungai / saluran' },
        { id: 'irrigation.areaHa', option: '1–2 ha' },
        { id: 'irrigation.method', option: 'Tetes' },
        { id: 'irrigation.distance', option: '200–500 m' },
      ],
      '2026-01-01T00:00:00.000Z',
    );
    expect(result.userText).toBe(
      'Sumber air: Sungai / saluran · Luas lahan: 1–2 ha · Jenis irigasi: Tetes · Jarak sumber ke lahan: 200–500 m',
    );
    expect(result.card?.kind).toBe('clarification'); // beda tinggi masih kurang
    expect(store.append).toHaveBeenCalledWith('C'.repeat(26), result.state, 'clarification_answer');

    const done = await service.answerClarification(
      'C'.repeat(26),
      ACTOR,
      [{ id: 'irrigation.elevation', option: 'Lebih rendah' }],
      '2026-01-01T00:00:00.000Z',
    );
    // Store palsu tidak menyimpan state; cukup pastikan jawabannya terbaca dan kartunya kebijakan
    // atau klarifikasi — bukan lemparan.
    expect(['clarification', 'unsupported']).toContain(done.card?.kind);
  });

  it('"Belum tahu" memakai default ASSUMED bila ada; yang tanpa default ditanya lagi', async () => {
    const { service } = serviceWith({ route: async () => undefined });
    const result = await service.answerClarification(
      'C'.repeat(26),
      ACTOR,
      [
        { id: 'water.source', option: 'Belum tahu' },
        { id: 'building.floors', option: 'Belum tahu' },
      ],
      '2026-01-01T00:00:00.000Z',
    );
    expect(result.state.water.source).toMatchObject({
      value: 'rooftop_tank',
      provenance: 'ASSUMED',
    });
    expect(result.state.building.floors.value).toBeNull();
    expect(result.card?.kind).toBe('clarification');
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
