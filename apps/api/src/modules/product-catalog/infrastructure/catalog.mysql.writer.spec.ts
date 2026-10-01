/**
 * P1-06a — impor yang sama dua kali menghasilkan satu versi.
 *
 * Diuji terhadap MySQL sungguhan lewat use case-nya, bukan lewat writer saja,
 * karena yang dijanjikan item ini adalah perilaku ujung-ke-ujung: pesan yang
 * dikirim dua kali — hal yang pasti terjadi pada antrean dengan retry — tidak
 * boleh meninggalkan dua versi katalog atau produk ganda.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, count, eq } from 'drizzle-orm';
import {
  catalogImportRuns,
  catalogVersions,
  productCompatibility,
  productDocuments,
  productImages,
  products,
  productSizes,
  productSpecs,
} from '../../../infrastructure/mysql/schema/catalog.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { CatalogIngestService } from '../application/catalog-ingest.service.js';
import {
  CATALOG_IMPORT_COLUMNS,
  type CatalogImportSource,
} from '../domain/catalog-import.contract.js';
import { MysqlCatalogWriter } from './catalog.mysql.writer.js';

const RUN_ID = testId('RUN1');
const ADMIN = testId('ADMIN');
const SOURCE_DOCUMENT = 'Katalog produk Pralon 2026';

let fixture: TestDatabase;
let service: CatalogIngestService;
let writer: MysqlCatalogWriter;

beforeAll(async () => {
  fixture = await createTestDatabase('ingest');
  writer = new MysqlCatalogWriter({ db: fixture.db });
  service = new CatalogIngestService(writer);
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  await fixture.db.insert(catalogImportRuns).values({
    id: RUN_ID,
    label: 'v2.4',
    sourceDocument: SOURCE_DOCUMENT,
    status: 'pending',
    requestedBy: ADMIN,
  });
});

function validRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    sku: 'AW-A',
    name: 'Pralon PVC AW 3/4"',
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    source_page: '14',
    ...overrides,
  };
}

function source(rows: readonly Record<string, string>[]): CatalogImportSource {
  return {
    label: 'v2.4',
    sourceDocument: SOURCE_DOCUMENT,
    columns: [...CATALOG_IMPORT_COLUMNS.required, ...CATALOG_IMPORT_COLUMNS.optional],
    rows: rows.map((values, index) => ({ rowNumber: index + 2, values })),
  };
}

async function tally(): Promise<Record<string, number>> {
  const [versions, productRows, sizes, specs, compatibility] = await Promise.all([
    fixture.db.select({ n: count() }).from(catalogVersions),
    fixture.db.select({ n: count() }).from(products),
    fixture.db.select({ n: count() }).from(productSizes),
    fixture.db.select({ n: count() }).from(productSpecs),
    fixture.db.select({ n: count() }).from(productCompatibility),
  ]);
  return {
    versions: versions[0]?.n ?? 0,
    products: productRows[0]?.n ?? 0,
    sizes: sizes[0]?.n ?? 0,
    specs: specs[0]?.n ?? 0,
    compatibility: compatibility[0]?.n ?? 0,
  };
}

/** Satu produk tanpa rujukan fitting — rujukan ke SKU di luar impor memang ditolak validator. */
const SINGLE_PRODUCT = validRow({ sku: 'AW-A', sizes: '3/4; 1', material: 'uPVC' });

async function attachmentCounts(): Promise<Record<string, number>> {
  const [documents, images] = await Promise.all([
    fixture.db.select({ n: count() }).from(productDocuments),
    fixture.db.select({ n: count() }).from(productImages),
  ]);
  return { documents: documents[0]?.n ?? 0, images: images[0]?.n ?? 0 };
}

const TWO_PRODUCTS = [
  validRow({ sku: 'AW-A', sizes: '3/4; 1', material: 'uPVC', compatible_skus: 'FIT-T:tee' }),
  validRow({ sku: 'FIT-T', name: 'Tee PVC AW 3/4"', sizes: '3/4' }),
];

describe('catalog.ingest — impor yang sama dua kali', () => {
  it('menghasilkan tepat satu versi katalog dan satu set produk', async () => {
    const first = await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });
    const second = await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });

    expect(second.catalogVersionId).toBe(first.catalogVersionId);
    const counted = await tally();
    expect(counted.versions).toBe(1);
    expect(counted.products).toBe(2);
  });

  it('tidak menduplikasi ukuran, spesifikasi, maupun kompatibilitas', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });
    const afterFirst = await tally();

    await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });
    const afterSecond = await tally();

    expect(afterSecond).toEqual(afterFirst);
  });

  it('memakai ulang versi yang sama saat percobaan pertama mati sebelum run ditandai selesai', async () => {
    // Diperankan dengan memanggil writer langsung, tepat seperti proses yang
    // terbunuh setelah versi terbentuk dan baris tertulis, tetapi sebelum
    // run berpindah dari `pending`.
    const run = await writer.findImportRun(RUN_ID);
    const orphan = await writer.createDraftVersion(run!);

    const result = await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });

    expect(result.catalogVersionId).toBe(orphan);
    expect((await tally()).versions).toBe(1);
  });
});

describe('catalog.ingest — apa yang benar-benar tersimpan', () => {
  it('menautkan versi draft ke run yang melahirkannya', async () => {
    const result = await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });

    const rows = await fixture.db
      .select({ status: catalogImportRuns.status, versionId: catalogImportRuns.catalogVersionId })
      .from(catalogImportRuns)
      .where(eq(catalogImportRuns.id, RUN_ID));

    expect(rows[0]?.status).toBe('ingested');
    expect(rows[0]?.versionId).toBe(result.catalogVersionId);
  });

  it('menyimpan versi sebagai draft, bukan langsung aktif', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });

    const rows = await fixture.db.select({ status: catalogVersions.status }).from(catalogVersions);

    expect(rows[0]?.status).toBe('draft');
  });

  it('menyimpan spesifikasi kosong sebagai baris UNAVAILABLE, bukan baris yang hilang', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source([SINGLE_PRODUCT]) });

    const specs = await fixture.db
      .select({
        key: productSpecs.specKey,
        value: productSpecs.specValue,
        provenance: productSpecs.provenance,
      })
      .from(productSpecs);

    expect(specs).toHaveLength(6);
    expect(specs.find((s) => s.key === 'material')).toEqual({
      key: 'material',
      value: 'uPVC',
      provenance: 'VERIFIED',
    });
    expect(specs.find((s) => s.key === 'pressure_class')).toEqual({
      key: 'pressure_class',
      value: null,
      provenance: 'UNAVAILABLE',
    });
  });

  it('menulis kompatibilitas dengan id produk yang benar, bukan dengan SKU', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source(TWO_PRODUCTS) });

    const [pipe] = await fixture.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, 'AW-A'));
    const [fitting] = await fixture.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, 'FIT-T'));
    const links = await fixture.db
      .select({
        productId: productCompatibility.productId,
        compatibleProductId: productCompatibility.compatibleProductId,
        kind: productCompatibility.kind,
      })
      .from(productCompatibility);

    expect(links).toEqual([{ productId: pipe?.id, compatibleProductId: fitting?.id, kind: 'tee' }]);
  });

  it('menyimpan ukuran sebagai inci × 1000 dengan label kanonik PipeSize', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source([SINGLE_PRODUCT]) });

    const sizes = await fixture.db
      .select({ inches: productSizes.sizeInches, label: productSizes.sizeLabel })
      .from(productSizes);

    expect(sizes).toEqual([
      { inches: 750, label: '3/4"' },
      { inches: 1000, label: '1"' },
    ]);
  });
});

describe('catalog.ingest — dokumen teknis dan gambar (P1-05c)', () => {
  const WITH_ATTACHMENTS = validRow({
    sku: 'AW-A',
    documents:
      'Datasheet PVC AW|https://pralon.example/aw.pdf|7; Brosur|https://pralon.example/b.pdf',
    images: '/img/aw-1.png; /img/aw-2.png',
  });

  it('menyimpan dokumen beserta halamannya, dan halaman kosong sebagai null', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source([WITH_ATTACHMENTS]) });

    const rows = await fixture.db
      .select({
        title: productDocuments.title,
        url: productDocuments.url,
        page: productDocuments.page,
      })
      .from(productDocuments)
      .orderBy(asc(productDocuments.title));

    expect(rows).toEqual([
      { title: 'Brosur', url: 'https://pralon.example/b.pdf', page: null },
      { title: 'Datasheet PVC AW', url: 'https://pralon.example/aw.pdf', page: 7 },
    ]);
  });

  it('menyimpan urutan gambar sesuai penulisannya di sel', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source([WITH_ATTACHMENTS]) });

    const rows = await fixture.db
      .select({ url: productImages.url, sortOrder: productImages.sortOrder })
      .from(productImages)
      .orderBy(asc(productImages.sortOrder));

    expect(rows).toEqual([
      { url: '/img/aw-1.png', sortOrder: 0 },
      { url: '/img/aw-2.png', sortOrder: 1 },
    ]);
  });

  it('tidak menduplikasi dokumen maupun gambar saat impor diulang', async () => {
    await service.ingest({ importRunId: RUN_ID, source: source([WITH_ATTACHMENTS]) });
    const first = await attachmentCounts();

    await service.ingest({ importRunId: RUN_ID, source: source([WITH_ATTACHMENTS]) });

    expect(await attachmentCounts()).toEqual(first);
  });

  it('membuat jalur jawaban "Lihat dokumen teknis" bisa dicapai dari data impor', async () => {
    // Inilah alasan P1-05c ada: sebelum ini `product_documents` tidak bisa terisi
    // lewat impor, jadi jalurnya ada tetapi tidak pernah dilewati data nyata.
    await service.ingest({ importRunId: RUN_ID, source: source([WITH_ATTACHMENTS]) });

    const counted = await attachmentCounts();

    expect(counted.documents).toBeGreaterThan(0);
  });
});

describe('catalog.ingest — impor yang ditolak', () => {
  it('tidak meninggalkan versi katalog maupun produk apa pun', async () => {
    const result = await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow({ sku: 'AW-A' }), validRow({ sku: '' })]),
    });

    expect(result.catalogVersionId).toBeNull();
    const counted = await tally();
    expect(counted.versions).toBe(0);
    expect(counted.products).toBe(0);
  });

  it('menyimpan laporan galat pada run supaya admin bisa membacanya nanti', async () => {
    await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow({ sku: '' })]),
    });

    const rows = await fixture.db
      .select({
        status: catalogImportRuns.status,
        rowsRejected: catalogImportRuns.rowsRejected,
        issues: catalogImportRuns.issues,
      })
      .from(catalogImportRuns)
      .where(eq(catalogImportRuns.id, RUN_ID));

    expect(rows[0]?.status).toBe('rejected');
    expect(rows[0]?.rowsRejected).toBe(1);
    expect(rows[0]?.issues).toEqual([
      { rowNumber: 2, column: 'sku', message: 'Kolom `sku` wajib diisi.' },
    ]);
  });
});
