/**
 * P2-03a dan P2-04a — jawaban produk, dan dua hal yang tidak boleh terjadi:
 *
 *   - **kolom kosong tidak pernah ditambal hasil pencarian dokumen**, dan
 *   - **tidak ada jalur yang mengembalikan angka tanpa sumber.**
 *
 * Service-nya tidak memanggil LLM sama sekali, jadi seluruh berkas ini berjalan
 * tanpa model dan tanpa database — yang diuji memang keputusannya.
 */
import { describe, expect, it } from 'vitest';
import { PipeSize, type Product, type ProductDocument } from '@snouty/shared-types';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { PRODUCT_ASPECTS } from '../domain/product-aspect.js';
import { answerHasFact, type ProductAnswer } from '../domain/product-answer.js';
import { SizeQuestionWithoutSizeError } from '../domain/product-knowledge.errors.js';
import type {
  UnansweredQuestion,
  UnansweredQuestionRecorder,
} from '../domain/unanswered-question.port.js';
import { ProductQuestionService } from './product-question.service.js';

const PRODUCT_ID = 'P'.padEnd(26, '0');
const UNAVAILABLE = { provenance: 'UNAVAILABLE', value: null } as const;

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    sku: 'DEV-AW-PIPE',
    name: 'CONTOH Pipa PVC AW',
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    description: '',
    status: 'active',
    sizes: ['3/4"', '1"', '1¼"'],
    material: { provenance: 'VERIFIED', value: 'uPVC' },
    standard: { provenance: 'VERIFIED', value: 'SNI 06-0084-2002' },
    pressureClass: UNAVAILABLE,
    rodLength: UNAVAILABLE,
    jointType: UNAVAILABLE,
    application: UNAVAILABLE,
    sourceDocument: 'Katalog produk Pralon 2026',
    sourcePage: 14,
    catalogVersionId: 'V'.padEnd(26, '0'),
    imageUrl: null,
    ...overrides,
  };
}

const DATASHEET: ProductDocument = {
  title: 'Datasheet Pralon PVC AW',
  url: 'https://example.invalid/aw.pdf',
  page: 7,
};

class FakeCatalog {
  readonly calls: string[] = [];

  constructor(
    private readonly stored: Product,
    private readonly documents: readonly ProductDocument[] = [],
    private readonly fittings: readonly { productId: string; name: string; kind: 'tee' }[] = [],
  ) {}

  async findProduct(): Promise<Product> {
    this.calls.push('findProduct');
    return this.stored;
  }

  async findCompatibleFittings() {
    this.calls.push('findCompatibleFittings');
    return this.fittings;
  }

  async findProductDocuments(): Promise<readonly ProductDocument[]> {
    this.calls.push('findProductDocuments');
    return this.documents;
  }
}

class RecordingMisses implements UnansweredQuestionRecorder {
  readonly recorded: UnansweredQuestion[] = [];

  record(question: UnansweredQuestion): void {
    this.recorded.push(question);
  }
}

function serviceWith(catalog: FakeCatalog, misses = new RecordingMisses()) {
  return {
    service: new ProductQuestionService(catalog as unknown as CatalogQueryService, misses),
    misses,
  };
}

describe('pertanyaan yang dijawab katalog', () => {
  it('menjawab "ukuran apa saja yang tersedia?" dari daftar ukuran', async () => {
    const { service } = serviceWith(new FakeCatalog(product()));

    const answer = await service.answer({ productId: PRODUCT_ID, aspect: PRODUCT_ASPECTS.sizes });

    expect(answer).toEqual({
      kind: 'list',
      productId: PRODUCT_ID,
      aspect: 'sizes',
      provenance: 'VERIFIED',
      items: ['3/4"', '1"', '1¼"'],
      sourceDocument: 'Katalog produk Pralon 2026',
      sourcePage: 14,
    });
  });

  it('menjawab "standarnya apa?" dari kolom', async () => {
    const { service } = serviceWith(new FakeCatalog(product()));

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.standard,
    });

    expect(answer.kind).toBe('value');
    expect(answer).toMatchObject({ value: 'SNI 06-0084-2002', provenance: 'VERIFIED' });
  });

  it('menjawab "ada ukuran 3/4 inch?" dengan ya', async () => {
    const { service } = serviceWith(new FakeCatalog(product()));

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.sizeAvailability,
      size: PipeSize.parse('3/4')!,
    });

    expect(answer).toMatchObject({ kind: 'availability', sizeLabel: '3/4"', available: true });
  });

  it('membedakan "katalog menyatakan tidak tersedia" dari "saya tidak tahu"', async () => {
    // Keduanya tidak boleh terlihat sama: yang pertama jawaban, yang kedua pengakuan.
    const { service } = serviceWith(new FakeCatalog(product()));

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.sizeAvailability,
      size: PipeSize.parse('6')!,
    });

    expect(answer).toMatchObject({ kind: 'availability', available: false });
    expect(answer.provenance).toBe('VERIFIED');
  });

  it('menjawab fitting sepadan dari tabel kompatibilitas, bukan dari kesamaan ukuran', async () => {
    const catalog = new FakeCatalog(
      product(),
      [],
      [{ productId: 'FIT', name: 'CONTOH Tee PVC AW', kind: 'tee' }],
    );
    const { service } = serviceWith(catalog);

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.compatibleFittings,
    });

    expect(answer).toMatchObject({ kind: 'list', items: ['CONTOH Tee PVC AW'] });
    expect(catalog.calls).toContain('findCompatibleFittings');
  });

  it('memakai sitasi spesifikasi bila nilainya berasal dari dokumen teknis', async () => {
    const { service } = serviceWith(
      new FakeCatalog(
        product({
          pressureClass: {
            provenance: 'VERIFIED',
            value: '10 bar',
            sourceDocument: 'Datasheet Pralon PVC AW',
            sourcePage: 7,
          },
        }),
      ),
    );

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(answer).toMatchObject({
      value: '10 bar',
      sourceDocument: 'Datasheet Pralon PVC AW',
      sourcePage: 7,
    });
  });
});

describe('kolom kosong tidak pernah ditambal', () => {
  it('menjawab "Lihat dokumen teknis" dan menawarkan dokumennya — tanpa nilai', async () => {
    const { service } = serviceWith(new FakeCatalog(product(), [DATASHEET]));

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(answer.kind).toBe('unavailable');
    expect(answer).toMatchObject({
      provenance: 'UNAVAILABLE',
      documents: [{ title: 'Datasheet Pralon PVC AW', page: 7 }],
    });
    // Yang menentukan: tidak ada field nilai sama sekali pada jawaban ini.
    expect(answer).not.toHaveProperty('value');
    expect(answerHasFact(answer)).toBe(false);
  });

  it('tidak pernah mengubah judul dokumen menjadi nilai spesifikasi', async () => {
    // Dokumen bernama "Tekanan kerja 10 bar" adalah godaan paling langsung untuk
    // menambal kolom kosong dengan hasil pencarian.
    const { service } = serviceWith(
      new FakeCatalog(product(), [
        { title: 'Tekanan kerja 10 bar', url: 'https://example.invalid/x.pdf', page: 3 },
      ]),
    );

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(answer.kind).toBe('unavailable');
    expect(JSON.stringify(answer)).not.toContain('"value"');
  });

  it('menjawab "data belum cukup" saat tidak ada dokumen apa pun', async () => {
    const { service } = serviceWith(new FakeCatalog(product(), []));

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.rodLength,
    });

    expect(answer.kind).toBe('insufficientData');
    expect(answer.provenance).toBe('UNAVAILABLE');
  });

  it('memperlakukan daftar ukuran yang kosong sebagai data yang belum masuk, bukan sebagai jawaban', async () => {
    const { service } = serviceWith(new FakeCatalog(product({ sizes: [] })));

    const answer = await service.answer({ productId: PRODUCT_ID, aspect: PRODUCT_ASPECTS.sizes });

    expect(answer.kind).toBe('insufficientData');
  });

  it('tidak menjawab ketersediaan ukuran saat produk belum punya daftar ukuran', async () => {
    const { service } = serviceWith(new FakeCatalog(product({ sizes: [] })));

    const answer = await service.answer({
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.sizeAvailability,
      size: PipeSize.parse('3/4')!,
    });

    expect(answer.kind).toBe('insufficientData');
  });
});

describe('setiap jawaban membawa provenance dan sumber', () => {
  const aspects = [
    PRODUCT_ASPECTS.sizes,
    PRODUCT_ASPECTS.compatibleFittings,
    PRODUCT_ASPECTS.material,
    PRODUCT_ASPECTS.standard,
    PRODUCT_ASPECTS.pressureClass,
    PRODUCT_ASPECTS.rodLength,
    PRODUCT_ASPECTS.jointType,
    PRODUCT_ASPECTS.application,
  ];

  it('tidak pernah mengembalikan jawaban tanpa provenance, dokumen, dan halaman', async () => {
    const { service } = serviceWith(
      new FakeCatalog(product(), [DATASHEET], [{ productId: 'FIT', name: 'Tee', kind: 'tee' }]),
    );

    for (const aspect of aspects) {
      const answer: ProductAnswer = await service.answer({ productId: PRODUCT_ID, aspect });

      expect(answer.provenance, aspect).toBeTruthy();
      expect(answer.sourceDocument, aspect).toBeTruthy();
      expect(answer.sourcePage, aspect).toBeGreaterThan(0);
    }
  });

  it('memakai hanya VERIFIED atau UNAVAILABLE — tidak ada fakta produk yang ASSUMED', async () => {
    const { service } = serviceWith(
      new FakeCatalog(product(), [DATASHEET], [{ productId: 'FIT', name: 'Tee', kind: 'tee' }]),
    );

    for (const aspect of aspects) {
      const answer = await service.answer({ productId: PRODUCT_ID, aspect });

      expect(['VERIFIED', 'UNAVAILABLE'], aspect).toContain(answer.provenance);
    }
  });
});

describe('pertanyaan yang tidak bisa dijawab apa adanya', () => {
  it('menolak pertanyaan ketersediaan ukuran tanpa ukurannya', async () => {
    // Menebak ukuran yang dimaksud berarti menjawab pertanyaan yang tidak diajukan.
    const catalog = new FakeCatalog(product());
    const { service } = serviceWith(catalog);

    await expect(
      service.answer({ productId: PRODUCT_ID, aspect: PRODUCT_ASPECTS.sizeAvailability }),
    ).rejects.toThrow(SizeQuestionWithoutSizeError);
    expect(catalog.calls).toEqual([]);
  });
});

describe('pencatatan pertanyaan tak terjawab', () => {
  it('mencatat aspek dan keberadaan dokumen, bukan isi pertanyaan', async () => {
    const { service, misses } = serviceWith(new FakeCatalog(product(), [DATASHEET]));

    await service.answer({ productId: PRODUCT_ID, aspect: PRODUCT_ASPECTS.pressureClass });

    expect(misses.recorded).toEqual([
      {
        productId: PRODUCT_ID,
        aspect: 'pressure_class',
        hasDocuments: true,
        catalogVersionId: 'V'.padEnd(26, '0'),
      },
    ]);
  });

  it('tidak mencatat apa pun saat katalog memang menjawab', async () => {
    // Rasio kriteria adopsi RAG hanya berarti bila penyebutnya jujur.
    const { service, misses } = serviceWith(new FakeCatalog(product()));

    await service.answer({ productId: PRODUCT_ID, aspect: PRODUCT_ASPECTS.material });

    expect(misses.recorded).toEqual([]);
  });

  it('menandai kasus tanpa dokumen supaya "isi kolom" bisa dibedakan dari "butuh retrieval"', async () => {
    const { service, misses } = serviceWith(new FakeCatalog(product(), []));

    await service.answer({ productId: PRODUCT_ID, aspect: PRODUCT_ASPECTS.jointType });

    expect(misses.recorded[0]?.hasDocuments).toBe(false);
  });
});
