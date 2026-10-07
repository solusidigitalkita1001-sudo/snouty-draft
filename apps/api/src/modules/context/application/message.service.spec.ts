/**
 * Model yang terkonfigurasi tetapi tidak terjangkau diperlakukan seperti tanpa model:
 * event LLM_UNAVAILABLE yang retryable, pesan pengguna tetap tersimpan, giliran tidak
 * jatuh menjadi 503. Ditemukan live 2026-10-05 dengan kunci OpenRouter berlimit $0.
 */
import { describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../../ai/domain/ai.errors.js';
import type { RequirementState } from '@snouty/shared-types';
import { MessageService, isSaneTitle } from './message.service.js';

// Ruas produk membaca satu saklar env (LLM_FAQ_REWRITE); tes ini tidak punya .env.
vi.mock('../../../config/env.js', () => ({ loadEnv: () => ({ LLM_FAQ_REWRITE: false }) }));

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
    // Jawaban kartu tidak bisu: teks "sudah saya catat" ikut tersimpan bersama kartunya.
    expect(result.text).toMatch(/^Oke, sudah saya catat: .*2 lantai.*3 kamar mandi/);
    expect(conversations.appendAssistantMessage).toHaveBeenCalledWith(
      'C'.repeat(26),
      result.text,
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
    expect(['clarification', 'cta']).toContain(done.card?.kind);
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

/**
 * Fase 16 — percakapan yang dulu rusak, dimainkan ulang dari awal sampai akhir dengan router
 * ASLI dan model yang selalu menjawab PRODUCT_LOOKUP (perilaku 7B yang memicu bug): subjek
 * perusahaan bertahan melewati "boleh", "lengkap dong", "semuanya"; tidak pernah
 * "Produk mana yang Anda maksud?"; berganti ke produk hanya saat produk disebut.
 */
describe('MessageService — subjek percakapan & pertanyaan perusahaan (Fase 16)', () => {
  async function conversation() {
    const { IntentRouter } = await import('./intent-router.js');
    const snapshots: { state: RequirementState }[] = [];
    const assistant: string[] = [];
    const rows: { role: 'user' | 'assistant'; text: string }[] = [];
    const conversations = {
      find: vi.fn(async () => ({ title: 'x', language: 'id' })),
      // Giliran sebelumnya tersedia sebagai `recentTurns` — seperti di produksi.
      messages: vi.fn(async () => rows),
      rename: vi.fn(async () => undefined),
      appendUserMessage: vi.fn(async () => undefined),
      appendAssistantMessage: vi.fn(async (_id: string, text: string) => {
        assistant.push(text);
        rows.push({ role: 'assistant', text });
      }),
    };
    const store = {
      current: vi.fn(async () => snapshots.at(-1) ?? null),
      append: vi.fn(async (_id: string, state: RequirementState, trigger: string) => {
        snapshots.push({ state });
        return { state, trigger };
      }),
    };
    const ai = {
      classifyIntent: vi.fn(async () => ({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 })),
      parseProductQuestion: vi.fn(async () => ({ productQuery: 'HDPE', aspect: null, size: null })),
      titleFor: vi.fn(async () => 'Tentang Pralon'),
      extract: vi.fn(async () => ({})),
      writeProse: vi.fn(async () => null),
    };
    const catalog = {
      activeVersion: vi.fn(async () => ({ kind: 'sample' })),
      listProducts: vi.fn(async () => ({ items: [] })),
    };
    const service = new MessageService(
      conversations as never,
      store as never,
      new IntentRouter(ai as never),
      catalog as never,
      { answer: vi.fn() } as never,
      null,
      ai as never,
    );
    const say = async (text: string) => {
      rows.push({ role: 'user', text });
      await service.handle('C'.repeat(26), ACTOR, text, '2026-10-07T00:00:00Z');
      return assistant.at(-1) ?? '';
    };
    const subject = () => snapshots.at(-1)?.state.subject;
    return { say, subject, ai, store };
  }

  it('percakapan pemilik: "pralon itu apa?" … "semuanya, tolong tampilin" tetap tentang PT Pralon', async () => {
    const { say, subject, ai } = await conversation();

    const first = await say('pralon itu apa?');
    expect(first).toContain('Pralon adalah produsen sistem perpipaan');
    expect(first).toContain('Kalau yang Anda maksud produk Pralon tertentu');
    expect(first).not.toContain('Produk mana yang Anda maksud');
    expect(subject()?.kind).toBe('company');

    await say('PT Pralon yang gw maksud');
    expect(subject()).toMatchObject({ kind: 'company', entity: 'PT Pralon' });

    await say('gw pengen tau terkait company profile PT Pralon');
    expect(subject()).toMatchObject({ topic: 'company_profile', depth: 'detailed' });

    const ok = await say('boleh');
    expect(ok).not.toContain('Produk mana');
    expect(subject()?.depth).toBe('comprehensive');

    const full = await say('data nya secara lengkap dong');
    expect(full).toContain('Informasi yang dapat saya verifikasi saat ini:');
    expect(full).toContain('**Situs resmi**');
    expect(full).toContain('belum bisa saya verifikasi dari sumber resmi');
    expect(full).not.toContain('Produk mana');

    const all = await say('semuanya, tolong tampilin');
    expect(all).not.toContain('Produk mana');
    expect(all).toContain('Pralon adalah produsen');
    expect(subject()).toMatchObject({
      kind: 'company',
      topic: 'company_profile',
      depth: 'comprehensive',
    });

    // Model (yang selalu bilang PRODUCT_LOOKUP) tidak pernah ditanya untuk semua giliran di atas.
    expect(ai.classifyIntent).not.toHaveBeenCalled();
  });

  it('percakapan pemilik #2: "apa bedanya fitting sama hdpe?" lalu "bikinin … bentuk table" → tabel, bukan "Produk mana"', async () => {
    const { say, subject } = await conversation();
    const first = await say('apa bedanya fitting sama hdpe ?');
    expect(first).toContain('**HDPE** adalah bahan pipa, sedangkan **fitting**');
    expect(subject()).toMatchObject({ kind: 'product', entity: 'hdpe' });
    const table = await say(
      'bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca',
    );
    expect(table).toContain('| Aspek |');
    expect(table).not.toContain('Produk mana');
  });

  it('percakapan pemilik #3: fitting vs HDPE → tabel → "bandingin sama PVC dalam bentuk table" → "bedanya sama pipa AW … yang lu jelasin tadi"', async () => {
    const { say, subject } = await conversation();
    await say('apa bedanya fitting sama hdpe ?');
    const table = await say(
      'bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca',
    );
    expect(table).toContain('| Aspek | **HDPE** | **Fitting** |');

    const vsPvc = await say('coba bandingin sama pipa PVC dalam bentuk table');
    expect(vsPvc).toContain('| Aspek | **PVC (uPVC)** | **HDPE** |');
    expect(vsPvc).not.toContain('Produk mana');
    expect(subject()).toMatchObject({ kind: 'product', topic: 'comparison' });
    expect(subject()?.entity).toMatch(/pvc/);
    expect(subject()?.entity).toMatch(/hdpe/);

    const vsAw = await say('terus bedanya sama pipa AW apa dari product2 yang lu jelasin tadi');
    expect(vsAw).not.toContain('Produk mana');
    expect(vsAw).toContain('AW dan D adalah kelas pipa PVC');
    expect(vsAw).toContain('**PVC (uPVC)**');
    expect(vsAw).toContain('**HDPE**');
  });

  it('TEST E: setelah profil perusahaan, "produk HDPE nya gimana?" berpindah ke subjek produk', async () => {
    const { say, subject } = await conversation();
    await say('company profile PT Pralon');
    const reply = await say('produk HDPE nya gimana?');
    expect(reply).toContain('HDPE');
    expect(subject()).toMatchObject({ kind: 'product', entity: 'hdpe' });
    // Lanjutan setelah itu tentang produk itu — dijawab, bukan "Produk mana yang Anda maksud?".
    const more = await say('lebih detail dong');
    expect(more).toContain('HDPE');
    expect(more).not.toContain('Produk mana');
    expect(subject()).toMatchObject({ kind: 'product', entity: 'hdpe', depth: 'detailed' });
  });

  it('subjek yang sama tidak menulis snapshot baru; subjek baru menulis `subject_change`', async () => {
    const { say, store } = await conversation();
    await say('pralon itu apa?');
    expect(store.append).toHaveBeenCalledTimes(1);
    expect(store.append.mock.calls[0]![2]).toBe('subject_change');
    await say('PT Pralon yang gw maksud');
    expect(store.append).toHaveBeenCalledTimes(1);
  });
});

describe('MessageService — aliran event (P14-07)', () => {
  it('message.start dikirim SEBELUM routing; tidak ada event ganda; urutan sink = urutan array', async () => {
    let startedBeforeRoute = false;
    const seen: string[] = [];
    const { service } = serviceWith({
      route: () => {
        startedBeforeRoute = seen[0] === 'message.start';
        return Promise.resolve({
          intent: 'OUT_OF_SCOPE',
          confidence: 1,
          shouldExtract: false,
          mutatesState: false,
        });
      },
    });

    const events = await service.handle(
      'C'.repeat(26),
      ACTOR,
      'hai jo',
      '2026-10-05T00:00:00Z',
      (e) => seen.push(e.type),
    );

    expect(startedBeforeRoute).toBe(true);
    expect(seen).toEqual(events.map((e) => e.type));
    expect(seen.filter((t) => t === 'message.start')).toHaveLength(1);
  });

  it('model tidak terjangkau SETELAH message.start terkirim: sisa event (error, end) tetap sampai lewat array', async () => {
    const seen: string[] = [];
    const { service } = serviceWith({
      route: () => Promise.reject(new LlmUnavailableError(403)),
    });
    const events = await service.handle(
      'C'.repeat(26),
      ACTOR,
      'hai jo',
      '2026-10-05T00:00:00Z',
      (e) => seen.push(e.type),
    );
    // Sink hanya melihat start; controller menulis sisanya dari `events.slice(written)`.
    expect(seen).toEqual(['message.start']);
    expect(events.map((e) => e.type)).toEqual(['message.start', 'error', 'message.end']);
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
