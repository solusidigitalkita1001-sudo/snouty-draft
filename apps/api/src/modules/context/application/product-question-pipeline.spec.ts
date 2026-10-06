/**
 * Ruas PRODUCT_LOOKUP: fakta dari katalog, bukan dari model. Yang dipaku:
 *   - produk yang tidak ada di katalog dikatakan tidak ada (+ tawaran tim teknis), bukan
 *     dijawab dari pengetahuan umum;
 *   - tanpa aspek → ikhtisar dari data katalog, satu kartu per produk;
 *   - dengan aspek → `ProductQuestionService` yang menjawab, kalimatnya membawa sumber;
 *   - "A dan B" → dua pencarian, dua produk;
 *   - parse model gagal → bertanya produk mana, tidak melempar.
 */
import type { AssistantStreamEvent, Product } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { AiOutputInvalidError } from '../../ai/domain/ai.errors.js';
import type { ProductAnswer } from '../../product-knowledge/domain/product-answer.js';
import { runProductQuestion } from './product-question-pipeline.js';

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
const D: Product = { ...AW, id: 'B'.repeat(26), sku: 'D', name: 'Pipa PVC D', family: 'PVC D' };

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

function catalog(byTerm: Record<string, Product[]>) {
  return {
    async listProducts({ q }: { q?: string }) {
      return { items: byTerm[q ?? ''] ?? [], nextCursor: null };
    },
  };
}

const questions = (answer: ProductAnswer) => ({
  async answer() {
    return answer;
  },
});

const text = (events: readonly AssistantStreamEvent[]) =>
  events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join('');
const cards = (events: readonly AssistantStreamEvent[]) =>
  events.filter((e) => e.type === 'card').map((e) => (e as { card: { kind: string } }).card);

describe('runProductQuestion', () => {
  it('produk yang tidak ada di katalog dikatakan tidak ada, dengan tawaran tim teknis', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: null }),
      catalog({}),
      questions({} as never),
      { messageId: 'm', message: 'apa itu hdpe?' },
    );
    expect(text(events)).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');
    expect(cards(events)).toEqual([{ kind: 'cta', action: 'CONTACT_TECHNICAL' }]);
    expect(events.at(-1)?.type).toBe('message.end');
  });

  it('tanpa aspek: ikhtisar dari data katalog dan satu kartu per produk', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: null }),
      catalog({ 'pvc aw': [AW] }),
      questions({} as never),
      { messageId: 'm', message: 'apa itu pvc aw?' },
    );
    expect(text(events)).toContain(
      'Pipa PVC AW (PIPA AIR BERSIH · SNI): Pipa untuk air bersih bertekanan.',
    );
    expect(text(events)).toContain('Material uPVC.');
    const [card] = cards(events) as unknown as [
      { kind: string; products: { productId: string }[] },
    ];
    expect(card.kind).toBe('product');
    expect(card.products.map((p) => p.productId)).toEqual([AW.id]);
  });

  it('"A dan B" menjadi dua pencarian dan dua produk, dengan pengantar perbandingan', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw dan pvc d', aspect: null }),
      catalog({ 'pvc aw': [AW], 'pvc d': [D] }),
      questions({} as never),
      { messageId: 'm', message: 'apa bedanya pvc aw dan pvc d?' },
    );
    expect(text(events)).toContain('Berikut yang tercatat di katalog Pralon untuk masing-masing:');
    expect(text(events)).toContain('Pipa PVC AW');
    expect(text(events)).toContain('Pipa PVC D');
    const [card] = cards(events) as unknown as [{ products: unknown[] }];
    expect(card.products).toHaveLength(2);
  });

  it('"A dan B" dengan B tidak ada di katalog: B dikatakan tidak ada, A tetap dijawab', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw dan hdpe', aspect: null }),
      catalog({ 'pvc aw': [AW] }),
      questions({} as never),
      { messageId: 'm', message: 'apa bedanya pvc aw dan hdpe?' },
    );
    expect(text(events)).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');
    expect(text(events)).toContain('Pipa PVC AW (PIPA AIR BERSIH · SNI)');
    expect(text(events)).not.toContain('masing-masing');
  });

  it('dengan aspek: jawaban dari product-knowledge, kalimatnya membawa sumber', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: 'standard' }),
      catalog({ 'pvc aw': [AW] }),
      questions({
        kind: 'value',
        productId: AW.id,
        aspect: 'standard',
        provenance: 'VERIFIED',
        value: 'SNI 06-0084',
        sourceDocument: 'Katalog 2026',
        sourcePage: 14,
      }),
      { messageId: 'm', message: 'standar pvc aw apa?' },
    );
    expect(text(events)).toBe('Standar Pipa PVC AW: SNI 06-0084. Sumber: Katalog 2026 hal. 14.');
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

  it('pertanyaan KONSEP: model menjelaskan umum di atas DATA; fakta katalog tetap ikut bila tak disebut', async () => {
    const reply = {
      calls: [] as unknown[],
      async write(input: { facts?: string; systemPrompt?: string }) {
        this.calls.push(input);
        return {
          text: 'Secara umum PVC kaku dan disambung lem, HDPE lentur dan dilas.',
          source: 'llm' as const,
        };
      },
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw dan hdpe', aspect: null }),
      catalog({ 'pvc aw': [AW] }),
      questions({} as never),
      { messageId: 'm', message: 'apa bedanya pvc dan hdpe?' },
      reply as never,
      'PROMPT-FAQ',
    );
    const out = text(events);
    expect(out).toContain('Secara umum PVC kaku');
    expect(out).toContain('Pipa PVC AW (PIPA AIR BERSIH · SNI)'); // produk tak disebut → ikut
    expect(out).toContain('"hdpe" tidak ada di katalog'); // katalog tak disinggung → ikut
    const call = reply.calls[0] as { systemPrompt?: string; facts?: string };
    expect(call.systemPrompt).toBe('PROMPT-FAQ');
    // DATA = primer bahan milik kode + fakta katalog; sifat bahan bukan dari ingatan model.
    expect(call.facts).toContain('HDPE adalah pipa plastik yang lentur');
    expect(call.facts).toContain('PVC (uPVC) adalah pipa plastik yang kaku');
    expect(call.facts).toContain('"hdpe" tidak ada di katalog');
  });

  it('pertanyaan KONSEP: yang sudah disebut model tidak diulang di bawahnya', async () => {
    const reply = {
      write: async () => ({
        text: 'PVC kaku, HDPE lentur. Di katalog Pralon ada Pipa PVC AW; HDPE tidak ada di katalog.',
        source: 'llm' as const,
      }),
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw dan hdpe', aspect: null }),
      catalog({ 'pvc aw': [AW] }),
      questions({} as never),
      { messageId: 'm', message: 'apa bedanya pvc dan hdpe?' },
      reply as never,
      'PROMPT-FAQ',
    );
    expect(text(events)).toBe(
      'PVC kaku, HDPE lentur. Di katalog Pralon ada Pipa PVC AW; HDPE tidak ada di katalog.',
    );
  });

  it('pertanyaan KONSEP tanpa model: primer bahan + fakta katalog, tetap menjelaskan', async () => {
    const events = await runProductQuestion(
      ai({ productQuery: 'hdpe', aspect: null }),
      catalog({}),
      questions({} as never),
      { messageId: 'm', message: 'apa itu hdpe?' },
    );
    const out = text(events);
    expect(out).toContain('HDPE adalah pipa plastik yang lentur');
    expect(out).toContain('"hdpe" tidak ada di katalog Pralon yang aktif');
    expect(out).not.toMatch(/\d/); // primer tanpa angka; kalimat katalog di sini juga tanpa angka
  });

  it('pertanyaan SPESIFIKASI tidak pernah lewat model — fakta katalog apa adanya', async () => {
    const reply = {
      write: async () => {
        throw new Error('tidak boleh dipanggil');
      },
    };
    const events = await runProductQuestion(
      ai({ productQuery: 'pvc aw', aspect: 'standard' }),
      catalog({ 'pvc aw': [AW] }),
      questions({
        kind: 'value',
        productId: AW.id,
        aspect: 'standard',
        provenance: 'VERIFIED',
        value: 'SNI 06-0084',
        sourceDocument: 'Katalog 2026',
        sourcePage: 14,
      }),
      { messageId: 'm', message: 'standar pvc aw apa?' },
      reply as never,
      'PROMPT-FAQ',
    );
    expect(text(events)).toBe('Standar Pipa PVC AW: SNI 06-0084. Sumber: Katalog 2026 hal. 14.');
  });

  it('parse model gagal → bertanya produk mana, tidak melempar', async () => {
    const events = await runProductQuestion(failingAi, catalog({}), questions({} as never), {
      messageId: 'm',
      message: '???',
    });
    expect(text(events)).toContain('Produk mana yang Anda maksud?');
    expect(events.at(-1)?.type).toBe('message.end');
  });
});
