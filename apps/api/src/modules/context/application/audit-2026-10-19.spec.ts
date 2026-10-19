/**
 * Regresi audit live 2026-10-19 (pertanyaan perpipaan di ai.pralon.co.id). Satu berkas supaya temuan
 * dan perbaikannya terbaca bersama; setiap tes menyebut kalimat yang salah dijawab di produksi.
 * Pengenalan kalimatnya diukur di understanding.eval (data contoh); di sini aturan atas hasilnya.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({
    LLM_CHAT_REPLY: false,
    LLM_STRUCTURED_RETRY: false,
    LLM_SOLUTION_PROSE: false,
    LLM_FAQ_REWRITE: false,
  }),
}));

import type { AssistantStreamEvent, Product } from '@snouty/shared-types';
import { TEST_LEXICON, understood } from '../../understanding/testing/understood.js';
import { IntentRouter } from './intent-router.js';
import { knowledgeAnswer } from './knowledge-answer.js';
import { capturedPhrase, formatTechnicalValue } from '../domain/technical.js';
import { conceptsFor } from './pipe-knowledge.js';
import { runProductQuestion, type ProductQuestionInput } from './product-question-pipeline.js';

const text = (events: readonly AssistantStreamEvent[]) =>
  events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join('\n');

function product(over: Partial<Product> & Pick<Product, 'name' | 'family' | 'sizes'>): Product {
  return {
    id: over.name.padEnd(26, 'X').slice(0, 26),
    sku: over.name,
    category: 'FITTING · TEE',
    description: '',
    status: 'active',
    material: { provenance: 'VERIFIED', value: 'uPVC' },
    standard: { provenance: 'UNAVAILABLE', value: null },
    pressureClass: { provenance: 'UNAVAILABLE', value: null },
    rodLength: { provenance: 'UNAVAILABLE', value: null },
    jointType: { provenance: 'UNAVAILABLE', value: null },
    application: { provenance: 'UNAVAILABLE', value: null },
    sourceDocument: 'Katalog',
    sourcePage: 1,
    catalogVersionId: 'V'.repeat(26),
    imageUrl: null,
    ...over,
  };
}

/** Katalog uji: daftar produk disaring keluarga dan ukuran seperti query MySQL-nya. */
function catalogOf(items: readonly Product[]) {
  return {
    activeVersion: async () =>
      ({ id: 'V', label: 'v1', sourceDocument: 'dok', kind: 'pralon', status: 'active' }) as never,
    listProducts: async (q: {
      q?: string;
      family?: string;
      size?: { toString(): string };
      limit?: number;
    }) => {
      const wanted = q.size?.toString();
      const term = q.q?.toLowerCase();
      const found = items.filter(
        (p) =>
          (term === undefined || `${p.name} ${p.family}`.toLowerCase().includes(term)) &&
          (q.family === undefined || p.family === q.family) &&
          (wanted === undefined || p.sizes.includes(wanted)),
      );
      return { items: found.slice(0, q.limit ?? 50), nextCursor: null };
    },
    familyCounts: async () => {
      const counts = new Map<string, number>();
      for (const p of items) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
      return [...counts.entries()].map(([family, count]) => ({ family, count }));
    },
    productNamesInFamily: async (family: string) =>
      items.filter((p) => p.family === family).map((p) => p.name),
    categoryCounts: async () => [],
  };
}

const noAi = {
  parseProductQuestion: () => Promise.reject(new Error('model tidak boleh dipanggil')),
} as never;

function ask(
  message: string,
  labels: Parameters<typeof understood>[1],
  items: readonly Product[] = [],
): Promise<readonly AssistantStreamEvent[]> {
  const input: ProductQuestionInput = {
    messageId: 'm',
    message,
    understanding: understood(message, labels),
    lexicon: TEST_LEXICON,
  };
  return runProductQuestion(
    noAi,
    catalogOf(items) as never,
    { answer: () => Promise.reject(new Error('bukan spesifikasi')) } as never,
    input,
  );
}

const PVC_TEES = [
  product({ name: 'Tee Abu Ts 2" x 3/4"', family: 'FITTING PVC', sizes: ['2"', '3/4"'] }),
  product({ name: 'Tee Abu Ts 3" x 2"', family: 'FITTING PVC', sizes: ['3"', '2"'] }),
  product({ name: 'Tee Abu Ts 4" x 2"', family: 'FITTING PVC', sizes: ['4"', '2"'] }),
  product({ name: 'Tee DV Abu 3" x 2"', family: 'FITTING PVC', sizes: ['3"', '2"'] }),
  product({ name: 'Tee Abu Ts 2" x 1"', family: 'FITTING PVC', sizes: ['2"', '1"'] }),
  product({ name: 'Tee DV Abu 4" x 2"', family: 'FITTING PVC', sizes: ['4"', '2"'] }),
  product({ name: 'Bell Tee TS Branch - W 160 mmx 2"', family: 'FITTING PVC', sizes: ['2"'] }),
  product({ name: 'Tee Abu Ts 2"', family: 'FITTING PVC', sizes: ['2"'] }),
];

const KNOWLEDGE_CATALOG = {
  familyCounts: async () => [
    { family: 'FITTING HDPE', count: 3 },
    { family: 'PVC D', count: 2 },
    { family: 'PVC S-10', count: 2 },
  ],
  productNamesInFamily: async () => [],
};

describe('audit 2026-10-19 — jawaban produk', () => {
  it('"pipa ppr pralon ada ga?": dibuka dengan PPR tidak ada di katalog Pralon, bukan pipa gas', async () => {
    const reply = text(
      await ask('pipa ppr pralon ada ga?', { intent: 'product_concept', knowledgeTopics: [] }, [
        product({ name: 'Pipa PVC AW 1/2"', family: 'PVC AW', sizes: ['1/2"'] }),
      ]),
    );
    expect(reply.startsWith('PPR tidak ada di katalog Pralon.')).toBe(true);
    expect(reply).not.toMatch(/gas|"ppr"/i);
    expect(reply).not.toContain('Pipa PVC AW');
  });

  it('"fitting tee 2 inch pvc ada?": tee 2" polos tampil pertama, tanpa kalimat soal katalog', async () => {
    const reply = text(
      await ask(
        'fitting tee 2 inch pvc ada?',
        { intent: 'product_spec', productAspect: 'size_availability' },
        PVC_TEES,
      ),
    );
    const listed = reply.split(/\n/).filter((l) => l.startsWith('- '));
    // Judulnya seperti orang menyebut barang, bukan label katalog ("FITTING PVC, jenis tee, ukuran 2").
    expect(reply.startsWith('Tee PVC 2" di katalog Pralon')).toBe(true);
    expect(listed[0]).toBe('- Tee Abu Ts 2"');
    expect(listed[1]).toMatch(/^- Tee Abu Ts 2" x/);
    expect(reply).not.toMatch(/hanya disebut bila tercatat/);
  });
});

describe('audit 2026-10-19 — pengetahuan bersumber', () => {
  it('sambungan HDPE: las panas, bukan lem, dan stub end + flange dari katalog', async () => {
    const a = await knowledgeAnswer(
      ['sambungan hdpe'],
      'sambungan pipa hdpe pakai apa aja?',
      KNOWLEDGE_CATALOG,
      'id',
      ['hdpe'],
    );
    expect(a!.text).toContain('Pipa HDPE tidak dilem');
    expect(a!.text).toContain('electrofusion');
    expect(a!.text).toContain('stub end dengan flange');
  });

  it('pipa pembuangan: kemiringan 2 % dan kloset 4" dari acuan hitungan, dengan statusnya', async () => {
    const a = await knowledgeAnswer(
      ['pipa pembuangan'],
      'kemiringan pipa air kotor berapa persen?',
      KNOWLEDGE_CATALOG,
      'id',
    );
    expect(a!.text).toContain('kemiringan 2 %');
    expect(a!.text).toContain('kloset 4"');
    expect(a!.text).toContain('belum divalidasi tim teknis Pralon');
    expect(a!.text).not.toMatch(/Susun rekomendasi/);
  });

  it('air minum: SNI seri S dan formulasi bebas timbal, bukan ketahanan kimia', async () => {
    const a = await knowledgeAnswer(
      ['air minum'],
      'is pralon pipe safe for drinking water?',
      KNOWLEDGE_CATALOG,
      'en',
    );
    expect(a!.text).toContain('SNI S-series');
    expect(a!.text).toContain('lead-free');
    expect(a!.text).not.toMatch(/chemical, its concentration/);
  });

  it('tekanan kerja HDPE PN 10: dijawab PN dulu, bukan kelas PVC', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'tekanan kerja pipa hdpe pn 10 berapa bar?',
      KNOWLEDGE_CATALOG,
      'id',
      ['hdpe'],
    );
    expect(a!.text.startsWith('Pada pipa HDPE, angka PN adalah tekanan nominalnya dalam bar')).toBe(
      true,
    );
  });

  it('PVC untuk air panas: PPR disebut bukan produk Pralon', async () => {
    const a = await knowledgeAnswer(
      ['air panas'],
      'pipa pvc boleh dipakai buat air panas?',
      KNOWLEDGE_CATALOG,
      'id',
      ['pvc'],
    );
    expect(a!.text).toContain('Pipa PPR tidak termasuk produk Pralon.');
    expect(a!.text).not.toMatch(/data saya/);
  });
});

describe('audit 2026-10-19 — router dan tampilan', () => {
  const never = {
    classifyIntent: () => Promise.reject(new Error('model tidak boleh dipanggil')),
  } as never;

  it('"talang air hujan atap 150 m2 pakai pipa berapa inch?" tanpa kebutuhan: kasusnya dimulai, bukan "tekan Susun rekomendasi"', async () => {
    const decision = await new IntentRouter(never).route(
      understood('talang air hujan atap 150 m2 pakai pipa berapa inch?', {
        intent: 'explanation_request',
        useCase: null,
      }),
      false,
    );
    expect(decision.intent).toBe('REQUIREMENT_STATEMENT');
  });

  it('pertanyaan "jelaskan" tanpa kebutuhan dan tanpa hal kebutuhan diserahkan ke model', async () => {
    let asked = 0;
    const ai = {
      classifyIntent: () => {
        asked += 1;
        return Promise.resolve({ intent: 'PRODUCT_LOOKUP', confidence: 0.9 });
      },
    } as never;
    const decision = await new IntentRouter(ai).route(
      understood('kenapa ukurannya segitu?', {
        intent: 'explanation_request',
        mentionsRequirement: false,
      }),
      false,
    );
    expect(asked).toBe(1);
    expect(decision.intent).toBe('PRODUCT_LOOKUP');
  });

  it('balasan Inggris kasus teknis: "5 floors", bukan "5 lantai"', () => {
    const p = { label: 'Jumlah lantai', value: 5, unit: 'lantai', origin: 'known' } as const;
    expect(formatTechnicalValue(p, 'en', 'building_floors')).toBe('5 floors');
    expect(formatTechnicalValue(p, 'id', 'building_floors')).toBe('5 lantai');
  });

  it('luas atap di bawah satu hektar dibaca m², bukan "0,02 ha"', () => {
    const area = { label: 'Luas tangkapan', value: 0.015, unit: 'ha', origin: 'known' } as const;
    expect(formatTechnicalValue(area, 'id')).toBe('150 m²');
    expect(formatTechnicalValue({ ...area, value: 2 }, 'id')).toBe('2 ha');
  });

  it('nilai pilihan di tengah kalimat ditulis kecil, singkatan tetap', () => {
    expect(capturedPhrase('Sumber air', 'Sumur')).toBe('sumber air sumur');
    expect(capturedPhrase('Sumber air', 'PDAM')).toBe('sumber air PDAM');
  });

  it('"kenapa pipa pvc bisa pecah?": daftar gangguan, tidak dibuka dengan bocor sambungan', () => {
    const [faults] = conceptsFor(['perawatan dan gangguan']);
    expect(faults!.text.startsWith('Gangguan yang lazim pada pipa PVC')).toBe(true);
    expect(faults!.text).toContain('- Pipa retak atau pecah');
  });

  it('"butuh berapa batang pipa 4 meter untuk jalur 30 meter?": jawaban hitung, bukan model', async () => {
    const decision = await new IntentRouter(never).route(
      understood('butuh berapa batang pipa 4 meter untuk jalur 30 meter?', {
        intent: 'system_layout_question',
        knowledgeTopics: ['jumlah batang'],
      }),
      false,
    );
    expect(decision.intent).toBe('PRODUCT_LOOKUP');
    const a = await knowledgeAnswer(
      ['jumlah batang'],
      'butuh berapa batang pipa 4 meter untuk jalur 30 meter?',
      {
        familyCounts: async () => [{ family: 'PVC AW', count: 1 }],
        productNamesInFamily: async () => ['Pipa PVC AW 1/2" x 4 Meter'],
      },
      'id',
    );
    expect(a!.text).toContain('30 m');
    expect(a!.text).toContain('batang 4 m → 8 batang');
  });
});
