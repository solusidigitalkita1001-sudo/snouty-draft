/**
 * "Susun ulang dengan aturan terbaru" (keputusan pemilik 2026-10-12): laporan versi lama tidak
 * diubah; rekomendasi baru disusun dari kebutuhan tersimpan dan laporan BARU dibuat dengan
 * identitas pelanggan yang sama.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  loadEnv: () => ({ PRICING_ENABLED: false, TAX_RATE_PERCENT: 11 }),
}));
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { ReportService } from './report.service.js';

const OLD = {
  id: 'R'.repeat(26),
  recommendationId: 'OLDREC'.padEnd(26, '0'),
  reportNumber: 'SNTY-2026-10-0002',
  status: 'READY',
  payload: { identity: { customerName: 'Tomo', projectLocation: 'Bekasi' } },
  fileRef: 'x.pdf',
  failureReason: null,
  createdAt: '2026-10-12T02:29:11.000Z',
  completedAt: null,
};

function setup(traces: { ruleId: string; ruleVersion: number }[]) {
  const created: unknown[] = [];
  const recompose = vi.fn(async () => 'NEWREC'.padEnd(26, '0'));
  const service = new ReportService(
    {
      findById: async (id: string) => (id === OLD.id ? OLD : null),
      allocateNumber: async () => 4,
      create: async (r: unknown) => {
        created.push(r);
        return { ...(r as object), status: 'PENDING', createdAt: 'now' };
      },
    } as never,
    {
      findById: async (id: string) => ({
        id,
        conversationId: 'C'.repeat(26),
        catalogVersionId: 'V',
        headline: 'h',
        body: 'b',
        systemLines: [],
        assumptions: [],
        bom: [],
        products: [],
        overallProvenance: 'ASSUMED',
      }),
      findTraces: async () => traces,
    } as never,
    { find: async () => ({ language: 'id' }) } as never,
    {
      current: async () => ({
        id: 'S'.repeat(26),
        state: emptyRequirementState('2026-10-12T00:00:00.000Z'),
      }),
    } as never,
    null,
    async () => 'erp-uji',
    recompose,
  );
  return { service, created, recompose };
}

describe('ReportService — laporan versi lama', () => {
  it('isOutdated dari trace: aturan dihapus/naik versi → true', async () => {
    const { service } = setup([{ ruleId: 'ENG-009', ruleVersion: 1 }]);
    expect(await service.isOutdated(OLD as never)).toBe(true);
    const { service: fresh } = setup([{ ruleId: 'ENG-003', ruleVersion: 2 }]);
    expect(await fresh.isOutdated(OLD as never)).toBe(false);
  });

  it('rebuild: rekomendasi baru, laporan baru bernomor baru, identitas sama', async () => {
    const { service, created, recompose } = setup([{ ruleId: 'ENG-009', ruleVersion: 1 }]);
    const report = await service
      .rebuild(OLD.id, { kind: 'user', id: 'U' } as never, '2026-10-12T10:00:00.000Z')
      .catch((e: Error) => e);
    expect(recompose).toHaveBeenCalledWith(
      'C'.repeat(26),
      'S'.repeat(26),
      expect.anything(),
      'id',
      '2026-10-12T10:00:00.000Z',
    );
    if (report instanceof Error) throw report;
    expect(report.reportNumber).toBe('SNTY-2026-10-0004');
    expect((created[0] as { recommendationId: string }).recommendationId).toBe(
      'NEWREC'.padEnd(26, '0'),
    );
    expect(
      (created[0] as { payload: { identity: { customerName: string } } }).payload.identity
        .customerName,
    ).toBe('Tomo');
  });
});
