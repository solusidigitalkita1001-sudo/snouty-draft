/**
 * P16-29 — perencana giliran. Uji pemilik 2026-10-09: "kalau yang pvc?", "paling kecil berapa?",
 * "luasnya ngaruh ga?", "kamu siapa?" salah jalur karena maknanya bergantung konteks.
 */
import { describe, expect, it, vi } from 'vitest';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { executePlan, type PlanContext } from './plan-executor.js';
import { buildPlannerMessage, parsePlan, resolveFamily, TurnPlanner } from './turn-planner.js';

const FAMILIES = ['HDPE', 'PVC AW', 'PVC D', 'FITTING HDPE', 'FITTING PVC'];
const NAMES: Record<string, string[]> = {
  HDPE: ['Pipa HDPE PE 100 PN-8 160 mm x 9 Meter', 'Pipa HDPE PE 100 PN-16 63 mm x 6 Meter'],
  'PVC AW': [
    'Pipa (TS End) Putih AW 1/2" x 4 Meter',
    'Pipa (TS End) Abu AW 4" x 4 Meter',
    'Pipa (Plain End) Abu AW 3/4" x 1 Meter',
  ],
  'PVC D': ['Pipa (TS End) Abu D 4" x 4 Meter'],
  'FITTING HDPE': ['Tee (Segmented) PE 315 x 160 mm'],
  'FITTING PVC': [
    'Red Socket - W 90 x 32 mm',
    'Red Socket - W 63 x 20 mm',
    'Red Socket - D 160 x 110 mm Coklat',
  ],
};
const catalog = {
  activeVersion: async () => ({ kind: 'pralon' }) as never,
  familyCounts: async () => FAMILIES.map((family) => ({ family, count: NAMES[family]!.length })),
  productNamesInFamily: async (family: string) => NAMES[family] ?? [],
};
const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  catalog,
  reply: null,
  messageId: 'm',
  message: 'x',
  recentTurns: [],
  state: emptyRequirementState('2026-01-01T00:00:00.000Z'),
  locale: 'id',
  hasExisting: false,
  ...over,
});
const textOf = (o: Awaited<ReturnType<typeof executePlan>>) =>
  o.kind === 'answered' ? ((o.events[1] as { text: string }).text ?? '') : '';

describe('parsePlan / resolveFamily', () => {
  it('keluarga dicocokkan ke nama katalog; yang tidak ada → null', () => {
    expect(resolveFamily('pvc  aw', FAMILIES)).toBe('PVC AW');
    expect(resolveFamily('PPR', FAMILIES)).toBeNull();
    expect(
      parsePlan({ action: 'product_sizes', family: 'pvc aw', extreme: 'smallest' }, FAMILIES),
    ).toEqual({ action: 'product_sizes', family: 'PVC AW', type: null, extreme: 'smallest' });
  });

  it('keluaran tidak sah → null (router lama yang menjawab)', () => {
    expect(parsePlan({ action: 'tebak' }, FAMILIES)).toBeNull();
    expect(parsePlan('bukan json', FAMILIES)).toBeNull();
  });

  it('pesan ke model memuat daftar keluarga, topik aktif, dan percakapan terpotong', () => {
    const msg = buildPlannerMessage({
      message: 'kalau yang pvc?',
      recentTurns: [{ role: 'assistant', text: 'x'.repeat(1000) }],
      families: FAMILIES,
      subject: 'hdpe',
    });
    expect(msg).toContain('DAFTAR KELUARGA: HDPE, PVC AW, PVC D, FITTING HDPE');
    expect(msg).toContain('TOPIK AKTIF: hdpe');
    expect(msg).toContain('PESAN TERAKHIR PENGGUNA: kalau yang pvc?');
    expect(msg.length).toBeLessThan(700);
  });

  it('model gagal → null, tidak melempar', async () => {
    const planner = new TurnPlanner(
      { writeProse: vi.fn(() => Promise.reject(new Error('x'))) },
      1000,
    );
    await expect(
      planner.plan({
        message: 'x',
        recentTurns: [],
        families: FAMILIES,
        subject: null,
        locale: 'id',
      }),
    ).resolves.toBeNull();
  });
});

describe('executePlan', () => {
  it('"paling kecil berapa?" (PVC AW) → ukuran terkecil dari katalog beserta contoh produknya', async () => {
    const out = await executePlan(
      { action: 'product_sizes', family: 'PVC AW', type: null, extreme: 'smallest' },
      ctx(),
    );
    expect(textOf(out)).toContain(
      'Ukuran terkecil PVC AW di katalog Pralon adalah 1/2", misalnya Pipa (TS End) Putih AW 1/2" x 4 Meter.',
    );
  });

  it('"yang AW ukurannya apa aja?" → rentang per jenis, bukan satu produk', async () => {
    const out = await executePlan(
      { action: 'product_sizes', family: 'PVC AW', type: null, extreme: null },
      ctx(),
    );
    expect(textOf(out)).toContain('- **Pipa (TS End) AW** — 1/2" dan 4"');
  });

  it('"kalau yang pvc?" setelah jenis HDPE → jenis keluarga PVC', async () => {
    const out = await executePlan(
      { action: 'product_types', family: 'PVC AW', type: null, extreme: null },
      ctx(),
    );
    expect(textOf(out)).toContain('keluarga PVC AW ada 3 produk');
    expect(out.kind === 'answered' && out.family).toBe('PVC AW');
  });

  it('"kalau yang pvc?": keluarga yang disebut pesan mengalahkan pilihan model (FITTING PVC)', async () => {
    const out = await executePlan(
      { action: 'product_types', family: 'FITTING HDPE', type: null, extreme: null },
      ctx({ named: ['pvc'] }),
    );
    const text = textOf(out);
    expect(text).toContain('dalam 2 keluarga');
    expect(text).toContain('**PVC AW**');
    expect(text).not.toContain('FITTING HDPE');
  });

  it('"kalau yang pvc?" setelah daftar jenis: product_question dari model tetap menjadi daftar jenis PVC', async () => {
    const out = await executePlan(
      { action: 'product_question', family: null, type: null, extreme: null },
      ctx({
        named: ['pvc'],
        previousText:
          'Di katalog Pralon, keluarga HDPE ada 2 produk.\n\nMau saya rinci ukuran untuk salah satu jenisnya?',
      }),
    );
    expect(textOf(out)).toContain('**PVC AW**');
    // Tanpa daftar sebelumnya: tetap jalur pertanyaan produk biasa.
    expect(
      await executePlan(
        { action: 'product_question', family: null, type: null, extreme: null },
        ctx({ named: ['pvc'], previousText: 'Halo!' }),
      ),
    ).toMatchObject({ kind: 'route' });
  });

  it('"fitting pvc kok banyak, dibagi berapa kelas?" → rincian FITTING PVC (seri, jenis), bukan keluarga PVC', async () => {
    const out = await executePlan(
      { action: 'product_types', family: null, type: null, extreme: null },
      ctx({
        named: ['pvc'],
        message: 'gw nanya produk fitting pvc kok banyak banget ? dibagi menjadi brp kelas ?',
      }),
    );
    const text = textOf(out);
    expect(text).toContain(
      'FITTING PVC di katalog Pralon ada 3 produk. Banyak karena ada 2 jenis fitting',
    );
    expect(text).toContain(
      'Menurut penanda seri di nama produknya: W (2 produk) dan D (1 produk).',
    );
    expect(text).not.toContain('PVC AW');
  });

  it('pertanyaan kasus tanpa model → dasar perhitungan (luas tidak menentukan ukuran)', async () => {
    const out = await executePlan(
      { action: 'case_question', family: null, type: null, extreme: null },
      ctx({ message: 'luas tanahnya 120 meter ngaruh ga ke ukuran pipa?' }),
    );
    expect(textOf(out)).toContain('luas bangunan tidak menentukan ukuran pipa');
  });

  it('kebutuhan / spesifikasi / perusahaan → dikembalikan ke jalurnya sendiri', async () => {
    const plan = (action: 'requirement' | 'product_question' | 'company') =>
      executePlan({ action, family: null, type: null, extreme: null }, ctx({ hasExisting: true }));
    expect(await plan('requirement')).toMatchObject({
      kind: 'route',
      decision: { intent: 'REQUIREMENT_MUTATION', shouldExtract: true },
    });
    expect(await plan('product_question')).toMatchObject({
      decision: { intent: 'PRODUCT_LOOKUP' },
    });
    expect(await plan('company')).toMatchObject({ decision: { intent: 'COMPANY_QUESTION' } });
  });

  it('tindakan katalog tanpa keluarga → none (router lama)', async () => {
    expect(
      await executePlan(
        { action: 'product_sizes', family: null, type: null, extreme: null },
        ctx(),
      ),
    ).toEqual({ kind: 'none' });
  });
});

describe('isConfidentStandalone — kapan perencana dilewati', () => {
  it('intent utuh yang yakin dilewati; lanjutan, ragu, atau tanpa label tetap direncanakan', async () => {
    const { understood } = await import('../../understanding/testing/understood.js');
    const { isConfidentStandalone } = await import('./turn-planner.js');
    const sure = (label: string, score = 0.95) => ({
      ...understood('x'),
      intent: { label: label as never, score },
    });
    expect(isConfidentStandalone(sure('company_question'))).toBe(true);
    expect(isConfidentStandalone(sure('product_range'))).toBe(true);
    expect(isConfidentStandalone(sure('requirement_building'))).toBe(true);
    expect(isConfidentStandalone(sure('company_question', 0.7))).toBe(false);
    expect(isConfidentStandalone(sure('follow_up_continue'))).toBe(false);
    expect(isConfidentStandalone(sure('product_spec'))).toBe(false);
    expect(isConfidentStandalone(understood('x', { intent: null }))).toBe(false);
  });
});
