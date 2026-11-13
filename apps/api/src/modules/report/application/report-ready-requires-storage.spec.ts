/**
 * Smoke test 13 Nov 2026, temuan 11: API jalan tanpa `STORAGE_PATH`, laporan tampil READY, lalu
 * unduhannya menjawab 503. READY berarti bisa diunduh — kalau tidak, ia GAGAL dengan sebabnya.
 */
import { describe, expect, it, vi } from 'vitest';

const env: { STORAGE_PATH?: string } = {};
vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({ PRICING_ENABLED: false, TAX_RATE_PERCENT: 11, ...env }),
}));
import { configProblems } from '../../../config/startup-config.js';
import { ReportService } from './report.service.js';

const REPORT = {
  id: 'R'.repeat(26),
  recommendationId: 'REC'.padEnd(26, '0'),
  reportNumber: 'SNTY-2026-11-0001',
  status: 'PENDING',
  fileRef: null,
  failureReason: null,
};

function setup() {
  const marks: { status: string; detail: Record<string, unknown> }[] = [];
  const notified: string[] = [];
  const service = new ReportService(
    {
      findById: async () => REPORT,
      markStatus: async (_id: string, status: string, detail: Record<string, unknown>) => {
        marks.push({ status, detail });
      },
    } as never,
    { findById: async () => ({ conversationId: 'C'.repeat(26) }) } as never,
    { find: async () => ({ language: 'id' }) } as never,
    { current: async () => null } as never,
    {
      notify: async (id: string) => {
        notified.push(id);
      },
    } as never,
    async () => ({ label: 'erp-uji', effectiveFrom: '2026-11-13T00:00:00.000Z' }),
    vi.fn(),
  );
  return { service, marks, notified };
}

describe('laporan READY hanya bila berkasnya punya tempat (temuan 11)', () => {
  it('tanpa STORAGE_PATH: laporan GAGAL dengan sebabnya, bukan READY', async () => {
    delete env.STORAGE_PATH;
    const { service, marks, notified } = setup();
    await service.markReady(REPORT.id, 'laporan.pdf');
    expect(marks).toEqual([
      {
        status: 'FAILED',
        detail: { failureReason: 'penyimpanan berkas laporan belum dikonfigurasi (STORAGE_PATH)' },
      },
    ]);
    // Dan pemiliknya tidak diberi kabar laporan selesai.
    expect(notified).toEqual([]);
  });

  it('dengan STORAGE_PATH: READY seperti biasa', async () => {
    env.STORAGE_PATH = '/srv/snouty/storage';
    const { service, marks } = setup();
    await service.markReady(REPORT.id, 'laporan.pdf');
    expect(marks).toEqual([{ status: 'READY', detail: { fileRef: 'laporan.pdf' } }]);
  });

  it('konfigurasi yang kurang punya namanya sendiri saat start', () => {
    expect(configProblems({ STORAGE_PATH: undefined } as never)).toHaveLength(1);
    expect(configProblems({ STORAGE_PATH: undefined } as never)[0]).toContain('STORAGE_PATH');
    expect(configProblems({ STORAGE_PATH: '/srv/snouty/storage' } as never)).toEqual([]);
  });
});
