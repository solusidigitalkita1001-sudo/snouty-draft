/**
 * P1-06 — perilaku use case `catalog.ingest`, tanpa database.
 *
 * Writer-nya digantikan pencatat panggilan karena yang diuji di sini adalah
 * keputusannya: kapan versi dibuat, kapan tidak dibuat, dan kapan tidak terjadi
 * apa-apa sama sekali. Apakah SQL-nya benar diuji terpisah terhadap MySQL
 * sungguhan — mock tidak bisa menjawab itu.
 */
import { describe, expect, it } from 'vitest';
import {
  CATALOG_IMPORT_COLUMNS,
  type CatalogImportSource,
} from '../domain/catalog-import.contract.js';
import {
  UnknownCatalogImportRunError,
  type CatalogImportRun,
  type CatalogWriter,
  type FinishRunInput,
} from '../domain/catalog-writer.repository.js';
import { CatalogIngestService } from './catalog-ingest.service.js';

const RUN_ID = 'RUN';
const VERSION_ID = 'VERSION';

function source(
  rows: readonly Record<string, string>[],
  overrides: Partial<CatalogImportSource> = {},
): CatalogImportSource {
  return {
    label: 'v2.4',
    sourceDocument: 'Katalog produk Pralon 2026',
    columns: [...CATALOG_IMPORT_COLUMNS.required, ...CATALOG_IMPORT_COLUMNS.optional],
    rows: rows.map((values, index) => ({ rowNumber: index + 2, values })),
    ...overrides,
  };
}

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

function run(overrides: Partial<CatalogImportRun> = {}): CatalogImportRun {
  return {
    id: RUN_ID,
    label: 'v2.4',
    sourceDocument: 'Katalog produk Pralon 2026',
    status: 'pending',
    catalogVersionId: null,
    requestedBy: 'ADMIN',
    rowsAccepted: 0,
    rowsRejected: 0,
    issues: [],
    ...overrides,
  };
}

/** Writer palsu yang mencatat apa yang dipanggil, bukan yang berpura-pura berhasil. */
class RecordingWriter implements CatalogWriter {
  readonly calls: string[] = [];
  finished: FinishRunInput | null = null;
  insertedRowCount: number | null = null;
  createdVersions = 0;

  constructor(private readonly stored: CatalogImportRun | null) {}

  async findImportRun(): Promise<CatalogImportRun | null> {
    this.calls.push('findImportRun');
    return this.stored;
  }

  async createDraftVersion(): Promise<string> {
    this.calls.push('createDraftVersion');
    this.createdVersions += 1;
    return VERSION_ID;
  }

  async insertRows(_catalogVersionId: string, rows: readonly unknown[]): Promise<void> {
    this.calls.push('insertRows');
    this.insertedRowCount = rows.length;
  }

  async finishRun(input: FinishRunInput): Promise<void> {
    this.calls.push('finishRun');
    this.finished = input;
  }
}

describe('CatalogIngestService — pesan yang tidak mungkin berhasil', () => {
  it('melempar galat yang tidak boleh diulang saat run-nya tidak ada', async () => {
    const writer = new RecordingWriter(null);
    const service = new CatalogIngestService(writer);

    await expect(
      service.ingest({ importRunId: RUN_ID, source: source([validRow()]) }),
    ).rejects.toThrow(UnknownCatalogImportRunError);
  });

  it('menandai galat run tak dikenal sebagai tidak retryable, supaya berakhir di DLQ bukan di retry', () => {
    // Berapa kali pun diulang, run-nya tetap tidak ada. Queue retry hanya akan
    // menunda kabar buruknya lima kali.
    expect(new UnknownCatalogImportRunError(RUN_ID).retryable).toBe(false);
  });
});

describe('CatalogIngestService — idempotensi', () => {
  it('tidak mengerjakan apa pun lagi untuk run yang sudah berhasil', async () => {
    const writer = new RecordingWriter(
      run({ status: 'ingested', catalogVersionId: VERSION_ID, rowsAccepted: 2 }),
    );
    const service = new CatalogIngestService(writer);

    const result = await service.ingest({ importRunId: RUN_ID, source: source([validRow()]) });

    expect(writer.calls).toEqual(['findImportRun']);
    expect(result).toEqual({
      catalogVersionId: VERSION_ID,
      rowsAccepted: 2,
      rowsRejected: 0,
      issues: [],
    });
  });

  it('memakai ulang versi yang sudah tertaut, bukan membuat versi kedua', async () => {
    // Keadaan ini muncul saat proses mati setelah versi terbentuk tetapi sebelum
    // run ditandai selesai — satu-satunya cara impor bisa melahirkan dua versi.
    const writer = new RecordingWriter(run({ catalogVersionId: VERSION_ID }));
    const service = new CatalogIngestService(writer);

    const result = await service.ingest({ importRunId: RUN_ID, source: source([validRow()]) });

    expect(writer.createdVersions).toBe(0);
    expect(result.catalogVersionId).toBe(VERSION_ID);
  });
});

describe('CatalogIngestService — seluruhnya atau tidak sama sekali', () => {
  it('tidak membuat versi katalog apa pun saat ada galat validasi', async () => {
    const writer = new RecordingWriter(run());
    const service = new CatalogIngestService(writer);

    const result = await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow(), validRow({ sku: '' })]),
    });

    expect(writer.calls).toEqual(['findImportRun', 'finishRun']);
    expect(writer.createdVersions).toBe(0);
    expect(result.catalogVersionId).toBeNull();
  });

  it('menandai run sebagai rejected dan menyimpan seluruh galatnya', async () => {
    const writer = new RecordingWriter(run());
    const service = new CatalogIngestService(writer);

    await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow({ sku: '' }), validRow({ sku: 'AW-B', name: '' })]),
    });

    expect(writer.finished?.status).toBe('rejected');
    expect(writer.finished?.issues.map((i) => `${i.rowNumber}:${i.column}`)).toEqual([
      '2:sku',
      '3:name',
    ]);
  });

  it('menghitung setiap baris yang tidak lolos sebagai baris yang ditolak', async () => {
    const writer = new RecordingWriter(run());
    const service = new CatalogIngestService(writer);

    const result = await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow(), validRow({ sku: 'AW-B', source_page: '0' })]),
    });

    expect(result.rowsAccepted).toBe(1);
    expect(result.rowsRejected).toBe(1);
  });

  it('menghitung seluruh baris sebagai ditolak saat yang gagal adalah headernya', async () => {
    // Kolom wajib yang hilang berarti tidak ada baris yang bisa dibaca sama sekali;
    // melaporkan rowsRejected 0 di sini akan terbaca seolah tidak ada yang salah.
    const writer = new RecordingWriter(run());
    const service = new CatalogIngestService(writer);

    const result = await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow(), validRow({ sku: 'AW-B' })], { columns: ['sku', 'name'] }),
    });

    expect(result.rowsAccepted).toBe(0);
    expect(result.rowsRejected).toBe(2);
  });
});

describe('CatalogIngestService — impor yang bersih', () => {
  it('membuat versi draft, menyisipkan barisnya, lalu menandai run selesai — dalam urutan itu', async () => {
    const writer = new RecordingWriter(run());
    const service = new CatalogIngestService(writer);

    const result = await service.ingest({
      importRunId: RUN_ID,
      source: source([validRow(), validRow({ sku: 'AW-B' })]),
    });

    expect(writer.calls).toEqual([
      'findImportRun',
      'createDraftVersion',
      'insertRows',
      'finishRun',
    ]);
    expect(writer.insertedRowCount).toBe(2);
    expect(writer.finished?.status).toBe('ingested');
    expect(result).toEqual({
      catalogVersionId: VERSION_ID,
      rowsAccepted: 2,
      rowsRejected: 0,
      issues: [],
    });
  });
});
