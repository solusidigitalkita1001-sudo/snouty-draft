/**
 * TC-H-05 / TC-H-06 (tes live 12 Okt 2026): tab Produk dan material berisi SKU yang sama — satu
 * kartu per SKU dengan semua peruntukannya, label berbahasa Indonesia; produk tanpa jumlah tetap
 * di daftar material sebagai "menyusul" dengan keterangannya.
 */
import { render, screen } from '@testing-library/react';
import type { Recommendation } from '@snouty/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { SolutionView } from './solution-view';

vi.mock('../product/product-api', () => ({ loadProduct: vi.fn() }));

const product = (productId: string, role: string, size: string, extra: object = {}) => ({
  productId,
  role,
  size,
  matchState: 'VERIFIED_SELECTED',
  reason: `Produk ${productId}`,
  ...extra,
});

const RECOMMENDATION = {
  id: 'R'.repeat(26),
  conversationId: 'C'.repeat(26),
  snapshotId: 'S'.repeat(26),
  catalogVersionId: 'V'.repeat(26),
  headline: 'Sistem distribusi untuk 16 titik air',
  body: 'Ada 3 produk Pralon yang sesuai untuk sistem ini.',
  stats: {
    outletCount: 16,
    mainSize: '1 1/4"',
    branchCount: 4,
    fixtureConnectionSize: '1/2"',
    productCount: 3,
  },
  systemLines: [
    {
      name: 'Pipa utama',
      path: 'Toren → rumah',
      size: '1 1/4"',
      reason: 'Debit 1,2 l/s pada 1,5 m/s.',
      provenance: 'ASSUMED',
      traceIds: [],
      role: 'main',
    },
  ],
  products: [
    product('AW114', 'main', '1 1/4"', { name: 'Pipa AW 1 1/4"', purpose: 'Pipa utama' }),
    product('AW114', 'riser', '1 1/4"', { name: 'Pipa AW 1 1/4"', purpose: 'Riser' }),
    product('D2', 'main', '2"', { name: 'Pipa D 2"', purpose: 'Ventilasi air kotor' }),
    // Produk lama tanpa peruntukan: label peran dua bahasa, bukan "FITTING".
    product('Y4', 'fitting', '4"', { name: 'Bell Y - D 4"' }),
  ],
  bom: [
    {
      item: 'Pipa PVC AW',
      size: '1 1/4"',
      productId: 'AW114',
      quantity: 8,
      unit: 'batang',
      basis: 'Panjang bersih 28,5 m.',
      calc: { method: 'Jalur utama', working: '28,5 m ÷ 4 m = 7,13', result: '8 batang' },
      provenance: 'ASSUMED',
      traceIds: [],
    },
    {
      item: 'Pipa PVC D',
      size: '2"',
      productId: 'D2',
      quantity: 2,
      unit: 'batang',
      basis: 'Panjang bersih 8 m.',
      provenance: 'ASSUMED',
      traceIds: [],
    },
  ],
  assumptions: [],
  overallProvenance: 'ASSUMED',
  createdAt: '2026-10-12T00:00:00.000Z',
} as unknown as Recommendation;

describe('SolutionView — satu daftar SKU', () => {
  it('TC-H-05: satu kartu per SKU dengan daftar peruntukannya', () => {
    const { container } = render(<SolutionView recommendation={RECOMMENDATION} tab="produk" />);
    expect(container.querySelectorAll('button[class*="productCard"]')).toHaveLength(3);
    expect(screen.getByText('Pipa utama · Riser')).toBeTruthy();
    expect(screen.getByText('Ventilasi air kotor')).toBeTruthy();
  });

  it('TC-H-06: label peran berbahasa Indonesia, tanpa MAIN/RISER/BRANCH/FIXTURE/FITTING', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="produk" />);
    expect(screen.getByText('Sambungan')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b(MAIN|RISER|BRANCH|FIXTURE|FITTING)\b/);
  });

  it('TC-H-05: Y tanpa jumlah tetap di BOQ, tanpa angka, dengan keterangan fitting', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="material" />);
    const row = screen.getByText('Bell Y - D 4"').closest('tr')!;
    expect(row.textContent).toContain('Dihitung saat pemasangan');
    expect(row.textContent).not.toMatch(/batang|pcs/);
  });

  it('P17-01: tab Produk menyebut jumlah dan nomor baris BOQ yang sama dengan tab Material', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="produk" />);
    expect(screen.getByText('8 batang')).toBeTruthy();
    expect(screen.getByText('(BOQ no. 1)')).toBeTruthy();
    expect(screen.getByText('2 batang')).toBeTruthy();
    expect(screen.getByText('(BOQ no. 2)')).toBeTruthy();
    expect(screen.getByText('Jumlah menyusul')).toBeTruthy();
  });

  it('P17-01: BOQ bernomor dengan total per satuan; dasar perhitungan di tabel terpisah', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="material" />);
    const tables = document.querySelectorAll('table');
    expect(tables).toHaveLength(3);
    expect(tables[0]!.textContent).toContain('Total');
    expect(tables[0]!.textContent).not.toContain('Panjang bersih');
    expect(tables[1]!.textContent).toContain('28,5 m ÷ 4 m = 7,13');
  });
  it('P17-02: dasar perhitungan dipecah Cara hitung · Hitungan · Hasil; baris lama memakai kalimatnya; ukuran pipa punya tabel sendiri', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="material" />);
    const [, quantities, sizes] = document.querySelectorAll('table');
    const first = quantities!.querySelectorAll('tbody tr')[0]!;
    expect([...first.querySelectorAll('td')].slice(1, 4).map((td) => td.textContent)).toEqual([
      'Jalur utama',
      '28,5 m ÷ 4 m = 7,13',
      '8 batang',
    ]);
    expect(quantities!.textContent).toContain('Panjang bersih 8 m.');
    expect(sizes!.textContent).toContain('Debit 1,2 l/s pada 1,5 m/s.');
  });
});
