/**
 * P8-03a — nomor laporan: dua permintaan serentak tidak pernah mendapat nomor sama,
 * dan nomor tidak dipakai ulang walau laporannya gagal. docs/REPORT.md §3.
 *
 * Fixture memakai POOL (bukan satu koneksi): dengan koneksi tunggal, dua transaksi
 * "serentak" sebenarnya berjalan berurutan dan `FOR UPDATE` tidak pernah mengunci apa
 * pun — kesalahan yang sudah pernah membuat tes balapan lulus padahal kodenya salah.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../../test/mysql.js';
import {
  calculationTraces,
  conversations,
  recommendations,
  reports,
} from '../../../infrastructure/mysql/schema/index.js';
import { ulid } from '../../../shared/ulid.js';
import { formatReportNumber } from '../domain/report-number.js';
import { MysqlReportRepository } from './mysql-report.repository.js';
import type { ReportPayload } from '../domain/report.types.js';

const mysql = await createTestDatabase('reports');
const repository = new MysqlReportRepository({ db: mysql.db } as never);

const EMPTY_PAYLOAD = {
  reportNumber: 'SNTY-2026-10-0001',
  identity: {
    customerName: 'Tamu',
    projectLocation: '—',
    consultationDate: '2026-10-02',
    installationType: 'Air bersih',
  },
  headline: 'Judul',
  body: 'Isi',
  requirements: [],
  systemLines: [],
  assumptions: [],
  bom: [],
  basis: [],
  pricing: { enabled: false, taxRatePercent: 11, subtotal: 0, taxAmount: 0, total: 0 },
  catalogVersionLabel: 'dev-0.2',
  overallProvenance: 'ASSUMED',
} satisfies ReportPayload;

async function seedRecommendation(): Promise<string> {
  const conversationId = ulid();
  await mysql.db
    .insert(conversations)
    .values({ id: conversationId, ownerKind: 'guest', ownerId: ulid() });
  const recommendationId = ulid();
  await mysql.db.insert(recommendations).values({
    id: recommendationId,
    conversationId,
    snapshotId: ulid(),
    catalogVersionId: ulid(),
    headline: 'Judul',
    body: 'Isi',
    stats: {},
    systemLines: [],
    products: [],
    bom: [],
    assumptions: [],
    overallProvenance: 'ASSUMED',
  });
  return recommendationId;
}

beforeEach(() => mysql.clear());
afterAll(() => mysql.close());

describe('alokasi nomor laporan', () => {
  it('urutan dimulai dari 1 setiap bulan', async () => {
    expect(await repository.allocateNumber('2026-10')).toBe(1);
    expect(await repository.allocateNumber('2026-10')).toBe(2);
    // Bulan berbeda punya urutan sendiri.
    expect(await repository.allocateNumber('2026-11')).toBe(1);
  });

  it('dua permintaan serentak mendapat nomor berbeda', async () => {
    const results = await Promise.all([
      repository.allocateNumber('2026-10'),
      repository.allocateNumber('2026-10'),
      repository.allocateNumber('2026-10'),
      repository.allocateNumber('2026-10'),
    ]);
    expect(new Set(results).size).toBe(4);
    expect([...results].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('nomor unik ditegakkan basis data', async () => {
    const recommendationId = await seedRecommendation();
    const number = formatReportNumber('2026-10', 1);
    await repository.create({
      id: ulid(),
      recommendationId,
      reportNumber: number,
      payload: EMPTY_PAYLOAD,
    });
    await expect(
      repository.create({
        id: ulid(),
        recommendationId,
        reportNumber: number,
        payload: EMPTY_PAYLOAD,
      }),
    ).rejects.toThrow();
  });

  it('laporan gagal tidak melepas nomornya untuk dipakai ulang', async () => {
    const recommendationId = await seedRecommendation();
    const first = await repository.allocateNumber('2026-10');
    const report = await repository.create({
      id: ulid(),
      recommendationId,
      reportNumber: formatReportNumber('2026-10', first),
      payload: EMPTY_PAYLOAD,
    });
    await repository.markStatus(report.id, 'FAILED', { failureReason: 'timeout' });

    // Permintaan berikutnya mendapat nomor BERIKUTNYA, bukan nomor yang gagal.
    expect(await repository.allocateNumber('2026-10')).toBe(first + 1);
    const failed = await repository.findById(report.id);
    expect(failed?.status).toBe('FAILED');
    expect(failed?.reportNumber).toBe(formatReportNumber('2026-10', first));
  });
});

describe('siklus status laporan', () => {
  it('PENDING → READY mencatat fileRef dan waktu selesai', async () => {
    const recommendationId = await seedRecommendation();
    const report = await repository.create({
      id: ulid(),
      recommendationId,
      reportNumber: formatReportNumber('2026-10', 9),
      payload: EMPTY_PAYLOAD,
    });
    expect(report.status).toBe('PENDING');
    expect(report.completedAt).toBeNull();

    await repository.markStatus(report.id, 'READY', { fileRef: 'reports/abc.pdf' });
    const ready = await repository.findById(report.id);
    expect(ready?.status).toBe('READY');
    expect(ready?.fileRef).toBe('reports/abc.pdf');
    expect(ready?.completedAt).not.toBeNull();
  });

  it('payload dibekukan — dibaca kembali apa adanya', async () => {
    const recommendationId = await seedRecommendation();
    const payload = { ...EMPTY_PAYLOAD, headline: 'Sistem distribusi untuk 8 titik air' };
    const report = await repository.create({
      id: ulid(),
      recommendationId,
      reportNumber: formatReportNumber('2026-10', 10),
      payload,
    });
    const read = await repository.findById(report.id);
    expect(read?.payload.headline).toBe('Sistem distribusi untuk 8 titik air');
  });

  it('menghapus rekomendasi menghapus laporannya (cascade)', async () => {
    const recommendationId = await seedRecommendation();
    await repository.create({
      id: ulid(),
      recommendationId,
      reportNumber: formatReportNumber('2026-10', 11),
      payload: EMPTY_PAYLOAD,
    });
    await mysql.db.delete(calculationTraces);
    await mysql.db.delete(recommendations);
    expect(await mysql.db.select().from(reports)).toHaveLength(0);
  });
});
