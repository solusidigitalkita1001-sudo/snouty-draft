/**
 * Regresi dari tinjauan kode dan audit live 2026-10-08 (setelah P16-11). Satu berkas supaya
 * temuan dan perbaikannya bisa dibaca bersama; setiap tes menyebut kalimat yang gagal di produksi.
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
import type { AiService } from '../../ai/domain/ai.port.js';
import type { Extraction, IntentClassification } from '../../ai/domain/extraction-schema.js';
import { TEST_LEXICON, understood } from '../../understanding/testing/understood.js';
import { CatalogUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { withCompleteness } from '../domain/completeness.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { IntentRouter, type RoutingDecision } from './intent-router.js';
import { runUnderstanding, type PipelineInput } from './message-pipeline.js';
import {
  productQueryOf,
  runProductQuestion,
  type ProductQuestionInput,
} from './product-question-pipeline.js';

const T0 = '2026-01-01T00:00:00.000Z';

function aiFor(intent: IntentClassification = { intent: 'OUT_OF_SCOPE', confidence: 1 }) {
  const calls = { classify: 0, parse: 0, extract: 0 };
  const ai = {
    classifyIntent: () => {
      calls.classify += 1;
      return Promise.resolve(intent);
    },
    parseProductQuestion: () => {
      calls.parse += 1;
      return Promise.resolve({ productQuery: null, aspect: null, size: null });
    },
    extract: (): Promise<Extraction> => {
      calls.extract += 1;
      return Promise.resolve({});
    },
    titleFor: () => Promise.resolve(''),
    writeProse: () => Promise.resolve(null),
  } as unknown as AiService;
  return { ai, calls };
}

const text = (events: readonly AssistantStreamEvent[]) =>
  events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join('\n');

const brokenCatalog = {
  activeVersion: () => Promise.reject(new CatalogUnavailableError()),
  listProducts: () => Promise.reject(new CatalogUnavailableError()),
};

const extractDecision: RoutingDecision = {
  intent: 'REQUIREMENT_STATEMENT',
  confidence: 0.9,
  shouldExtract: true,
  mutatesState: false,
};

function pipelineInput(over: Partial<PipelineInput> & { message: string }): PipelineInput {
  return {
    messageId: '01JBMESSAGE00000000000000AB',
    decision: extractDecision,
    state: emptyRequirementState(T0),
    now: T0,
    ...over,
  };
}

function productInput(
  message: string,
  labels: Parameters<typeof understood>[1],
  over: Partial<ProductQuestionInput> = {},
): ProductQuestionInput {
  return {
    messageId: 'm',
    message,
    understanding: understood(message, labels),
    lexicon: TEST_LEXICON,
    ...over,
  };
}

describe('router — Policy 1, subjek perusahaan, pertanyaan produk ber-"rumah"', () => {
  it('merek pesaing di dalam kalimat kebutuhan → COMPETITOR_QUESTION, tanpa model', async () => {
    const { ai, calls } = aiFor();
    const d = await new IntentRouter(ai).route(
      understood('rumah 2 lantai, lebih bagus Pralon atau Rucika?', {
        intent: 'requirement_building',
      }),
      false,
    );
    expect(d.intent).toBe('COMPETITOR_QUESTION');
    expect(calls.classify).toBe(0);
  });

  it('subjek perusahaan aktif: "pabriknya di mana?" tetap perusahaan walau "pabrik" kata kebutuhan', async () => {
    const { ai, calls } = aiFor();
    const d = await new IntentRouter(ai).route(
      understood('pabriknya di mana?', {
        intent: 'company_question',
        companyTopic: 'manufacturing',
      }),
      false,
      [],
      { kind: 'company', entity: 'PT Pralon', topic: 'company_profile', depth: 'standard' },
    );
    expect(d.intent).toBe('COMPANY_QUESTION');
    expect(calls.classify).toBe(0);
  });

  it('perbandingan produk "buat rumah saya" tanpa data inti tetap PRODUCT_LOOKUP; dengan "2 lantai" jadi kebutuhan', async () => {
    const lookup = await new IntentRouter(aiFor().ai).route(
      understood('what is the difference between pvc aw dan pvc d buat rumah saya?', {
        intent: 'product_comparison',
      }),
      false,
    );
    expect(lookup.intent).toBe('PRODUCT_LOOKUP');
    const need = await new IntentRouter(aiFor().ai).route(
      understood('apa bedanya pvc dan hdpe buat rumah 2 lantai?', {
        intent: 'product_comparison',
      }),
      false,
    );
    expect(need.intent).toBe('REQUIREMENT_STATEMENT');
  });
});

describe('ruas produk — pemeta model, subjek, istilah katalog', () => {
  it('"pvc aw sama pvc d bedanya apa?" saat subjeknya HDPE: kelas AW vs D, HDPE tidak ikut', async () => {
    const events = await runProductQuestion(
      aiFor().ai,
      brokenCatalog,
      { answer: () => Promise.reject(new Error('bukan spesifikasi')) } as never,
      productInput(
        'pvc aw sama pvc d bedanya apa?',
        { intent: 'product_comparison' },
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
    expect(text(events)).toContain('adalah kelas pipa PVC');
    expect(text(events)).not.toContain('**HDPE**');
  });

  it('ragam produk tanpa keluarga tidak memanggil model pemeta (sempat 23–38 s)', async () => {
    const { ai, calls } = aiFor();
    await runProductQuestion(
      ai,
      {
        activeVersion: () => Promise.resolve({ kind: 'sample' } as never),
        listProducts: () => Promise.resolve({ items: [], nextCursor: null }),
      },
      {} as never,
      productInput('produk pralon apa aja?', { intent: 'product_range' }),
    );
    expect(calls.parse).toBe(0);
  });

  it('"standarnya apa?" atas subjek HDPE: produknya dari subjek, tanpa model, bukan "Produk mana"', async () => {
    const { ai, calls } = aiFor();
    const hdpe = {
      id: 'H'.repeat(26),
      sku: 'HDPE',
      name: 'Pipa HDPE PE100 63 mm',
      family: 'HDPE',
      category: 'PIPA HDPE',
      status: 'active',
      sizes: ['63 mm'],
      material: { provenance: 'VERIFIED', value: 'PE100' },
      standard: { provenance: 'VERIFIED', value: 'SNI 4829' },
      pressureClass: { provenance: 'UNAVAILABLE', value: null },
      rodLength: { provenance: 'UNAVAILABLE', value: null },
      jointType: { provenance: 'UNAVAILABLE', value: null },
      application: { provenance: 'VERIFIED', value: 'Air bersih' },
      sourceDocument: 'Katalog',
      sourcePage: 3,
      catalogVersionId: 'V'.repeat(26),
      imageUrl: null,
      description: '',
    } as unknown as Product;
    const events = await runProductQuestion(
      ai,
      {
        activeVersion: () => Promise.resolve({ kind: 'pralon' } as never),
        listProducts: () => Promise.resolve({ items: [hdpe], nextCursor: null }),
      },
      {
        answer: () =>
          Promise.resolve({
            kind: 'value',
            productId: hdpe.id,
            aspect: 'standard',
            provenance: 'VERIFIED',
            value: 'SNI 4829',
            sourceDocument: 'Katalog',
            sourcePage: 3,
          }),
      } as never,
      productInput(
        'standarnya apa?',
        { intent: 'product_spec', productAspect: 'standard' },
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
    expect(calls.parse).toBe(0);
    expect(text(events)).toContain('SNI 4829');
    expect(text(events)).not.toContain('Produk mana');
  });

  it('productQueryOf: tee + pvc satu istilah; galvanis tidak dicari ke katalog', () => {
    expect(productQueryOf(understood('tee pvc 3/4 ada?'), TEST_LEXICON)).toBe('tee pvc');
    expect(productQueryOf(understood('pipa galvanis masih dijual?'), TEST_LEXICON)).toBeNull();
    expect(productQueryOf(understood('apa bedanya pvc dan hdpe?'), TEST_LEXICON)).toBe(
      'pvc dan hdpe',
    );
  });
});

describe('ruas kebutuhan — bangunan vs kasus sumur, harga, toren, di luar topik, nasihat', () => {
  it('kebutuhan bangunan Inggris dengan sumur+pompa tetap jalur bangunan, bukan kasus distribusi sumur', async () => {
    const message = 'boarding house, 3 floors, 12 bathrooms, water from a well with a pump';
    const { nextState } = await runUnderstanding(
      aiFor().ai,
      pipelineInput({
        message,
        locale: 'en',
        understanding: understood(message, { intent: 'requirement_building' }),
      }),
    );
    expect(nextState.useCase).toBeUndefined();
    expect(nextState.building.floors.value).toBe(3);
    expect(nextState.fixtures.bathrooms.value).toBe(12);
    expect(nextState.water.source.value).toBe('pump');
  });

  it('P16-14: "gedung kantor 6 lantai" (kebutuhan bangunan) tetap masuk kasus gedung bertingkat', async () => {
    const message = 'gedung kantor 6 lantai, 20 toilet';
    const { nextState } = await runUnderstanding(
      aiFor().ai,
      pipelineInput({
        message,
        understanding: understood(message, {
          intent: 'requirement_building',
          useCase: 'multistorey_building_water',
        }),
      }),
    );
    expect(nextState.useCase).toMatchObject({
      kind: 'technical',
      caseId: 'multistorey_building_water',
    });
  });

  it('"harga pipa buat rumah 2 lantai berapa?" mencatat kebutuhan DAN menjawab soal harga', async () => {
    const message = 'harga pipa buat rumah 2 lantai berapa?';
    const { events } = await runUnderstanding(
      aiFor().ai,
      pipelineInput({ message, understanding: understood(message, { intent: 'price_question' }) }),
    );
    expect(text(events)).toContain('Harga tidak saya tampilkan');
  });

  it('"torennya pindah ke bawah" mengubah sumber air ke toren bawah (klitik -nya)', async () => {
    const state = withCompleteness(
      mergeRequirement(
        emptyRequirementState(T0),
        [{ path: 'water.source', value: 'rooftop_tank', source: 'user_stated' }],
        T0,
      ).state,
    );
    const message = 'torennya pindah ke bawah';
    const { nextState } = await runUnderstanding(
      aiFor().ai,
      pipelineInput({
        message,
        decision: { ...extractDecision, intent: 'REQUIREMENT_MUTATION', mutatesState: true },
        state,
        understanding: understood(message, { intent: 'requirement_mutation' }),
      }),
    );
    expect(nextState.water.source.value).toBe('ground_tank');
  });

  it('pesan di luar topik dijawab batasnya, bukan sapaan pembuka', async () => {
    const message = 'cuaca hari ini gimana?';
    const { events } = await runUnderstanding(
      aiFor().ai,
      pipelineInput({
        message,
        decision: {
          intent: 'OUT_OF_SCOPE',
          confidence: 0.9,
          shouldExtract: false,
          mutatesState: false,
        },
        understanding: understood(message, { intent: 'out_of_scope' }),
      }),
    );
    expect(text(events)).toMatch(/^Itu di luar yang bisa saya bantu/);
  });

  it('"mending pvc apa hdpe?" tanpa kebutuhan: nasihat bahan langsung, model ekstraksi tidak dipanggil', async () => {
    const message = 'mending pvc apa hdpe?';
    const { ai, calls } = aiFor();
    const { events } = await runUnderstanding(
      ai,
      pipelineInput({ message, understanding: understood(message, { intent: 'advice_request' }) }),
    );
    expect(calls.extract).toBe(0);
    expect(text(events)).toContain('pilihan bahan');
    expect(text(events)).not.toContain('Silakan, tanyakan saja');
  });
});

describe('router & katalog — sisa verifikasi live', () => {
  it('pesan tanpa huruf/angka → OUT_OF_SCOPE tanpa model', async () => {
    const { ai, calls } = aiFor();
    const d = await new IntentRouter(ai).route(understood('   ?'), false);
    expect(d.intent).toBe('OUT_OF_SCOPE');
    expect(calls.classify).toBe(0);
  });

  it('"elbow hdpe" tanpa nama utuh di katalog: dicari lewat "elbow" lalu disaring HDPE', async () => {
    const elbow = (name: string, family: string) =>
      ({
        id: name.padEnd(26, 'X').slice(0, 26),
        name,
        family,
        category: 'FITTING',
        status: 'active',
        sizes: [],
        material: { provenance: 'UNAVAILABLE', value: null },
        standard: { provenance: 'UNAVAILABLE', value: null },
        pressureClass: { provenance: 'UNAVAILABLE', value: null },
        rodLength: { provenance: 'UNAVAILABLE', value: null },
        jointType: { provenance: 'UNAVAILABLE', value: null },
        application: { provenance: 'UNAVAILABLE', value: null },
        sourceDocument: 'Katalog',
        sourcePage: 1,
        imageUrl: null,
      }) as unknown as Product;
    const events = await runProductQuestion(
      aiFor().ai,
      {
        activeVersion: () => Promise.resolve({ kind: 'pralon' } as never),
        listProducts: ({ q }: { q?: string }) =>
          Promise.resolve({
            items:
              q === 'elbow'
                ? [
                    elbow('Elbow PVC 3/4', 'FITTING PVC'),
                    elbow('Elbow 90 HDPE 63 mm', 'FITTING HDPE'),
                  ]
                : [],
            nextCursor: null,
          }),
      } as never,
      {
        answer: (q: { productId: string }) =>
          Promise.resolve({
            kind: 'insufficientData',
            productId: q.productId,
            aspect: 'sizes',
            provenance: 'UNAVAILABLE',
            sourceDocument: null,
            sourcePage: null,
          }),
      } as never,
      productInput('elbow hdpe ada?', { intent: 'product_spec', productAspect: 'sizes' }),
    );
    expect(text(events)).toContain('Elbow 90 HDPE 63 mm');
    expect(text(events)).not.toContain('tidak ada di katalog');
  });
});

describe('katalog — sinonim nama fitting', () => {
  it('"elbow hdpe" menemukan "Bend (Segmented) 90º PE 63 mm" lewat alias kosakata', async () => {
    const bend = {
      id: 'B'.repeat(26),
      name: 'Bend (Segmented) - 90º PE 63 mm',
      family: 'FITTING HDPE',
      category: 'FITTING',
      status: 'active',
      sizes: [],
      material: { provenance: 'UNAVAILABLE', value: null },
      standard: { provenance: 'UNAVAILABLE', value: null },
      pressureClass: { provenance: 'UNAVAILABLE', value: null },
      rodLength: { provenance: 'UNAVAILABLE', value: null },
      jointType: { provenance: 'UNAVAILABLE', value: null },
      application: { provenance: 'UNAVAILABLE', value: null },
      sourceDocument: 'Katalog',
      sourcePage: 1,
      imageUrl: null,
    } as unknown as Product;
    const events = await runProductQuestion(
      aiFor().ai,
      {
        activeVersion: () => Promise.resolve({ kind: 'pralon' } as never),
        listProducts: ({ q }: { q?: string }) =>
          Promise.resolve({ items: q === 'bend' ? [bend] : [], nextCursor: null }),
      } as never,
      {
        answer: (q: { productId: string }) =>
          Promise.resolve({
            kind: 'insufficientData',
            productId: q.productId,
            aspect: 'sizes',
            provenance: 'UNAVAILABLE',
            sourceDocument: null,
            sourcePage: null,
          }),
      } as never,
      productInput('elbow hdpe ada?', { intent: 'product_spec', productAspect: 'sizes' }),
    );
    expect(text(events)).toContain('Bend (Segmented)');
  });
});

describe('kosakata — klitik "-nya" dan keluarga non-katalog', () => {
  it('"pvcnya", "pralonnya", "rucikanya" dikenali; galvanis bukan keluarga katalog; tee adalah fitting', () => {
    expect(TEST_LEXICON.productFamilies('pvcnya gimana?')).toEqual(['pvc']);
    expect(TEST_LEXICON.mentionsOwnBrand('pralonnya bagus?')).toBe(true);
    expect(TEST_LEXICON.mentionsCompetitor('rucikanya gimana?')).toBe(true);
    expect(TEST_LEXICON.isCatalogFamily('galvanis')).toBe(false);
    expect(TEST_LEXICON.isFittingFamily('tee')).toBe(true);
    expect(TEST_LEXICON.mentionsRequirementEntity('as well, which one?')).toBe(false);
  });
});

describe('katalog — produk wakil mengikuti ukuran yang ditanya', () => {
  it('"tee pvc 3/4 ada?": di antara beberapa tee PVC, yang berukuran 3/4 yang menjawab', async () => {
    const tee = (id: string, name: string, sizes: string[]) =>
      ({
        id: id.repeat(26),
        name,
        family: 'FITTING PVC',
        category: 'FITTING',
        status: 'active',
        sizes,
        material: { provenance: 'UNAVAILABLE', value: null },
        standard: { provenance: 'UNAVAILABLE', value: null },
        pressureClass: { provenance: 'UNAVAILABLE', value: null },
        rodLength: { provenance: 'UNAVAILABLE', value: null },
        jointType: { provenance: 'UNAVAILABLE', value: null },
        application: { provenance: 'UNAVAILABLE', value: null },
        sourceDocument: 'Katalog',
        sourcePage: 1,
        imageUrl: null,
      }) as unknown as Product;
    const asked: string[] = [];
    const events = await runProductQuestion(
      aiFor().ai,
      {
        activeVersion: () => Promise.resolve({ kind: 'pralon' } as never),
        listProducts: ({ q }: { q?: string }) =>
          Promise.resolve({
            items:
              q === 'tee'
                ? [
                    tee('A', 'Bell Tee TS Branch - W 6" x 2"', ['6"']),
                    tee('B', 'Tee PVC 3/4"', ['3/4"']),
                  ]
                : [],
            nextCursor: null,
          }),
      } as never,
      {
        answer: (q: { productId: string }) => {
          asked.push(q.productId);
          return Promise.resolve({
            kind: 'sizeAvailable',
            productId: q.productId,
            aspect: 'size_availability',
            provenance: 'VERIFIED',
            sourceDocument: 'Katalog',
            sourcePage: 1,
          });
        },
      } as never,
      productInput('tee pvc 3/4 ada?', {
        intent: 'product_spec',
        productAspect: 'size_availability',
      }),
    );
    expect(asked).toEqual(['B'.repeat(26)]);
    expect(events.length).toBeGreaterThan(0);
  });
});
