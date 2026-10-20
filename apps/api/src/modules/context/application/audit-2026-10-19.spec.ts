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
  over: Partial<ProductQuestionInput> = {},
): Promise<readonly AssistantStreamEvent[]> {
  const input: ProductQuestionInput = {
    messageId: 'm',
    message,
    understanding: understood(message, labels),
    lexicon: TEST_LEXICON,
    ...over,
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

describe('audit 2026-10-19 — contoh produk perbandingan', () => {
  it('"bedanya pipa hdpe sama pvc apa?": PVC diwakili PVC AW terkecil, bukan pipa SNI kelas B 355 mm', async () => {
    const pipe = (name: string, family: string, sizes: string[]) =>
      product({ name, family, sizes, category: 'PIPA' });
    const reply = text(
      await ask('bedanya pipa hdpe sama pvc apa?', { intent: 'product_comparison' }, [
        pipe('Pipa (Bell End) Kelas B 355 mm x 6 Meter PVC', 'PVC SNI KELAS B', ['355 mm']),
        pipe('Pipa PVC AW 2" x 4 Meter', 'PVC AW', ['2"']),
        pipe('Pipa PVC AW 1/2" x 4 Meter', 'PVC AW', ['1/2"']),
        pipe('Pipa HDPE PE 100 PN-8 160 mm x 9 Meter', 'HDPE', ['160 mm']),
        pipe('Pipa HDPE PE 100 PN-16 20 mm x 100 Meter', 'HDPE', ['20 mm']),
      ]),
    );
    expect(reply).toContain('Pipa PVC AW 1/2" x 4 Meter');
    expect(reply).toContain('Pipa HDPE PE 100 PN-16 20 mm x 100 Meter');
    expect(reply).not.toContain('Kelas B 355 mm');
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

describe('simulasi test case 2026-10-19 — lanjutan dan bahan bukan Pralon', () => {
  const hdpe = (name: string, sizes: string[]) =>
    product({ name, family: 'HDPE', sizes, category: 'PIPA HDPE' });
  const HDPE_PIPES = [
    hdpe('Pipa HDPE PE 100 PN-10 63 mm x 6 Meter', ['63 mm']),
    hdpe('Pipa HDPE PE 100 PN-10 110 mm x 6 Meter', ['110 mm']),
    hdpe('Pipa HDPE Telkom 32/26 x 100 Meter', ['32/26']),
  ];

  it('"yang pe 100 aja" setelah ukuran per jenis HDPE: ukuran PE 100 saja, bukan daftar jenis lagi', async () => {
    const previous = await ask(
      'ukuran hdpe ada apa aja?',
      { intent: 'product_spec', productAspect: 'sizes' },
      HDPE_PIPES,
    );
    const reply = text(
      await ask('yang pe 100 aja', { intent: 'product_concept' }, HDPE_PIPES, {
        subject: { kind: 'product', entity: 'hdpe', topic: 'product_overview', depth: 'standard' },
        recentTurns: [
          { role: 'user', text: 'ukuran hdpe ada apa aja?' },
          { role: 'assistant', text: text(previous) },
        ],
      }),
    );
    expect(reply).toContain('PE 100');
    expect(reply).toContain('110 mm');
    expect(reply).not.toContain('Telkom');
  });

  it('"pralon jual pipa galvanis?": galvanis bukan produk Pralon — bukan "katalog belum terpasang"', async () => {
    const reply = text(
      await ask('pralon jual pipa galvanis?', { intent: 'product_range' }, HDPE_PIPES),
    );
    expect(reply).toContain('Pipa galvanis (GIP) bukan produk Pralon.');
    expect(reply).not.toMatch(/belum terpasang/);
  });
});

describe('simulasi test case 2026-10-19 — data katalog hanya untuk bahan yang ditanya', () => {
  it('"pipa pvc aw tahan berapa bar?": tanpa daftar HDPE/MDPE', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'pipa pvc aw tahan berapa bar?',
      {
        familyCounts: async () => [
          { family: 'HDPE', count: 3 },
          { family: 'MDPE', count: 2 },
        ],
        productNamesInFamily: async () => ['Pipa HDPE PE 100 PN-10 63 mm x 6 Meter'],
      },
      'id',
      ['pvc aw'],
    );
    expect(a!.text).not.toMatch(/\*\*HDPE\*\*|\*\*MDPE\*\*/);
    expect(a!.text).toContain('spesifikasi produk Pralon');
  });
});

describe('simulasi test case 2026-10-19 — lanjutan atas subjek produk', () => {
  const AW = [
    product({
      name: 'Pipa (TS End) AW 1/2" x 4 Meter',
      family: 'PVC AW',
      sizes: ['1/2"'],
      category: 'PIPA',
    }),
  ];
  it('"lebih detail dong" setelah "pvc aw itu apa?": tetap tentang PVC AW, bukan ikhtisar katalog', async () => {
    const reply = text(
      await ask('lebih detail dong', { intent: 'follow_up_more' }, AW, {
        subject: {
          kind: 'product',
          entity: 'pvc aw',
          topic: 'product_overview',
          depth: 'standard',
        },
        recentTurns: [
          { role: 'user', text: 'pvc aw itu apa?' },
          { role: 'assistant', text: 'AW, D, dan C adalah kelas pipa PVC.' },
        ],
      }),
    );
    expect(reply).toContain('AW');
    expect(reply).not.toMatch(/keluarga\)|24 keluarga|Produk mana/);
  });
});

describe('simulasi test case 2026-10-19 — ukuran fitting', () => {
  const tee = (name: string, sizes: string[]) =>
    product({ name, family: 'FITTING PVC', sizes, category: 'FITTING · TEE' });
  const elbow = (name: string, sizes: string[]) =>
    product({ name, family: 'FITTING PVC', sizes, category: 'FITTING · ELBOW' });
  const ITEMS = [
    tee('Tee Abu Ts 2"', ['2"']),
    tee('Tee Abu Ts 3/4"', ['3/4"']),
    tee('Tee Abu Ts 1/2"', ['1/2"']),
    tee('Tee Abu Ts 3/4" x 1/2"', ['3/4"', '1/2"']),
    // Fitting PVC mencampur inci dan mm; dulu perbandingannya melempar galat di produksi.
    tee('Ts.Tee - W 63 mm x 3/4"', ['63 mm', '3/4"']),
    elbow('Elbow Abu Ts 3/4"', ['3/4"']),
  ];
  /** Fake katalog yang juga menyaring kategori seperti query MySQL-nya. */
  const withCategory = (items: readonly Product[]) => {
    const base = catalogOf(items);
    return {
      ...base,
      listProducts: async (q: { categoryIncludes?: string } & Record<string, unknown>) => {
        const page = await base.listProducts(q as never);
        const term = q.categoryIncludes?.toLowerCase();
        return {
          ...page,
          items: term
            ? page.items.filter((p) => p.category.toLowerCase().includes(term))
            : page.items,
        };
      },
    };
  };
  const run = (message: string, labels: Parameters<typeof understood>[1], over = {}) =>
    runProductQuestion(
      noAi,
      withCategory(ITEMS) as never,
      { answer: () => Promise.reject(new Error('bukan spesifikasi')) } as never,
      {
        messageId: 'm',
        message,
        understanding: understood(message, labels),
        lexicon: TEST_LEXICON,
        ...over,
      },
    );

  it('"tee pvc ada ukuran apa aja?": ukuran tee yang tersedia, urut', async () => {
    const reply = text(
      await run('tee pvc ada ukuran apa aja?', {
        intent: 'product_spec',
        productAspect: 'size_availability',
      }),
    );
    expect(reply).toContain('Tee PVC di katalog Pralon tersedia ukuran 1/2", 3/4", 2", 63 mm');
  });

  it('"kalau yang 3/4?" setelah tee PVC: tee 3/4" saja, bukan tabel diameter atau elbow', async () => {
    const reply = text(
      await run(
        'kalau yang 3/4?',
        {
          intent: 'product_spec',
          productAspect: 'size_availability',
          knowledgeTopics: ['ukuran inci'],
        },
        {
          subject: {
            kind: 'product',
            entity: 'tee pvc',
            topic: 'product_overview',
            depth: 'standard',
          },
        },
      ),
    );
    expect(reply).toContain('Tee Abu Ts 3/4"');
    expect(reply).not.toMatch(/Elbow|diameter luar|Diameter luar/);
  });
});

describe('simulasi test case 2026-10-19 — tee sama ukuran HDPE', () => {
  it('"tee hdpe 110 mm ada?": Tee PE 110 x 110 mm mendahului reducer 250 x 110', async () => {
    const tee = (name: string, sizes: string[]) =>
      product({ name, family: 'FITTING HDPE', sizes, category: 'FITTING · TEE' });
    const reply = text(
      await ask(
        'tee hdpe 110 mm ada?',
        { intent: 'product_spec', productAspect: 'size_availability' },
        [
          tee('Tee (Segmented) PE 250 x 110 mm', ['110 mm']),
          tee('Tee (Segmented) PE 315 x 110 mm', ['110 mm']),
          tee('Tee (Segmented) PE 110 x 110 mm', ['110 mm']),
        ],
      ),
    );
    const listed = reply.split(/\n/).filter((l) => l.startsWith('- '));
    expect(listed[0]).toBe('- Tee (Segmented) PE 110 x 110 mm');
  });
});

describe('simulasi test case 2026-10-19 — ketersediaan ukuran pipa', () => {
  const pipe = (name: string, family: string, sizes: string[]) =>
    product({ name, family, sizes, category: 'PIPA' });
  const ITEMS = [
    pipe('Pipa (TS End) D 4" x 4 Meter', 'PVC D', ['4"']),
    pipe('Pipa (TS End) D 3" x 4 Meter', 'PVC D', ['3"']),
    pipe('Pipa (TS End) AW 1/2" x 4 Meter', 'PVC AW', ['1/2"']),
    pipe('Pipa (TS End) AW 16" x 6 Meter', 'PVC AW', ['16"']),
  ];

  it('"pvc d 4 inch ada?": "Ada", dengan produk PVC D 4"', async () => {
    const reply = text(
      await ask(
        'pvc d 4 inch ada?',
        { intent: 'product_spec', productAspect: 'size_availability' },
        ITEMS,
      ),
    );
    expect(reply.startsWith('Ada. PVC D 4" di katalog Pralon')).toBe(true);
    expect(reply).toContain('- Pipa (TS End) D 4" x 4 Meter');
  });

  it('"pipa pvc aw 7 inch ada?": tidak ada, lalu ukuran yang tersedia — tanpa produk sembarang', async () => {
    const reply = text(
      await ask(
        'pipa pvc aw 7 inch ada?',
        { intent: 'product_spec', productAspect: 'size_availability' },
        ITEMS,
      ),
    );
    expect(reply.startsWith('PVC AW 7" tidak ada di katalog Pralon.')).toBe(true);
    expect(reply).toContain('1/2"');
    expect(reply).not.toContain('tidak tersedia dalam ukuran');
  });
});

describe('audit campuran 2026-10-20 — lanjutan produk bersubjek', () => {
  const fitting = (name: string, sizes: string[], category: string) =>
    product({ name, family: 'FITTING PVC', sizes, category });
  const ITEMS = [
    fitting('Elbow Abu Ts 2"', ['2"'], 'FITTING · ELBOW'),
    fitting('Tee Abu Ts 2"', ['2"'], 'FITTING · TEE'),
    fitting('Tee Abu Ts 3/4"', ['3/4"'], 'FITTING · TEE'),
    product({ name: 'Pipa (TS End) AW 3" x 4 Meter', family: 'PVC AW', sizes: ['3"'] }),
    product({ name: 'Pipa (TS End) AW 1/2" x 4 Meter', family: 'PVC AW', sizes: ['1/2"'] }),
  ];
  /** Seperti query MySQL-nya: katalog uji yang juga menyaring kategori. */
  const catalog = () => {
    const base = catalogOf(ITEMS);
    return {
      ...base,
      listProducts: async (q: { categoryIncludes?: string } & Record<string, unknown>) => {
        const page = await base.listProducts(q as never);
        const term = q.categoryIncludes?.toLowerCase();
        return {
          ...page,
          items: term
            ? page.items.filter((p) => p.category.toLowerCase().includes(term))
            : page.items,
        };
      },
    };
  };
  const run = (message: string, labels: Parameters<typeof understood>[1], over = {}) =>
    runProductQuestion(
      noAi,
      catalog() as never,
      { answer: () => Promise.reject(new Error('bukan spesifikasi')) } as never,
      {
        messageId: 'm',
        message,
        understanding: understood(message, labels),
        lexicon: TEST_LEXICON,
        ...over,
      },
    );
  const elbowSubject = {
    kind: 'product',
    entity: 'elbow pvc',
    topic: 'product_overview',
    depth: 'standard',
  } as const;

  it('lanjutan yang menyebut produk adalah pertanyaan produk, bukan pembuka', async () => {
    const { certainIntent } = await import('./intent-router.js');
    const u = understood('and a tee in the same size?', { intent: 'follow_up_reference' });
    expect(u.families).toEqual(['tee']);
    expect(certainIntent(u, false)?.intent).toBe('PRODUCT_LOOKUP');
    expect(
      certainIntent(understood('boleh', { intent: 'follow_up_continue' }), false)?.intent,
    ).toBe('OUT_OF_SCOPE');
  });

  it('perencana model dilewati untuk lanjutan terstruktur atas subjek produk', async () => {
    const { isStructuredProductFollowUp } = await import('./turn-planner.js');
    const fittingKind = (f: string) => TEST_LEXICON.isFittingFamily(f);
    const hdpe = { ...elbowSubject, entity: 'hdpe' };
    const pressure = understood('what pressure class for 110 mm?', {
      intent: 'product_spec',
      productAspect: 'pressure_class',
    });
    expect(isStructuredProductFollowUp(pressure, hdpe, pressure.text, fittingKind)).toBe(true);
    const tee = understood('and a tee in the same size?', { intent: 'follow_up_reference' });
    expect(isStructuredProductFollowUp(tee, elbowSubject, tee.text, fittingKind)).toBe(true);
    // Tanpa subjek, atau tanpa ukuran/jenis fitting: konteksnya tetap dibaca perencana.
    expect(isStructuredProductFollowUp(pressure, undefined, pressure.text, fittingKind)).toBe(
      false,
    );
    const largest = understood('yang paling besar berapa?', {
      intent: 'product_spec',
      productAspect: 'sizes',
    });
    expect(isStructuredProductFollowUp(largest, hdpe, largest.text, fittingKind)).toBe(false);
  });

  it('"and a tee in the same size?" setelah elbow 2": tee 2" dari katalog, ukuran dari pesan sebelumnya', async () => {
    const reply = text(
      await run(
        'and a tee in the same size?',
        { intent: 'follow_up_reference' },
        {
          subject: elbowSubject,
          recentTurns: [
            { role: 'user', text: 'do you have a 2 inch pvc elbow?' },
            { role: 'assistant', text: 'elbow PVC 2" in the Pralon catalogue: Elbow Abu Ts 2"' },
          ],
        },
      ),
    );
    expect(reply).toContain('Tee Abu Ts 2"');
    expect(reply).not.toContain('Tee Abu Ts 3/4"');
    expect(reply).not.toContain('Elbow');
  });
});
