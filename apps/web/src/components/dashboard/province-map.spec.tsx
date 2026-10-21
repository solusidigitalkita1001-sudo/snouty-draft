/**
 * P26-12 — peta permintaan: zona provinsi dengan jumlahnya, klik memfokuskan provinsi dan memunculkan
 * titik kotanya, dan angka yang sama tetap terbaca sebagai teks.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MapDemand } from './dashboard-api';
import { ProvinceMap } from './province-map';

const MAP: MapDemand = {
  provinces: [
    { name: 'Jawa Barat', count: 12 },
    { name: 'Bali', count: 5 },
  ],
  points: [
    { city: 'Bandung', province: 'Jawa Barat', lat: -6.9, lng: 107.6, count: 7 },
    { city: 'Bekasi', province: 'Jawa Barat', lat: -6.2, lng: 107.0, count: 5 },
    { city: 'Denpasar', province: 'Bali', lat: -8.7, lng: 115.2, count: 5 },
  ],
  withoutRegion: 3,
  suppressedPoints: 2,
};

describe('peta permintaan (P26-12)', () => {
  it('provinsi dan jumlahnya terbaca sebagai teks, bukan hanya warna', () => {
    render(<ProvinceMap map={MAP} />);
    expect(screen.getByRole('button', { name: /Jawa Barat · 12 konsultasi/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Bali · 5 konsultasi/ })).toBeDefined();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'Jawa Barat: 12 konsultasi',
    );
  });

  it('klik provinsi memfokuskannya dan hanya menampilkan kota di dalamnya', () => {
    render(<ProvinceMap map={MAP} />);
    fireEvent.click(screen.getByRole('button', { name: /Jawa Barat/ }));
    const svg = screen.getByRole('img');
    expect(within(svg).getByText('Bandung')).toBeDefined();
    expect(within(svg).getByText('Bekasi')).toBeDefined();
    expect(within(svg).queryByText('Denpasar')).toBeNull();
    expect(screen.getByText(/Jawa Barat — sebaran kota/)).toBeDefined();
  });

  it('bisa kembali ke seluruh Indonesia', () => {
    render(<ProvinceMap map={MAP} />);
    fireEvent.click(screen.getByRole('button', { name: /Bali · 5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lihat seluruh Indonesia' }));
    expect(screen.getByText('Peta permintaan')).toBeDefined();
  });

  it('konsultasi tanpa wilayah dan kota di bawah ambang disebut, bukan dihilangkan diam-diam', () => {
    render(<ProvinceMap map={MAP} />);
    expect(
      screen.getByText(/3 konsultasi tanpa wilayah · 2 di kota dengan kurang dari 5/),
    ).toBeDefined();
  });

  it('tanpa wilayah sama sekali: kalimat kosong', () => {
    render(
      <ProvinceMap map={{ provinces: [], points: [], withoutRegion: 0, suppressedPoints: 0 }} />,
    );
    expect(screen.getAllByText('Belum ada wilayah yang bisa ditampilkan.').length).toBeGreaterThan(
      0,
    );
  });
});
