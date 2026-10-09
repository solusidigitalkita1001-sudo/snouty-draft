/**
 * Ruas pertanyaan produk. Yang dipaku:
 *   - KONSEP dijawab utuh dari pengetahuan umum — tanpa katalog, tanpa model;
 *   - katalog hanya PENDUKUNG jawaban konsep, dan hanya bila otoritatif (`pralon`);
 *   - katalog contoh tidak pernah bocor: tidak ada "CONTOH …", tidak ada klaim tentang Pralon;
 *   - katalog yang gagal dibaca tidak mengubah penjelasan teknik;
 *   - SPESIFIKASI dari katalog aktif lewat `ProductQuestionService`, kalimatnya membawa sumber;
 *   - "A dan B" → dua pencarian; produk `discontinued` tidak dihitung ada;
 *   - parse model gagal → bertanya produk mana, tidak melempar.
 *
 * Pemahaman pesan (P16-11) diberikan eksplisit lewat `understood()`: yang diuji adalah aturan
 * atas pemahaman itu, bukan pengenalan kalimatnya (itu diukur understanding.eval.spec.ts).
 */
import type { AssistantStreamEvent, CatalogVersionKind, Product } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import { CatalogUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import type { ProductAnswer } from '../../product-knowledge/domain/product-answer.js';
import { TEST_LEXICON, understood } from '../../understanding/testing/understood.js';
import type { MessageUnderstanding } from '../../understanding/application/message-understanding.js';
import { FITTING_VS_MATERIAL } from '../domain/subject.js';
import { explain } from './pipe-knowledge.js';
import {
  bestMatch,
  runProductQuestion,
  type ProductQuestionInput,
} from './product-question-pipeline.js';

const AW: Product = {
  id: 'A'.repeat(26),
  sku: 'AW',
  name: 'Pipa PVC AW',
  family: 'PVC AW',
  category: 'PIPA AIR BERSIH · SNI',
  description: 'Pipa untuk air bersih bertekanan.',
  status: 'active',
  sizes: ['1/2"', '3/4"'],
  material: { provenance: 'VERIFIED', value: 'uPVC' },
  standard: { provenance: 'VERIFIED', value: 'SNI 06-0084' },
  pressureClass: { provenance: 'UNAVAILABLE', value: null },
  rodLength: { provenance: 'VERIFIED', value: '4 m' },
  jointType: { provenance: 'VERIFIED', value: 'Solvent cement' },
  application: { provenance: 'VERIFIED', value: 'Air bersih' },
  sourceDocument: 'Katalog 2026',
  sourcePage: 14,
  catalogVersionId: 'V'.repeat(26),
  imageUrl: null,
};
const SAMPLE_AW: Product = { ...AW, sku: 'DEV-AW', name: 'CONTOH Pipa PVC AW' };

function ai(parse: {
  productQuery: string | null;
  aspect: ProductAnswer['aspect'] | null;
  size?: string | null;
}) {
  return {
    parseProductQuestion: async () => ({ size: null, ...parse }),
  } as never;
}
const failingAi = {
  parseProductQuestion: async () => {
    throw new AiOutputInvalidError('product_question', 'rusak');
  },
} as never;

function catalog(byTerm: Record<string, Product[]>, kind: CatalogVersionKind = 'pralon') {
  return {
    async activeVersion() {
      return { id: 'V', label: 'v1', sourceDocument: 'dok', kind, status: 'active' } as never;
    },
    async listProducts({ q }: { q?: string }) {
      return { items: byTerm[q ?? ''] ?? [], nextCursor: null };
    },
    ...summaryOf(Object.values(byTerm).flat()),
  };
}

/** Ringkasan katalog (jumlah per keluarga, nama per keluarga) dari daftar produk uji. */
function summaryOf(items: readonly Product[]) {
  const unique = [...new Map(items.map((p) => [p.id, p])).values()];
  return {
    async familyCounts() {
      const counts = new Map<string, number>();
      for (const p of unique) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
      return [...counts.entries()].map(([family, count]) => ({ family, count }));
    },
    async productNamesInFamily(family: string) {
      return unique.filter((p) => p.family === family).map((p) => p.name);
    },
    async categoryCounts(family: string) {
      const counts = new Map<string, number>();
      for (const p of unique.filter((x) => x.family === family))
        counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
      return [...counts.entries()].map(([category, count]) => ({ category, count }));
    },
  };
}
const brokenCatalog = {
  async activeVersion(): Promise<never> {
    throw new CatalogUnavailableError();
  },
  async listProducts(): Promise<never> {
    throw new Error('tidak boleh sampai sini');
  },
  async familyCounts(): Promise<never> {
    throw new CatalogUnavailableError();
  },
  async productNamesInFamily(): Promise<never> {
    throw new CatalogUnavailableError();
  },
  async categoryCounts(): Promise<never> {
    throw new CatalogUnavailableError();
  },
};

const questions = (answer: ProductAnswer) => ({
  async answer() {
    return answer;
  },
});
const noQuestions = questions({} as never);

const text = (events: readonly AssistantStreamEvent[]) =>
  events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join('');
const cards = (events: readonly AssistantStreamEvent[]) =>
  events.filter((e) => e.type === 'card').map((e) => (e as { card: { kind: string } }).card);

type Labels = Parameters<typeof understood>[1];
/** Masukan ruas: pesan + pemahamannya (label eksplisit, keluarga produk dari kosakata asli). */
function input(
  message: string,
  labels: Labels = {},
  over: Partial<Omit<ProductQuestionInput, 'message' | 'understanding' | 'lexicon'>> = {},
): ProductQuestionInput {
  return {
    messageId: 'm',
    message,
    understanding: understood(message, labels) satisfies MessageUnderstanding,
    lexicon: TEST_LEXICON,
    ...over,
  };
}
const COMPARISON: Labels = { intent: 'product_comparison' };
const CONCEPT: Labels = { intent: 'product_concept' };
const SPEC = (productAspect: NonNullable<MessageUnderstanding['productAspect']>): Labels => ({
  intent: 'product_spec',
  productAspect,
});

describe('runProductQuestion — KONSEP', () => {
  it('"pipa buat air panas pake apa?" saat subjeknya HDPE vs PVC: dijawab topik air panas, bukan perbandingan ulang (live 2026-10-08)', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      brokenCatalog,
      noQuestions,
      input(
        'pipa buat air panas pake apa?',
        { intent: 'use_question', knowledgeTopics: ['air panas'] },
        {
          subject: {
            kind: 'product',
            entity: 'hdpe dan pvc',
            topic: 'comparison',
            depth: 'standard',
          },
        },
      ),
    );
    const out = text(events);
    expect(out).toMatch(/^Untuk air panas, bahan yang lazim adalah \*\*PPR\*\*/);
    expect(out).not.toContain('Singkatnya');
  });

  it('"apa bedanya fitting sama hdpe?" setelah PVC vs HDPE: subjek tidak ditarik masuk — komponen vs bahan, bukan PVC vs HDPE lagi (live 2026-10-08)', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      brokenCatalog,
      noQuestions,
      input(
        'apa bedanya fitting sama hdpe?',
        { ...COMPARISON, knowledgeTopics: ['fitting'] },
        {
          subject: {
            kind: 'product',
            entity: 'pvc dan hdpe',
            topic: 'comparison',
            depth: 'standard',
          },
        },
      ),
    );
    const out = text(events);
    expect(out).toContain('**HDPE** adalah bahan pipa, sedangkan **fitting**');
    expect(out).not.toContain('Singkatnya, **PVC');
  });

  it('"apa bedanya fitting sama hdpe?" adalah KONSEP walau model bilang compatible_fittings; produk pendukung = keluarga HDPE, bukan pipa kabel', async () => {
    const telkom: Product = {
      ...AW,
      id: 'T'.repeat(26),
      sku: '__export__.product_product_10197',
      name: 'Pipa HDPE Telkom 40/33 x 182 Meter Orange Garis Biru',
      family: 'PIPA TELKOM',
      category: 'PIPA KABEL',
    };
    const hdpe: Product = {
      ...AW,
      id: 'H'.repeat(26),
      sku: 'HDPE-63',
      name: 'Pipa HDPE PE100 63 mm',
      family: 'HDPE',
      category: 'PIPA AIR BERSIH · HDPE',
    };
    let asked = 0;
    const events = await runProductQuestion(
      ai({ productQuery: 'HDPE', aspect: 'compatible_fittings' }),
      catalog({ hdpe: [telkom, hdpe] }),
      {
        async answer() {
          asked += 1;
          throw new Error('aspek tidak boleh ditanyakan untuk pertanyaan konsep');
        },
      } as never,
      input('apa bedanya fitting sama hdpe ?', { ...COMPARISON, knowledgeTopics: ['fitting'] }),
    );
    const out = text(events);
    expect(asked).toBe(0);
    expect(out).toContain(
      '**HDPE** adalah bahan pipa, sedangkan **fitting** adalah komponen penyambungnya',
    );
    expect(out).toContain('Fitting adalah komponen penyambung pipa');
    expect(out).not.toContain('belum tercantum di katalog');
    const productCard = cards(events).find((c) => c.kind === 'product') as
      { kind: 'product'; products: readonly { name: string }[] } | undefined;
    expect(productCard?.products[0]?.name).toBe('Pipa HDPE PE100 63 mm');
  });

  it('bestMatch: keluarga sama menang atas nama yang kebetulan memuat istilah; pipa menang atas fitting', () => {
    const fitting: Product = {
      ...AW,
      id: 'F'.repeat(26),
      name: 'Tee HDPE 63',
      family: 'FITTING HDPE',
      category: 'FITTING',
    };
    const pipe: Product = {
      ...AW,
      id: 'P'.repeat(26),
      name: 'Pipa HDPE PE100 63 mm',
      family: 'HDPE',
      category: 'PIPA HDPE',
    };
    const cable: Product = {
      ...AW,
      id: 'C'.repeat(26),
      name: 'Pipa HDPE Telkom',
      family: 'PIPA TELKOM',
      category: 'PIPA KABEL',
    };
    expect(bestMatch([cable, fitting, pipe], 'hdpe')?.id).toBe(pipe.id);
    expect(bestMatch([cable, fitting], 'hdpe')?.id).toBe(fitting.id);
    expect(bestMatch([], 'hdpe')).toBeUndefined();
    // Katalog Pralon sungguhan: pipa pelindung kabel Telkom dan pipa air PE 100 ada di keluarga
    // HDPE yang SAMA — pipa air yang mewakili istilah "HDPE".
    const telkomSameFamily: Product = {
      ...pipe,
      id: 'K'.repeat(26),
      name: 'Pipa HDPE Telkom 40/33 x 182 Meter Orange Garis Biru',
    };
    const pe100: Product = {
      ...pipe,
      id: 'E'.repeat(26),
      name: 'Pipa HDPE PE 100 PN-8 63 mm x 75 Meter',
    };
    expect(bestMatch([telkomSameFamily, pe100], 'hdpe')?.id).toBe(pe100.id);
  });

  it('"bikinin skema perbedaannya dalam bentuk table" setelah jawaban fitting vs HDPE → tabel dari jawaban terakhir, bukan "Produk mana"', async () => {
    const previous = explain({
      families: ['hdpe'],
      topics: ['fitting'],
      comparison: true,
      aboutMaterial: true,
    });
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      brokenCatalog,
      noQuestions,
      input(
        'bikinin skema perbedaan nya dalam bentuk table dong biar lebih enak dibaca',
        { intent: 'follow_up_reformat', format: 'table' },
        {
          recentTurns: [
            { role: 'user', text: 'apa bedanya fitting sama hdpe ?' },
            { role: 'assistant', text: previous },
          ],
          // Topik subjek yang disimpan productSubject setelah 'fitting vs HDPE'.
          subject: {
            kind: 'product',
            entity: 'hdpe',
            topic: FITTING_VS_MATERIAL,
            depth: 'standard',
          },
        },
      ),
    );
    const out = text(events);
    expect(out).toContain('| Aspek | **HDPE** | **Fitting** |');
    expect(out).toContain('| Apa itu | bahan pipa');
    expect(out).not.toContain('Produk mana');
    expect(cards(events)).toEqual([]);
  });

  it('"harganya berapa?" (harga nonaktif, OQ-03) → jawaban tetap + CTA, bukan "Produk mana"', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      brokenCatalog,
      noQuestions,
      input(
        'harganya berapa?',
        { intent: 'price_question' },
        {
          subject: {
            kind: 'product',
            entity: 'hdpe',
            topic: 'product_overview',
            depth: 'standard',
          },
        },
      ),
    );
    expect(text(events)).toContain('Harga tidak saya tampilkan di sini');
    expect(text(events)).not.toContain('Produk mana');
    expect(cards(events)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);
  });

  it('"yang mana buat kamar mandi?" setelah PVC D vs AW → lanjutan subjek: kelas AW/D dijelaskan, bukan pembuka', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      brokenCatalog,
      noQuestions,
      input(
        'yang mana buat kamar mandi?',
        { intent: 'follow_up_choice' },
        {
          subject: {
            kind: 'product',
            entity: 'pvc d dan pvc aw',
            topic: 'comparison',
            depth: 'standard',
          },
        },
      ),
    );
    expect(text(events)).toContain('adalah kelas pipa PVC');
    expect(text(events)).not.toContain('Produk mana');
  });

  it('"apa bedanya pvc sama hdpe" dijawab utuh tanpa katalog dan tanpa model', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      brokenCatalog,
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
    );
    const out = text(events);
    expect(out).toContain('Singkatnya, **PVC (uPVC) kaku');
    expect(out).toContain('- Sambungan:');
    // Katalog gagal dibaca → tidak ada klaim tentang Pralon, hanya ajakan ke tim teknis.
    expect(out).not.toContain('tidak ada di katalog');
    expect(out).toContain('tim teknis Pralon bisa membantu');
    expect(cards(events)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);
    expect(events.at(-1)?.type).toBe('message.end');
  });

  it('anti-ulang: penjelasan yang baru diberikan tidak diulang utuh untuk pertanyaan lain; pertanyaan yang sama boleh', async () => {
    const full = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      brokenCatalog,
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
    );
    const previous = text(full);
    const turns = [
      { role: 'user' as const, text: 'apa bedanya pvc sama hdpe?' },
      { role: 'assistant' as const, text: previous },
    ];

    const other = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      brokenCatalog,
      noQuestions,
      // Pertanyaan lain yang bukan harga — harga punya jawaban tetapnya sendiri (OQ-03).
      input('kalau pvc vs hdpe soal ketahanannya?', COMPARISON, { recentTurns: turns }),
    );
    expect(text(other)).toContain('Seperti tadi: **PVC (uPVC) kaku');
    expect(text(other)).not.toContain('- Sambungan:');

    const again = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      brokenCatalog,
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON, { recentTurns: turns }),
    );
    expect(text(again)).toContain('- Sambungan:');
  });

  it('katalog CONTOH tidak pernah bocor: tanpa "CONTOH …", tanpa "tidak ada di katalog Pralon"', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      catalog({ pvc: [SAMPLE_AW] }, 'sample'),
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
    );
    const out = text(events);
    expect(out).toContain('Singkatnya, **PVC (uPVC) kaku');
    expect(out).not.toContain('CONTOH');
    expect(out).not.toContain('tidak ada di katalog');
    expect(cards(events).map((c) => c.kind)).toEqual(['cta']);
  });

  it('katalog Pralon (otoritatif) menjadi pendukung: produk yang ada, yang tidak ada, kartu', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      catalog({ pvc: [AW] }),
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
    );
    const out = text(events);
    expect(out).toContain('Singkatnya, **PVC (uPVC) kaku');
    expect(out).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');
    expect(out).toContain('Contoh produknya di katalog Pralon:');
    expect(out).toContain('Pipa PVC AW:');
    expect(cards(events).map((c) => c.kind)).toEqual(['product', 'cta']);
  });

  it('model merangkai di atas DATA (pengetahuan + katalog); yang tak disebut ditempel', async () => {
    const reply = {
      calls: [] as unknown[],
      async write(input: { facts?: string; systemPrompt?: string }) {
        this.calls.push(input);
        return {
          text: '**PVC**\n- Kaku, dilem.\n- Batangan.\n- Tahan korosi.\n- Bangunan.\n\n**HDPE**\n- Lentur, dilas.\n- Gulungan.\n- Tahan benturan.\n- Jalur tanam.',
          source: 'llm' as const,
        };
      },
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      catalog({ pvc: [AW] }),
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
      reply as never,
      'PROMPT-FAQ',
    );
    const out = text(events);
    expect(out).toContain('**PVC**\n- Kaku, dilem.');
    expect(out).toContain('Pipa PVC AW:'); // produk tak disebut → ikut
    expect(out).toContain('"hdpe" tidak ada di katalog'); // katalog tak disinggung → ikut
    const call = reply.calls[0] as { systemPrompt?: string; facts?: string };
    expect(call.systemPrompt).toBe('PROMPT-FAQ');
    expect(call.facts).toContain('Singkatnya, **PVC (uPVC) kaku');
    expect(call.facts).toContain('"hdpe" tidak ada di katalog');
  });

  it('model yang meringkas DATA berbutir menjadi satu paragraf ditolak → teks deterministik', async () => {
    const reply = {
      write: async () => ({
        text: 'Secara umum PVC kaku dan HDPE lentur; PVC untuk bangunan, HDPE untuk jalur tanam.',
        source: 'llm' as const,
      }),
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
      reply as never,
      'PROMPT-FAQ',
    );
    const out = text(events);
    expect(out).toContain('**PVC (uPVC)**\n- Bentuk:');
    expect(out).not.toContain('Secara umum PVC kaku dan HDPE lentur;');
  });

  it('yang sudah disebut model tidak diulang di bawahnya', async () => {
    const reply = {
      write: async () => ({
        text: '**PVC**\n- Kaku.\n- Dilem.\n- Batangan.\n- Bangunan.\n\n**HDPE**\n- Lentur.\n- Dilas.\n- Gulungan.\n- Tanam.\n\nDi katalog Pralon ada Pipa PVC AW; HDPE tidak ada di katalog.',
        source: 'llm' as const,
      }),
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      catalog({ pvc: [AW] }),
      noQuestions,
      input('apa bedanya pvc sama hdpe?', COMPARISON),
      reply as never,
      'PROMPT-FAQ',
    );
    expect(text(events)).toBe(
      '**PVC**\n- Kaku.\n- Dilem.\n- Batangan.\n- Bangunan.\n\n**HDPE**\n- Lentur.\n- Dilas.\n- Gulungan.\n- Tanam.\n\nDi katalog Pralon ada Pipa PVC AW; HDPE tidak ada di katalog.',
    );
  });

  it('tanpa aspek dan tanpa bahan yang dikenali: ikhtisar produk Pralon bila ada, ragam produk bila tidak — tidak bertanya balik', async () => {
    const found = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: null }),
      catalog({ 'pvc aw': [AW] }),
      noQuestions,
      input('apa itu pvc aw?', CONCEPT),
    );
    expect(text(found)).toContain('Pipa PVC AW: Pipa untuk air bersih');

    const unknown = await runProductQuestion(
      ai({ productQuery: 'xyz', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      input('apa itu xyz?', CONCEPT),
    );
    expect(text(unknown)).not.toContain('Produk mana yang Anda maksud?');
    expect(text(unknown)).toContain('Katalog produk Pralon belum terpasang');
  });
});

describe('runProductQuestion — nada percakapan', () => {
  it('"HDPE di Pralon ok nggak?" → prosa dua arah + MENGAPA Pralon-nya belum bisa dijawab; penutup tidak diulang', async () => {
    const first = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      input('kalo pipa HDPE di Pralon gmn? ok ngga?', CONCEPT),
    );
    const out = text(first);
    expect(out).toMatch(/^\*\*HDPE\*\* lentur dan ulet/);
    expect(out).toContain('**cocok untuk jalur panjang');
    expect(out).toContain('kurang cocok untuk');
    expect(out).toContain('katalog Pralon belum terpasang di sistem ini');
    expect(out).not.toContain('- Bentuk:');
    expect(cards(first)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);

    const second = await runProductQuestion(
      ai({ productQuery: 'ppr', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      input('kalau PPR di Pralon?', CONCEPT, {
        recentTurns: [
          { role: 'user', text: 'kalo pipa HDPE di Pralon gmn? ok ngga?' },
          { role: 'assistant', text: out },
        ],
      }),
    );
    expect(text(second)).not.toContain('katalog Pralon belum terpasang'); // sudah dibilang tadi
  });
});

describe('runProductQuestion — RAGAM produk ("produk Pralon yang terkenal apa?")', () => {
  it('katalog Pralon: SELURUH keluarga dengan jumlah sebenarnya; jenis per keluarga; tabel tanpa PVC vs HDPE', async () => {
    // Verifikasi 2026-10-09: ikhtisar dulu membaca 50 produk pertama — 8 dari 24 keluarga.
    const D = { ...AW, id: 'B'.repeat(26), sku: 'D', name: 'Pipa PVC D', family: 'PVC D' };
    const hdpe = (id: string, name: string) => ({ ...AW, id, sku: id, name, family: 'HDPE' });
    const items = [
      AW,
      D,
      hdpe('H'.repeat(26), 'Pipa HDPE PE 100 PN-8 160 mm x 9 Meter'),
      hdpe('I'.repeat(26), 'Pipa HDPE PE 100 PN-16 63 mm x 6 Meter'),
      hdpe('J'.repeat(26), 'Pipa HDPE Telkom 40/33 x 182 Meter Orange Garis Biru'),
      {
        ...AW,
        id: 'K'.repeat(26),
        sku: 'FH',
        name: 'Tee (Segmented) PE 315 x 160 mm',
        family: 'FITTING HDPE',
      },
    ];
    const full = { ...catalog({ '': items }) };

    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      full,
      noQuestions,
      input('gw mau nanya produk pralon itu yang terkenal apa sih?', { intent: 'product_range' }),
    );
    const out = text(events);
    expect(out).toContain(
      'Katalog Pralon yang aktif memuat 6 produk dalam 4 keluarga, dihitung per SKU aktif (tiap ukuran dan varian dihitung sendiri).',
    );
    expect(out).toContain('- **PVC** — 2 produk: AW, D');
    expect(out).toContain('- **HDPE** — 3 produk');
    expect(out).toContain('Fitting:\n\n- **FITTING HDPE** — 1 produk');

    // "HDPE di pralon jenisnya apa aja?" — jenis dari nama produk, dengan PN dan jumlahnya.
    const types = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: null }),
      full,
      noQuestions,
      // Aspek "ukuran" ikut terbaca dari kata "jenis" (produksi 2026-10-09) — ragam tetap menang.
      input('HDPE di pralon jenis nya apa aja ?', {
        intent: 'product_range',
        productAspect: 'sizes',
      }),
    );
    const typesText = text(types);
    expect(typesText).toContain('keluarga HDPE ada 3 produk, terbagi dalam jenis berikut:');
    expect(typesText).toContain('- **Pipa HDPE PE 100** — PN-8 sampai PN-16, 2 produk');
    expect(typesText).toContain('- **Pipa HDPE Telkom** — 1 produk');
    expect(typesText).toContain('FITTING HDPE ada 1 produk, di antaranya Tee (Segmented) PE.');

    // "boleh" atas tawaran rincian ukuran: ukuran per jenis, bukan penjelasan bahan HDPE
    // (laporan pemilik 2026-10-09). "yang telkom" lalu memilih satu jenis.
    const subject = {
      kind: 'product',
      entity: 'hdpe',
      topic: 'product_overview',
      depth: 'standard',
    } as const;
    const boleh = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      full,
      noQuestions,
      input(
        'boleh',
        { intent: 'follow_up_continue' },
        {
          subject,
          recentTurns: [{ role: 'assistant', text: typesText }],
        },
      ),
    );
    const bolehText = text(boleh);
    expect(bolehText).toContain('Ukuran per jenis di katalog Pralon:');
    expect(bolehText).toContain('- **Pipa HDPE PE 100** — 63 mm dan 160 mm');
    expect(bolehText).not.toContain('lentur dan ulet');

    const telkom = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      full,
      noQuestions,
      input(
        'yang telkom',
        { intent: 'follow_up_choice' },
        {
          subject,
          recentTurns: [{ role: 'assistant', text: bolehText }],
        },
      ),
    );
    expect(text(telkom)).toContain(
      'Pipa HDPE Telkom di katalog Pralon tersedia dalam 1 ukuran:\n\n40/33',
    );

    // "tampilin semua" setelah ringkasan rentang: semua ukuran tiap jenis, bukan ringkasan yang
    // sama lagi (laporan pemilik 2026-10-09).
    const all = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      full,
      noQuestions,
      input(
        'tampilin semua',
        { intent: 'follow_up_more' },
        { subject, recentTurns: [{ role: 'assistant', text: bolehText }] },
      ),
    );
    const allText = text(all);
    expect(allText).toContain('Semua ukuran per jenis di katalog Pralon:');
    expect(allText).toContain('**Pipa HDPE PE 100** (2 ukuran)\n63 mm, 160 mm');
    expect(allText).not.toContain('Ukuran per jenis di katalog Pralon:');

    // "bikinin dalam bentuk table dong" setelah ikhtisar: tabel RAGAM, bukan PVC vs HDPE
    // (laporan pemilik 2026-10-08 — ikhtisar menyebut HDPE dan PVC).
    const table = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      full,
      noQuestions,
      input(
        'bikinin dalam bentuk table dong',
        { intent: 'follow_up_reformat', format: 'table' },
        { recentTurns: [{ role: 'assistant', text: out }] },
      ),
    );
    const tableText = text(table);
    expect(tableText).toContain('| Keluarga | Jumlah produk |');
    expect(tableText).toContain('| HDPE | 3 |');
    expect(tableText).not.toContain('Aspek');
    expect(cards(table)).toEqual([]);

    // "boleh" atas ikhtisar: tanyakan keluarganya (nama dari katalog), bukan ajakan umum; lalu
    // "pvc" memilih keluarga itu (laporan pemilik 2026-10-09).
    const accept = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      full,
      noQuestions,
      input(
        'boleh',
        { intent: 'follow_up_continue' },
        { recentTurns: [{ role: 'assistant', text: out }] },
      ),
    );
    const choice = text(accept);
    expect(choice).toMatch(/^Siap\. Mau saya jelaskan yang mana: PVC, HDPE, dan fitting\?/);
    expect(choice).not.toContain('Silakan, tanyakan saja');

    const pvc = await runProductQuestion(
      ai({ productQuery: 'pvc', aspect: null }),
      full,
      noQuestions,
      input(
        'pvc',
        { intent: 'product_concept' },
        { recentTurns: [{ role: 'assistant', text: choice }] },
      ),
    );
    expect(text(pvc)).toContain('**PVC AW**');
  });

  it('katalog contoh: jujur katalog belum terpasang + ragam bahan umum, tanpa "CONTOH"', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      {
        ...catalog({}, 'sample'),
        listProducts: async () => ({ items: [SAMPLE_AW], nextCursor: null }),
      },
      noQuestions,
      input('produk pralon apa aja?', { intent: 'product_range' }),
    );
    const out = text(events);
    expect(out).toContain('Katalog produk Pralon belum terpasang');
    expect(out).toContain('- **PVC (uPVC)**');
    expect(out).not.toContain('CONTOH');
    expect(cards(events)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);
  });
});

describe('runProductQuestion — SPESIFIKASI', () => {
  const STANDARD: ProductAnswer = {
    kind: 'value',
    productId: AW.id,
    aspect: 'standard',
    provenance: 'VERIFIED',
    value: 'SNI 06-0084',
    sourceDocument: 'Katalog 2026',
    sourcePage: 14,
  };

  it('jawaban dari product-knowledge, kalimatnya membawa sumber, tidak pernah lewat model', async () => {
    const reply = {
      write: async () => {
        throw new Error('tidak boleh dipanggil');
      },
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: 'standard' }),
      catalog({ 'pvc aw': [AW] }),
      questions(STANDARD),
      input('standar pvc aw apa?', SPEC('standard')),
      reply as never,
      'PROMPT-FAQ',
    );
    expect(text(events)).toBe('Standar Pipa PVC AW: SNI 06-0084. Sumber: Katalog 2026 hal. 14.');
    expect(cards(events).map((c) => c.kind)).toEqual(['product']);
  });

  it('produk yang tidak ada: klaim "tidak ada di katalog Pralon" hanya atas katalog otoritatif', async () => {
    const pralon = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: 'sizes' }),
      catalog({}),
      noQuestions,
      input('ukuran hdpe apa saja?', SPEC('sizes')),
    );
    expect(text(pralon)).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');

    const sample = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: 'sizes' }),
      catalog({}, 'sample'),
      noQuestions,
      input('ukuran hdpe apa saja?', SPEC('sizes')),
    );
    expect(text(sample)).toContain('"hdpe" belum ada di data katalog yang terpasang');
    expect(text(sample)).not.toContain('tidak ada di katalog Pralon');
    expect(cards(sample)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);
  });

  it('katalog tidak terjangkau → jujur, retry disarankan, tidak melempar', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: 'sizes' }),
      brokenCatalog,
      noQuestions,
      input('ukuran pvc aw?', SPEC('sizes')),
    );
    expect(text(events)).toContain('Katalog Pralon sedang tidak terjangkau');
    expect(events.at(-1)?.type).toBe('message.end');
  });

  it('"A dan B" dengan B tidak ada: B dikatakan tidak ada, A tetap dijawab; discontinued = tidak ada', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw dan pvc d', aspect: 'standard' }),
      catalog({ 'pvc aw': [AW], 'pvc d': [{ ...AW, id: 'B'.repeat(26), status: 'discontinued' }] }),
      questions(STANDARD),
      input('standar pvc aw dan pvc d?', SPEC('standard')),
    );
    const out = text(events);
    expect(out).toContain('"pvc d" tidak ada di katalog Pralon yang aktif');
    expect(out).toContain('Standar Pipa PVC AW: SNI 06-0084.');
    expect(cards(events).map((c) => c.kind)).toEqual(['cta', 'product']);
  });

  it('data belum cukup → kalimatnya mengakui, plus tawaran tim teknis', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: 'pressure_class' }),
      catalog({ 'pvc aw': [AW] }),
      questions({
        kind: 'insufficientData',
        productId: AW.id,
        aspect: 'pressure_class',
        provenance: 'UNAVAILABLE',
        sourceDocument: 'Katalog 2026',
        sourcePage: 14,
      }),
      input('tekanan kerja pvc aw?', SPEC('pressure_class')),
    );
    expect(text(events)).toContain('belum tercantum di katalog');
    expect(cards(events).map((c) => c.kind)).toEqual(['cta', 'product']);
  });

  it('parse model gagal → ragam produk, tidak bertanya balik, tidak melempar', async () => {
    const events = await runProductQuestion(failingAi, catalog({}), noQuestions, input('???'));
    expect(text(events)).not.toContain('Produk mana yang Anda maksud?');
    expect(text(events)).toContain('Katalog produk Pralon belum terpasang');
    expect(events.at(-1)?.type).toBe('message.end');
  });
});
