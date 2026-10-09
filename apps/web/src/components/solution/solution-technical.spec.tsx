/**
 * Panel "detail teknis": langkah hitung bernomor per jalur, tanpa kode aturan; baris penjelasan
 * cara hitung di daftar asumsi tidak punya tombol Perbaiki (laporan pemilik 2026-10-09).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { Recommendation } from '@snouty/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { SolutionView } from './solution-view';

vi.mock('../product/product-api', () => ({ loadProduct: vi.fn() }));

const RECOMMENDATION = {
  id: 'R'.repeat(26),
  conversationId: 'C'.repeat(26),
  snapshotId: 'S'.repeat(26),
  catalogVersionId: 'V'.repeat(26),
  kind: 'technical',
  headline: 'Gedung 12 lantai',
  body: 'Perkiraan awal.',
  stats: {
    outletCount: 1,
    mainSize: '6"',
    branchCount: 2,
    fixtureConnectionSize: '6"',
    productCount: 0,
  },
  systemLines: [
    {
      name: 'Pipa transfer PVC AW',
      path: 'Tangki bawah → tangki atap',
      size: '6"',
      reason: 'Dicoba 10 ukuran; 6" yang terkecil.',
      provenance: 'ASSUMED',
      traceIds: ['T1', 'T2'],
      role: 'main',
      steps: [
        { title: 'Kebutuhan air harian dan puncak', text: 'Kebutuhan harian 540 m³.' },
        { title: 'Pilih ukuran pipa', text: 'Dicoba 10 ukuran; 6" yang terkecil.' },
      ],
    },
  ],
  products: [],
  bom: [],
  assumptions: [
    { text: 'Cara hitungnya: jumlah orang × kebutuhan air.', fieldPath: '' },
    { text: 'Satu orang per 10 m² luas lantai kotor.', fieldPath: 'number_of_occupants' },
  ],
  overallProvenance: 'ASSUMED',
  createdAt: '2026-10-09T00:00:00.000Z',
} as unknown as Recommendation;

describe('SolutionView — detail teknis', () => {
  it('langkah bernomor dengan judul langkah, tanpa kode aturan', () => {
    render(<SolutionView recommendation={RECOMMENDATION} tab="ringkasan" />);
    fireEvent.click(screen.getByRole('button', { name: /Tampilkan detail teknis/ }));
    expect(screen.getByText('Kebutuhan air harian dan puncak.')).toBeTruthy();
    expect(screen.getByText('Pilih ukuran pipa.')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/ENG-\d/);
  });

  it('baris penjelasan cara hitung tanpa tombol Perbaiki; asumsi biasa tetap punya', () => {
    render(
      <SolutionView recommendation={RECOMMENDATION} tab="material" onFixAssumption={vi.fn()} />,
    );
    expect(screen.getAllByRole('button', { name: /Perbaiki asumsi ini/ })).toHaveLength(1);
  });
});

describe('SolutionView — ganti nilai asumsi', () => {
  const WITH_VALUES = {
    ...RECOMMENDATION,
    assumptions: [
      {
        text: 'Air dipakai selama 10 jam per hari.',
        fieldPath: 'operating_hours',
        assumptionId: 'USAGE_HOURS_10',
        value: 10,
        unit: 'jam/hari',
      },
      {
        text: 'Kebutuhan air 150 liter per orang per hari — Anda ubah menjadi 200 l/orang/hari.',
        fieldPath: 'design_flow',
        assumptionId: 'DEMAND_LPCD_150',
        value: 200,
        unit: 'l/orang/hari',
        userSet: true,
      },
    ],
  } as unknown as Recommendation;

  it('Perbaiki → isi angka → Hitung ulang mengirim nilai baru', async () => {
    const change = vi.fn(async () => null);
    render(
      <SolutionView recommendation={WITH_VALUES} tab="material" onChangeAssumption={change} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Perbaiki asumsi ini/ })[0]!);
    const input = screen.getByLabelText('Nilai baru') as HTMLInputElement;
    expect(input.value).toBe('10');
    expect(screen.getByText('jam/hari')).toBeTruthy();
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hitung ulang' }));
    await vi.waitFor(() => expect(change).toHaveBeenCalledWith('USAGE_HOURS_10', 8));
  });

  it('nilai dari pengguna bisa dikembalikan; pesan penolakan tampil di barisnya', async () => {
    const change = vi.fn(
      async () => 'Nilai itu di luar batas hitung — coba angka yang lebih wajar.',
    );
    render(
      <SolutionView recommendation={WITH_VALUES} tab="material" onChangeAssumption={change} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Perbaiki asumsi ini/ })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Kembalikan nilai awal' }));
    await vi.waitFor(() => expect(change).toHaveBeenCalledWith('DEMAND_LPCD_150', null));
    expect(await screen.findByText(/di luar batas hitung/)).toBeTruthy();
  });
});
