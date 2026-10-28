/** P26-07 — tab Pasar: angka dari agregat server, kelompok yang ditahan disebut, atribusi DB-IP ada. */
import { render, screen, within } from '@testing-library/react';
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
        map: {
          provinces: [{ name: 'Jawa Barat', count: 7 }],
          points: [{ city: 'Bandung', province: 'Jawa Barat', lat: -6.9, lng: 107.6, count: 7 }],
          withoutRegion: 0,
          suppressedPoints: 0,
        },
        scope: { total: 12, routedToTechnical: 3, ratio: 0.25 },
        drainage: 2,
        funnel: { started: 12, reachedSolution: 9, routedToTechnical: 3, requestedQuotation: 4 },
      },
    });
    render(<MarketPanel />);
    expect(await screen.findByText('Sampai solusi')).toBeDefined();
    expect(screen.getAllByText(/Jawa Barat/).length).toBeGreaterThan(0);
    // Nama keluarga dan ukurannya kini terpisah: lencana ukuran di samping nama.
    expect(screen.getByText('PVC AW')).toBeDefined();
    expect(screen.getByText('1"')).toBeDefined();
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
        map: { provinces: [], points: [], withoutRegion: 0, suppressedPoints: 0 },
        scope: { total: 0, routedToTechnical: 0, ratio: 0 },
        drainage: 0,
        funnel: { started: 0, reachedSolution: 0, routedToTechnical: 0, requestedQuotation: 0 },
      },
    });
    render(<MarketPanel />);
    expect(await screen.findByText('Belum ada data untuk periode ini.')).toBeDefined();
  });
});

describe('kartu peringkat Pasar (P26-16)', () => {
  it('minat produk: nomor urut, nama, lencana ukuran, dan porsinya', async () => {
    api.fetchMarket.mockResolvedValue({
      kind: 'ok',
      value: {
        fromDay: '2026-07-23',
        total: 20,
        regional: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        productInterest: {
          buckets: [
            { key: 'PVC AW|1"|2026-10', count: 10 },
            { key: 'HDPE|63 mm|2026-10', count: 5 },
          ],
          suppressedGroups: 1,
          suppressedEvents: 4,
        },
        projects: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        map: { provinces: [], points: [], withoutRegion: 0, suppressedPoints: 0 },
        scope: { total: 20, routedToTechnical: 4, ratio: 0.2 },
        drainage: 1,
        funnel: { started: 20, reachedSolution: 12, routedToTechnical: 4, requestedQuotation: 6 },
      },
    });
    render(<MarketPanel />);
    const list = (await screen.findAllByRole('list')).find((el) => el.tagName === 'OL');
    expect(list).toBeDefined();
    const rows = within(list!).getAllByRole('listitem');
    expect(within(rows[0]!).getByText('PVC AW')).toBeDefined();
    expect(within(rows[0]!).getByText('1"')).toBeDefined();
    expect(within(rows[0]!).getByText('1')).toBeDefined(); // nomor urut
    expect(within(rows[0]!).getByText('50%')).toBeDefined(); // porsi dari 20 konsultasi
    expect(within(rows[1]!).getByText('63 mm')).toBeDefined();
    expect(screen.getByText(/1 kelompok \(4 konsultasi\) tidak ditampilkan/)).toBeDefined();
  });

  it('empat angka ringkas di atas halaman', async () => {
    api.fetchMarket.mockResolvedValue({
      kind: 'ok',
      value: {
        fromDay: '2026-07-23',
        total: 20,
        regional: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        productInterest: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        projects: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        map: { provinces: [], points: [], withoutRegion: 0, suppressedPoints: 0 },
        scope: { total: 20, routedToTechnical: 4, ratio: 0.2 },
        drainage: 1,
        funnel: { started: 20, reachedSolution: 12, routedToTechnical: 4, requestedQuotation: 6 },
      },
    });
    render(<MarketPanel />);
    expect(await screen.findByText('Konsultasi')).toBeDefined();
    expect(screen.getByText('60%')).toBeDefined(); // 12 dari 20 sampai solusi
    expect(screen.getByText('20%')).toBeDefined(); // porsi ke tim teknis
  });

  it('satu bulan data: kartu tren mengatakan kenapa garisnya belum ada (P31-78)', async () => {
    api.fetchMarket.mockResolvedValue({
      kind: 'ok',
      value: {
        fromDay: '2026-09-28',
        total: 3,
        regional: {
          buckets: [{ key: 'Jawa Barat|2026-10', count: 3 }],
          suppressedGroups: 0,
          suppressedEvents: 0,
        },
        productInterest: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        projects: { buckets: [], suppressedGroups: 0, suppressedEvents: 0 },
        map: { provinces: [], points: [], withoutRegion: 0, suppressedPoints: 0 },
        scope: { total: 3, routedToTechnical: 0, ratio: 0 },
        drainage: 0,
        funnel: { started: 3, reachedSolution: 1, routedToTechnical: 0, requestedQuotation: 0 },
      },
    });
    render(<MarketPanel />);
    expect(await screen.findByText(/Trennya tergambar setelah ada dua bulan/)).toBeDefined();
  });
});
