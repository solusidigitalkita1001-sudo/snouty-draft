/**
 * Kontrak job: payload divalidasi di tepi, dan **tidak pernah membawa data pribadi**.
 */
import { describe, expect, it } from 'vitest';
import {
  backoffFor,
  CONTRACT_VERSION,
  CatalogIngestJob,
  deadLetterQueueOf,
  EmailAnalyzeJob,
  JOB_SCHEMA,
  QUEUES,
  ReportGenerateJob,
  RETRY_POLICY,
} from './index.js';

const VALID = {
  contractVersion: CONTRACT_VERSION,
  correlationId: '01JBCORRELATION00000000000',
  reportId: '01JBREPORT000000000000000A',
};

describe('ReportGenerateJob', () => {
  it('menerima payload yang sah', () => {
    expect(() => ReportGenerateJob.parse(VALID)).not.toThrow();
  });

  it('menolak versi kontrak yang tidak dikenal — konsumer tidak menebak', () => {
    expect(() => ReportGenerateJob.parse({ ...VALID, contractVersion: 99 })).toThrow();
  });

  it('menolak properti tambahan (.strict)', () => {
    // Pesan dari versi kode lain bisa membawa field asing; menerimanya diam-diam berarti
    // konsumer bekerja atas asumsi yang tidak pernah diperiksa.
    expect(() => ReportGenerateJob.parse({ ...VALID, customerName: 'Budi' })).toThrow();
  });

  it('menolak id yang panjangnya bukan ULID', () => {
    expect(() => ReportGenerateJob.parse({ ...VALID, reportId: 'pendek' })).toThrow();
  });

  it('hanya membawa id — tidak ada tempat untuk data pribadi', () => {
    const keys = Object.keys(ReportGenerateJob.parse(VALID));
    expect(keys.sort()).toEqual(['contractVersion', 'correlationId', 'reportId']);
  });
});

describe('payload lain juga hanya id', () => {
  it('catalog.ingest', () => {
    const parsed = CatalogIngestJob.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId: 'c',
      importRunId: '01JBRUN00000000000000000AA',
      catalogVersionId: '01JBVER00000000000000000BB',
    });
    expect(Object.keys(parsed).sort()).toEqual([
      'catalogVersionId',
      'contractVersion',
      'correlationId',
      'importRunId',
    ]);
  });

  it('email.analyze tidak pernah memuat isi email', () => {
    const parsed = EmailAnalyzeJob.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId: 'c',
      emailId: '01JBEMAIL0000000000000000A',
    });
    expect(JSON.stringify(parsed)).not.toMatch(/body|subject|from/i);
  });
});

describe('peta antrean', () => {
  it('setiap antrean punya skema', () => {
    for (const queue of Object.values(QUEUES)) {
      expect(JOB_SCHEMA[queue], queue).toBeDefined();
    }
  });
});

describe('kebijakan percobaan ulang', () => {
  it('backoff menaik dan tidak melampaui tabel', () => {
    expect(backoffFor(1)).toBe(1_000);
    expect(backoffFor(2)).toBe(5_000);
    expect(backoffFor(3)).toBe(30_000);
    // Percobaan di luar tabel memakai jeda terpanjang, bukan undefined.
    expect(backoffFor(9)).toBe(30_000);
  });

  it('percobaan ke-0 tidak menghasilkan indeks negatif', () => {
    expect(backoffFor(0)).toBe(1_000);
  });

  it('nama DLQ diturunkan, tidak diketik ulang', () => {
    expect(deadLetterQueueOf(QUEUES.reportGenerate)).toBe('snouty.report.generate.dlq');
    expect(RETRY_POLICY.maxAttempts).toBe(3);
  });
});
