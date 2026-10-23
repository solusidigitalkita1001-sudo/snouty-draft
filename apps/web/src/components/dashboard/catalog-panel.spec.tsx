/**
 * P29-02a — layar katalog. Dulu ia tidak menampilkan satu baris pun dan memberi tahu
 * pembacanya bahwa daftar versi "tersedia lewat API"; pemegang `catalog_admin` tidak membaca
 * API. Yang dipaku: versinya tampil, yang aktif disebut, katalog contoh diperingatkan, dan
 * promosi berjalan lewat API.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogVersionRow } from './dashboard-api';

const api = vi.hoisted(() => ({
  fetchCatalogVersions: vi.fn(),
  promoteCatalogVersion: vi.fn(),
}));
vi.mock('./dashboard-api', () => api);

const { CatalogPanel } = await import('./catalog-panel');

function versi(over: Partial<CatalogVersionRow> = {}): CatalogVersionRow {
  return {
    id: '01JCATALOG0000000000000001',
    label: 'KATALOG PRALON v2.4',
    sourceDocument: 'Katalog produk Pralon 2026',
    kind: 'pralon',
    status: 'active',
    effectiveFrom: '2026-01-01',
    importedBy: '01JADMIN000000000000000001',
    ...over,
  };
}

const loaded = (...items: CatalogVersionRow[]) => ({
  kind: 'ok' as const,
  value: { items },
});

beforeEach(() => {
  api.fetchCatalogVersions.mockReset();
  api.promoteCatalogVersion.mockReset().mockResolvedValue(null);
});

describe('layar katalog', () => {
  it('menampilkan versi yang sedang dipakai beserta sumbernya', async () => {
    api.fetchCatalogVersions.mockResolvedValue(loaded(versi()));
    render(<CatalogPanel />);

    expect(await screen.findByText('KATALOG PRALON v2.4')).toBeTruthy();
    // Sumber dan tanggalnya satu baris, dan tanggalnya dibaca orang — bukan stempel ISO.
    expect(screen.getByText(/Dari Katalog produk Pralon 2026 · Berlaku 1 Jan 2026/)).toBeTruthy();
    expect(screen.getByText('Sedang dipakai')).toBeTruthy();
  });

  it('katalog contoh diperingatkan — jawabannya bukan data Pralon', async () => {
    api.fetchCatalogVersions.mockResolvedValue(loaded(versi({ kind: 'sample' })));
    render(<CatalogPanel />);

    expect(await screen.findByText(/belum boleh dipercaya sebagai data Pralon/)).toBeTruthy();
  });

  it('katalog Pralon yang aktif tidak memunculkan peringatan itu', async () => {
    api.fetchCatalogVersions.mockResolvedValue(loaded(versi()));
    render(<CatalogPanel />);

    await screen.findByText('KATALOG PRALON v2.4');
    expect(screen.queryByText(/bukan data Pralon/)).toBeNull();
  });

  it('draft bisa dipakai, dan versi aktif tidak menawarkan tombol itu', async () => {
    api.fetchCatalogVersions.mockResolvedValue(
      loaded(versi(), versi({ id: '01JCATALOG0000000000000002', status: 'draft' })),
    );
    render(<CatalogPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Pakai versi ini' }));
    await waitFor(() =>
      expect(api.promoteCatalogVersion).toHaveBeenCalledWith('01JCATALOG0000000000000002'),
    );
    expect(screen.queryAllByRole('button', { name: 'Pakai versi ini' })).toHaveLength(1);
  });

  it('yang diarsipkan terbaca sebagai arsip, bukan sebagai draft yang bisa dipakai', async () => {
    api.fetchCatalogVersions.mockResolvedValue(
      loaded(versi({ status: 'archived', label: 'KATALOG PRALON v2.3' })),
    );
    render(<CatalogPanel />);

    expect(await screen.findByText('Diarsipkan')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pakai versi ini' })).toBeNull();
  });

  it('akun tanpa akses diarahkan masuk', async () => {
    api.fetchCatalogVersions.mockResolvedValue({ kind: 'forbidden' as const });
    render(<CatalogPanel />);

    expect(await screen.findByText(/Halaman ini untuk tim Pralon/)).toBeTruthy();
  });
});

describe('riwayat versi tidak menenggelamkan layarnya', () => {
  it('hanya beberapa versi lama ditampilkan, sisanya disebut jumlahnya', async () => {
    const arsip = Array.from({ length: 9 }, (_, i) =>
      versi({ id: `01JCATALOG000000000000010${i}`, status: 'archived', label: `v${i}` }),
    );
    api.fetchCatalogVersions.mockResolvedValue(loaded(versi(), ...arsip));
    render(<CatalogPanel />);

    expect(await screen.findByText('v0')).toBeTruthy();
    expect(screen.queryByText('v5')).toBeNull();
    expect(screen.getByText('4 versi lama tidak ditampilkan.')).toBeTruthy();
  });

  it('draft tidak pernah tersembunyi di balik arsip', async () => {
    const arsip = Array.from({ length: 9 }, (_, i) =>
      versi({ id: `01JCATALOG000000000000020${i}`, status: 'archived', label: `arsip-${i}` }),
    );
    api.fetchCatalogVersions.mockResolvedValue(
      loaded(
        versi(),
        ...arsip,
        versi({ id: '01JCATALOG0000000000000099', status: 'draft', label: 'draft baru' }),
      ),
    );
    render(<CatalogPanel />);

    expect(await screen.findByText('draft baru')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pakai versi ini' })).toBeTruthy();
  });
});
