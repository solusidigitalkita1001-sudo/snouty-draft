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
    writeProse: vi.fn(() => Promise.resolve(null)),
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

  it('pertanyaan rekomendasi bahan: dijawab apa yang menentukan + aturan praktis, lalu klarifikasi — bukan perbandingan ulang', async () => {
    const ai = aiExtracting({ building: { type: 'residential', floors: 2 } });
    const { events } = await runUnderstanding(
      ai,
      input({ message: 'lebih bagus PVC atau HDPE buat rumah 2 lantai?' }),
    );

    expect(events.map((e) => e.type)).toEqual([
      'message.start',
      'stage',
      'requirement.updated',
      'stage',
      'token',
      'card',
      'message.end',
    ]);
    const text = (events[4] as { text: string }).text;
    expect(text).toContain(
      'Untuk rumah tinggal 2 lantai, pilihan bahan **tidak ditentukan dari jumlah lantai saja**',
    );
    expect(text).toContain('- **PVC (uPVC)** biasanya lebih cocok untuk instalasi tetap');
    expect(text).toContain('- **HDPE** biasanya lebih cocok untuk jalur panjang');
    expect(text).toContain('Keduanya bisa dipakai di bagian yang berbeda');
    expect(text).toContain('saya perlu beberapa hal di bawah ini');
    expect(text).not.toContain('Singkatnya'); // bukan perbandingan definisi
    expect((events[5] as { card: { kind: string } }).card.kind).toBe('clarification');
  });

  it('jalur kasus teknis ("gorong-gorong … jalan 6 m, truk"): parameter universal tercatat, pertanyaan registry, nol ekstraksi', async () => {
    const ai = aiExtracting({});
    const { events, nextState, changed } = await runUnderstanding(
      ai,
      input({
        message: 'mau pasang gorong-gorong melintasi jalan desa, lebar jalan 6 m, dilewati truk',
      }),
    );
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual([
      'message.start',
      'requirement.updated',
      'token',
      'message.end',
    ]);
    const text = (events[2] as { text: string }).text;
    expect(text).toContain('Oke, gorong-gorong');
    expect(text).toContain('lebar jalan 6 m');
    expect(text).toContain('tolong jawab');
    expect(nextState.useCase).toMatchObject({ kind: 'technical', caseId: 'culvert' });
    const params = (nextState.useCase as { parameters: Record<string, { value: unknown }> })
      .parameters;
    expect(params['road_width']?.value).toBe(6);
    expect(params['traffic_load']?.value).toBe('Truk / berat');
    expect(changed).toBe(true);

    // Lanjutan: angka yang ditanya dijawab dengan kalimat; kasusnya tetap gorong-gorong.
    const next = await runUnderstanding(
      ai,
      input({ message: 'debitnya kira-kira 20 l/s, kemiringan 1%', state: nextState }),
    );
    const after = (next.nextState.useCase as { parameters: Record<string, { value: unknown }> })
      .parameters;
    expect(after['design_flow']?.value).toBe(20);
    expect(after['slope']?.value).toBe(1);
    expect(after['road_width']?.value).toBe(6);
    // Semua parameter kritis ada dan kalkulator gorong-gorong tersedia (Fase 4) → CTA analisis.
    const card = next.events.find((e) => e.type === 'card') as
      { card: { kind: string; action?: string } } | undefined;
    expect(card?.card).toEqual({ kind: 'cta', action: 'ANALYZE' });
  });

  it('jalur irigasi ("irigasi sawah 1 hektar"): arahan + kartu pertanyaan IRIGASI, nol ekstraksi, luas tercatat', async () => {
    const ai = aiExtracting({});
    const { events, nextState, changed } = await runUnderstanding(
      ai,
      input({
        message:
          'untuk bikin irigasi sawah dengan luas 1 hektar itu yang dibutuhin apa aja product nya?',
      }),
    );
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual([
      'message.start',
      'requirement.updated',
      'token',
      'card',
      'message.end',
    ]);
    const text = (events[2] as { text: string }).text;
    expect(text).toContain('Untuk irigasi lahan 1 ha');
    expect(text).toContain('**Jalur utama dari sumber ke lahan**');
    expect(text).not.toMatch(/\d+\s*(bar|mm|inci)/); // tanpa angka teknik
    const card = (events[3] as { card: { kind: string; questions?: { id: string }[] } }).card;
    expect(card.kind).toBe('clarification');
    expect(card.questions?.map((q) => q.id)).toEqual([
      'irrigation.source',
      'irrigation.method',
      'irrigation.distance',
      'irrigation.elevation',
    ]);
    expect(nextState.useCase).toEqual({
      kind: 'irrigation',
      answers: { 'irrigation.areaHa': '1 ha' },
    });
    expect(nextState.building.floors.value).toBeNull();
    expect(changed).toBe(true);
  });

  it('guna di luar cakupan ("air panas boiler"): kartu validasi teknis, TANPA ekstraksi dan tanpa klarifikasi kamar mandi', async () => {
    const ai = aiExtracting({});
    const { events, changed } = await runUnderstanding(
      ai,
      input({ message: 'pipa buat jalur air panas boiler hotel butuh apa?' }),
    );
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual(['message.start', 'card', 'message.end']);
    const card = (events[1] as { card: { kind: string; reasons?: string[] } }).card;
    expect(card.kind).toBe('unsupported');
    expect(card.reasons?.[0]).toContain('di luar cakupan rekomendasi otomatis');
    expect(changed).toBe(false);
  });

  it('kasus pemilik "tambak lele 4 x 4 meter, produknya apa aja": jalur kolam, dimensi tercatat, CTA analisis — bukan kartu di luar cakupan', async () => {
    const ai = aiExtracting({});
    const { events, nextState } = await runUnderstanding(
      ai,
      input({ message: 'gw pengen bikin tambak lele 4 x 4 meter, produk nya apa aja' }),
    );
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(nextState.useCase).toMatchObject({ kind: 'technical', caseId: 'fish_pond' });
    const params = (nextState.useCase as { parameters: Record<string, { value: unknown }> })
      .parameters;
    expect(params['pond_length']?.value).toBe(4);
    expect(params['pond_width']?.value).toBe(4);
    const text = (events.find((e) => e.type === 'token') as { text: string }).text;
    expect(text).toContain('Oke, kolam/tambak');
    expect(text).toContain('Susun rekomendasi');
    expect(text).not.toContain('di luar cakupan');
    const card = (
      events.find((e) => e.type === 'card') as { card: { kind: string; action?: string } }
    ).card;
    expect(card).toEqual({ kind: 'cta', action: 'ANALYZE' });
  });

  it('pernyataan kebutuhan biasa tetap tanpa teks tambahan', async () => {
    const ai = aiExtracting({ building: { floors: 2 }, fixtures: { bathrooms: 3 } });
    const { events } = await runUnderstanding(
      ai,
      input({ message: 'pakai pvc buat rumah 2 lantai' }),
    );
    expect(events.some((e) => e.type === 'token')).toBe(false);
  });

  it('data inti lengkap: kartu CTA ANALYZE, bukan klarifikasi', async () => {
    const ai = aiExtracting({
      building: { floors: 2 },
      fixtures: { bathrooms: 3 },
      water: { source: 'rooftop_tank', installationType: 'clean_water' },
    });
    const { events, nextState } = await runUnderstanding(
      ai,
      input({ message: 'rumah 2 lantai, 3 kamar mandi, toren atap, air bersih' }),
    );
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
      writeProse: vi.fn(() => Promise.resolve(null)),
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

  it('intent yang tidak mengekstrak: dibalas satu kalimat tetap, tanpa menyentuh ekstraksi', async () => {
    const ai = aiExtracting({});
    const decision: RoutingDecision = {
      intent: 'EXPLANATION_REQUEST',
      confidence: 0.9,
      shouldExtract: false,
      mutatesState: false,
    };
    const { events, changed } = await runUnderstanding(ai, input({ decision }));
    expect(events.map((e) => e.type)).toEqual(['message.start', 'token', 'message.end']);
    expect(changed).toBe(false);
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('sapaan / di luar topik: dibalas sapaan yang mengarahkan, bukan formulir klarifikasi', async () => {
    const decision: RoutingDecision = {
      intent: 'OUT_OF_SCOPE',
      confidence: 0.9,
      shouldExtract: false,
      mutatesState: false,
    };
    const { events } = await runUnderstanding(aiExtracting({}), input({ decision }));
    const text = events.find((e) => e.type === 'token') as { text: string } | undefined;
    expect(text?.text).toContain('Halo! Saya SNOUTY');
    expect(events.some((e) => e.type === 'card')).toBe(false);
  });

  it('pembuka tanpa fakta ("mau nanya2 dong") berlabel REQUIREMENT_STATEMENT: dijawab ajakan bertanya, bukan formulir klarifikasi', async () => {
    // Keluaran asli qwen2.5 7B di produksi: label pernyataan kebutuhan, ekstraksi kerangka kosong.
    const ai = aiExtracting({ building: {}, fixtures: {}, water: {} });
    const { events, changed } = await runUnderstanding(
      ai,
      input({ message: 'mau nanya2 dong', decision: extractDecision }),
    );
    const text = events.find((e) => e.type === 'token') as { text: string } | undefined;
    expect(text?.text).toContain('Silakan, tanyakan saja');
    expect(events.some((e) => e.type === 'card')).toBe(false);
    expect(events.some((e) => e.type === 'requirement.updated')).toBe(false);
    expect(changed).toBe(false);
  });

  it('jawaban klarifikasi yang kosong TIDAK dianggap pembuka: jalur biasa tetap berjalan', async () => {
    const decision: RoutingDecision = {
      intent: 'CLARIFICATION_ANSWER',
      confidence: 0.9,
      shouldExtract: true,
      mutatesState: true,
    };
    const { events } = await runUnderstanding(
      aiExtracting({}),
      input({ message: 'belum tahu', decision }),
    );
    expect(events.some((e) => e.type === 'card')).toBe(true);
  });

  it('model ragu (CLARIFICATION_NEEDED): bertanya balik, tidak mengubah state', async () => {
    const decision: RoutingDecision = {
      intent: 'CLARIFICATION_NEEDED',
      confidence: 0.3,
      shouldExtract: false,
      mutatesState: false,
    };
    const { events, changed } = await runUnderstanding(aiExtracting({}), input({ decision }));
    const text = events.find((e) => e.type === 'token') as { text: string } | undefined;
    expect(text?.text).toContain('belum menangkap maksudnya');
    expect(changed).toBe(false);
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

describe('gerbang kebijakan di pipeline (P5-05)', () => {
  it('pertanyaan kompetitor: kartu kriteria netral, tanpa ekstraksi sama sekali', async () => {
    const ai = aiExtracting({ building: { floors: 2 } });
    const decision: RoutingDecision = {
      intent: 'COMPETITOR_QUESTION',
      confidence: 0.95,
      shouldExtract: true, // sengaja true: kebijakan harus menang lebih dulu
      mutatesState: false,
    };
    const { events, changed } = await runUnderstanding(ai, input({ decision }));

    const card = events.find((e) => e.type === 'card') as { card: { kind: string } };
    expect(card.card.kind).toBe('criteria');
    expect((ai.extract as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(changed).toBe(false);
    // Tidak ada kartu produk, tak peduli apa pun kata modelnya.
    expect(JSON.stringify(events)).not.toContain('"product"');
  });

  it('industri: kartu unsupported dengan kebutuhan terkumpul, bukan CTA analisis', async () => {
    const ai = aiExtracting({
      building: { type: 'industrial', floors: 2 },
      fixtures: { bathrooms: 3 },
      water: { source: 'pump', installationType: 'clean_water' },
    });
    const { events } = await runUnderstanding(
      ai,
      input({ message: 'pabrik 2 lantai, 3 kamar mandi, pompa, air bersih' }),
    );

    const card = events.find((e) => e.type === 'card') as {
      card: { kind: string; slaHours?: number; captured?: readonly unknown[] };
    };
    expect(card.card.kind).toBe('unsupported');
    expect(card.card.slaHours).toBe(24);
    // Kebutuhan dibawa serta supaya tidak diulang ke tim teknis.
    expect((card.card.captured ?? []).length).toBeGreaterThan(0);
    // Bahasa pengguna, bukan path/enum: "Tipe bangunan: Industri", bukan "building.type: industrial".
    expect(card.card.captured).toContainEqual({ label: 'Tipe bangunan', value: 'Industri' });
    expect(card.card.captured).toContainEqual({ label: 'Jumlah lantai', value: '2 lantai' });
    expect(card.card.captured).toContainEqual({ label: 'Sumber air', value: 'Pompa' });
  });

  it('pembuangan: belum didukung penuh walaupun data inti lengkap', async () => {
    const ai = aiExtracting({
      building: { floors: 2 },
      fixtures: { bathrooms: 2 },
      water: { source: 'municipal', installationType: 'drainage' },
    });
    const { events } = await runUnderstanding(
      ai,
      input({ message: 'rumah 2 lantai, 2 kamar mandi, PDAM, saluran pembuangan' }),
    );
    const card = events.find((e) => e.type === 'card') as { card: { kind: string } };
    expect(card.card.kind).toBe('unsupported');
  });

  it('air bersih rumah tinggal lengkap: tetap CTA analisis', async () => {
    const ai = aiExtracting({
      building: { type: 'residential', floors: 2 },
      fixtures: { bathrooms: 3 },
      water: { source: 'rooftop_tank', installationType: 'clean_water' },
    });
    const { events } = await runUnderstanding(
      ai,
      input({ message: 'rumah 2 lantai, 3 kamar mandi, toren atap, air bersih' }),
    );
    const card = events.find((e) => e.type === 'card') as { card: { kind: string } };
    expect(card.card.kind).toBe('cta');
  });
});
