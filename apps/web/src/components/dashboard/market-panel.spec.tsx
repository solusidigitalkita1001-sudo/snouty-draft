/** P26-07 — tab Pasar: angka dari agregat server, kelompok yang ditahan disebut, atribusi DB-IP ada. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetchMarket: vi.fn() }));
vi.mock('./dashboard-api', () => api);

const { MarketPanel } = await import('./market-panel');

describe('tab Pasar (P26-07)', () => {
  it('corong, provinsi, minat produk, dan kelompok yang ditahan', async () => {
    api.fetchMarket.mockResolvedValue({
      kind: 'ok',
      value: {
        fromDay: '2026-07-23',
        total: 12,
        regional: {
          buckets: [{ key: 'Jawa Barat|2026-10', count: 7 }],
          suppressedGroups: 2,
          suppressedEvents: 5,
        },
        productInterest: {
          buckets: [{ key: 'PVC AW|1"|2026-10', count: 6 }],
          suppressedGroups: 0,
          suppressedEvents: 0,
        },
        projects: {
          buckets: [{ key: 'residential|kecil|Jawa Barat', count: 6 }],
          suppressedGroups: 0,
          suppressedEvents: 0,
        },
        scope: { total: 12, routedToTechnical: 3, ratio: 0.25 },
        drainage: 2,
        funnel: { started: 12, reachedSolution: 9, routedToTechnical: 3, requestedQuotation: 4 },
      },
    });
    render(<MarketPanel />);
    expect(await screen.findByText('Sampai solusi')).toBeDefined();
    expect(screen.getByText('Jawa Barat')).toBeDefined();
    expect(screen.getByText(/PVC AW 1"/)).toBeDefined();
    expect(screen.getByText('Rumah tinggal')).toBeDefined();
    expect(screen.getByText(/kecil · Jawa Barat/)).toBeDefined();
    expect(screen.getByText(/2 kelompok \(5 konsultasi\) tidak ditampilkan/)).toBeDefined();
    expect(screen.getByText(/DB-IP/)).toBeDefined();
  });

  it('tanpa data: kalimat kosong, bukan tabel kosong', async () => {
    api.fetchMarket.mockResolvedValue({
      kind: 'ok',
      value: {
        fromDay: '2026-07-23',
        total: 0,
        regional: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        productInterest: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        projects: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        scope: { total: 0, routedToTechnical: 0, ratio: 0 },
        drainage: 0,
        funnel: { started: 0, reachedSolution: 0, routedToTechnical: 0, requestedQuotation: 0 },
      },
    });
    render(<MarketPanel />);
    expect(await screen.findByText('Belum ada data untuk periode ini.')).toBeDefined();
  });
});
