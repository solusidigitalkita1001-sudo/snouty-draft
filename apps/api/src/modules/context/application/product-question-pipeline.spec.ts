/**
 * Ruas pertanyaan produk. Yang dipaku:
 *   - KONSEP dijawab utuh dari pengetahuan umum — tanpa katalog, tanpa model;
 *   - katalog hanya PENDUKUNG jawaban konsep, dan hanya bila otoritatif (`pralon`);
 *   - katalog contoh tidak pernah bocor: tidak ada "CONTOH …", tidak ada klaim tentang Pralon;
 *   - katalog yang gagal dibaca tidak mengubah penjelasan teknik;
 *   - SPESIFIKASI dari katalog aktif lewat `ProductQuestionService`, kalimatnya membawa sumber;
 *   - "A dan B" → dua pencarian; produk `discontinued` tidak dihitung ada;
 *   - parse model gagal → bertanya produk mana, tidak melempar.
 */
import type { AssistantStreamEvent, CatalogVersionKind, Product } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import { CatalogUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import type { ProductAnswer } from '../../product-knowledge/domain/product-answer.js';
import { bestMatch, runProductQuestion } from './product-question-pipeline.js';

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
  };
}
const brokenCatalog = {
  async activeVersion(): Promise<never> {
    throw new CatalogUnavailableError();
  },
  async listProducts(): Promise<never> {
    throw new Error('tidak boleh sampai sini');
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

describe('runProductQuestion — KONSEP', () => {
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
      catalog({ HDPE: [telkom, hdpe] }),
      {
        async answer() {
          asked += 1;
          throw new Error('aspek tidak boleh ditanyakan untuk pertanyaan konsep');
        },
      } as never,
      { messageId: 'm', message: 'apa bedanya fitting sama hdpe ?' },
    );
    const out = text(events);
    expect(asked).toBe(0);
    expect(out).toContain(
      '**HDPE** adalah bahan pipa, sedangkan **fitting** adalah komponen penyambungnya',
    );
    expect(out).toContain('Fitting adalah komponen penyambung pipa');
    expect(out).not.toContain('belum cukup di katalog');
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

  it('"apa bedanya pvc sama hdpe" dijawab utuh tanpa katalog dan tanpa model', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      brokenCatalog,
      noQuestions,
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
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
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
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
      { messageId: 'm', message: 'kalau pvc vs hdpe soal harganya?', recentTurns: turns },
    );
    expect(text(other)).toContain('Seperti tadi: **PVC (uPVC) kaku');
    expect(text(other)).not.toContain('- Sambungan:');

    const again = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      brokenCatalog,
      noQuestions,
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?', recentTurns: turns },
    );
    expect(text(again)).toContain('- Sambungan:');
  });

  it('katalog CONTOH tidak pernah bocor: tanpa "CONTOH …", tanpa "tidak ada di katalog Pralon"', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc dan hdpe', aspect: null }),
      catalog({ pvc: [SAMPLE_AW] }, 'sample'),
      noQuestions,
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
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
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
    );
    const out = text(events);
    expect(out).toContain('Singkatnya, **PVC (uPVC) kaku');
    expect(out).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');
    expect(out).toContain('Di katalog Pralon yang aktif:');
    expect(out).toContain('Pipa PVC AW (PIPA AIR BERSIH · SNI)');
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
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
      reply as never,
      'PROMPT-FAQ',
    );
    const out = text(events);
    expect(out).toContain('**PVC**\n- Kaku, dilem.');
    expect(out).toContain('Pipa PVC AW (PIPA AIR BERSIH · SNI)'); // produk tak disebut → ikut
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
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
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
      { messageId: 'm', message: 'apa bedanya pvc sama hdpe?' },
      reply as never,
      'PROMPT-FAQ',
    );
    expect(text(events)).toBe(
      '**PVC**\n- Kaku.\n- Dilem.\n- Batangan.\n- Bangunan.\n\n**HDPE**\n- Lentur.\n- Dilas.\n- Gulungan.\n- Tanam.\n\nDi katalog Pralon ada Pipa PVC AW; HDPE tidak ada di katalog.',
    );
  });

  it('tanpa aspek dan tanpa bahan yang dikenali: ikhtisar produk Pralon bila ada, bertanya bila tidak', async () => {
    const found = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: null }),
      catalog({ 'pvc aw': [AW] }),
      noQuestions,
      { messageId: 'm', message: 'apa itu pvc aw?' },
    );
    expect(text(found)).toContain('Pipa PVC AW (PIPA AIR BERSIH · SNI): Pipa untuk air bersih');

    const unknown = await runProductQuestion(
      ai({ productQuery: 'xyz', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      { messageId: 'm', message: 'apa itu xyz?' },
    );
    expect(text(unknown)).toContain('Produk mana yang Anda maksud?');
    expect(cards(unknown)).toEqual([]);
  });
});

describe('runProductQuestion — nada percakapan', () => {
  it('"HDPE di Pralon ok nggak?" → prosa dua arah + MENGAPA Pralon-nya belum bisa dijawab; penutup tidak diulang', async () => {
    const first = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      { messageId: 'm', message: 'kalo pipa HDPE di Pralon gmn? ok ngga?' },
    );
    const out = text(first);
    expect(out).toMatch(/^\*\*HDPE\*\* itu lentur dan bisa digulung: /);
    expect(out).toContain('**cocok untuk jalur panjang');
    expect(out).toContain('kurang cocok untuk');
    expect(out).toContain('katalog Pralon belum terpasang di sistem ini');
    expect(out).not.toContain('- Bentuk:');
    expect(cards(first)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);

    const second = await runProductQuestion(
      ai({ productQuery: 'ppr', aspect: null }),
      catalog({}, 'sample'),
      noQuestions,
      {
        messageId: 'm',
        message: 'kalau PPR di Pralon?',
        recentTurns: [
          { role: 'user', text: 'kalo pipa HDPE di Pralon gmn? ok ngga?' },
          { role: 'assistant', text: out },
        ],
      },
    );
    expect(text(second)).not.toContain('katalog Pralon belum terpasang'); // sudah dibilang tadi
  });
});

describe('runProductQuestion — RAGAM produk ("produk Pralon yang terkenal apa?")', () => {
  it('katalog Pralon: keluarga produk beserta anggotanya, satu kartu per keluarga', async () => {
    const D = { ...AW, id: 'B'.repeat(26), sku: 'D', name: 'Pipa PVC D', family: 'PVC D' };
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      { ...catalog({}), listProducts: async () => ({ items: [AW, D], nextCursor: null }) },
      noQuestions,
      { messageId: 'm', message: 'gw mau nanya produk pralon itu yang terkenal apa sih?' },
    );
    const out = text(events);
    expect(out).toContain('**Keluarga produk di katalog Pralon yang aktif**');
    expect(out).toContain('- **PVC AW**: Pipa PVC AW');
    expect(out).toContain('- **PVC D**: Pipa PVC D');
    expect(cards(events).map((c) => c.kind)).toEqual(['product']);
  });

  it('katalog contoh: jujur katalog belum terpasang + ragam bahan umum, tanpa "CONTOH"', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: null, aspect: null }),
      {
        ...catalog({}, 'sample'),
        listProducts: async () => ({ items: [SAMPLE_AW], nextCursor: null }),
      },
      noQuestions,
      { messageId: 'm', message: 'produk pralon apa aja?' },
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
      { messageId: 'm', message: 'standar pvc aw apa?' },
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
      { messageId: 'm', message: 'ukuran hdpe apa saja?' },
    );
    expect(text(pralon)).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');

    const sample = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: 'sizes' }),
      catalog({}, 'sample'),
      noQuestions,
      { messageId: 'm', message: 'ukuran hdpe apa saja?' },
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
      { messageId: 'm', message: 'ukuran pvc aw?' },
    );
    expect(text(events)).toContain('Katalog Pralon sedang tidak terjangkau');
    expect(events.at(-1)?.type).toBe('message.end');
  });

  it('"A dan B" dengan B tidak ada: B dikatakan tidak ada, A tetap dijawab; discontinued = tidak ada', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw dan pvc d', aspect: 'standard' }),
      catalog({ 'pvc aw': [AW], 'pvc d': [{ ...AW, id: 'B'.repeat(26), status: 'discontinued' }] }),
      questions(STANDARD),
      { messageId: 'm', message: 'standar pvc aw dan pvc d?' },
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
      { messageId: 'm', message: 'tekanan kerja pvc aw?' },
    );
    expect(text(events)).toContain('belum cukup di katalog');
    expect(cards(events).map((c) => c.kind)).toEqual(['cta', 'product']);
  });

  it('parse model gagal → bertanya produk mana, tidak melempar', async () => {
    const events = await runProductQuestion(failingAi, catalog({}), noQuestions, {
      messageId: 'm',
      message: '???',
    });
    expect(text(events)).toContain('Produk mana yang Anda maksud?');
    expect(events.at(-1)?.type).toBe('message.end');
  });
});
