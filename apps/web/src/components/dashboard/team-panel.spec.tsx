/**
 * Tim sales (P31-79): satu daftar anggota, bukan dua kartu berisi angka yang sama.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchSalesTeam: vi.fn(),
  addSalesMember: vi.fn(),
  removeSalesMember: vi.fn(),
}));
vi.mock('./dashboard-api', () => api);
vi.mock('../auth/session', () => ({
  getCurrentUser: () => ({ name: 'Jo', tier: 'registered', roles: ['admin'] }),
}));

const { TeamPanel } = await import('./team-panel');

const TEAM = [
  { id: '01JSALES01', name: 'Sari', email: 'sari@example.test', openLeads: 0 },
  { id: '01JSALES02', name: 'Doni', email: 'doni@example.test', openLeads: 3 },
];

describe('tim sales (P31-79)', () => {
  it('nama anggota muncul sekali saja, dengan bebannya di baris yang sama', async () => {
    api.fetchSalesTeam.mockResolvedValue({ kind: 'ok', value: { items: TEAM } });
    render(<TeamPanel />);

    expect(await screen.findByText('Sari')).toBeDefined();
    expect(screen.getAllByText('Sari')).toHaveLength(1);
    expect(screen.getAllByText('Doni')).toHaveLength(1);
    expect(screen.getByText('0 prospek berjalan')).toBeDefined();
    expect(screen.getByText('3 prospek berjalan')).toBeDefined();
  });

  it('menyebut berapa anggota dan berapa prospek yang sedang dipegang', async () => {
    api.fetchSalesTeam.mockResolvedValue({ kind: 'ok', value: { items: TEAM } });
    render(<TeamPanel />);
    expect(await screen.findByText('2 anggota memegang 3 prospek berjalan.')).toBeDefined();
  });

  it('tanpa anggota: satu kalimat kosong, tanpa daftar', async () => {
    api.fetchSalesTeam.mockResolvedValue({ kind: 'ok', value: { items: [] } });
    render(<TeamPanel />);
    expect(await screen.findByText('Belum ada anggota tim sales.')).toBeDefined();
    expect(screen.queryByText(/prospek berjalan/)).toBeNull();
  });
});
