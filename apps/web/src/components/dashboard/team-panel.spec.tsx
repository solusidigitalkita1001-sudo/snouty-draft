/**
 * Tim sales (P31-79): satu daftar anggota, bukan dua kartu berisi angka yang sama.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('3 prospek berjalan')).toBeDefined();
  });

  /**
   * P39-06 — beban nol dulu tampil sebagai tautan "0 prospek berjalan" ke papan yang disaring;
   * di balik saringan itu tidak ada apa-apa, jadi tautannya menjanjikan layar yang kosong.
   */
  it('beban nol bukan tautan', async () => {
    api.fetchSalesTeam.mockResolvedValue({ kind: 'ok', value: { items: TEAM } });
    render(<TeamPanel />);

    expect(await screen.findByText('Belum memegang prospek')).toBeDefined();
    expect(screen.queryByText('0 prospek berjalan')).toBeNull();
    expect(screen.getByRole('link', { name: '3 prospek berjalan' })).toBeDefined();
  });

  /**
   * P39-07 — pencabutan memindahkan prospek yang sedang dikerjakan orang, jadi ia mengatakan
   * akibatnya lebih dulu dan tidak terjadi sebelum dibenarkan.
   */
  it('mencabut anggota bertanya dulu, dan menyebut berapa prospek yang kembali ke papan', async () => {
    api.fetchSalesTeam.mockResolvedValue({ kind: 'ok', value: { items: TEAM } });
    api.removeSalesMember.mockResolvedValue(null);
    render(<TeamPanel />);

    const rows = await screen.findAllByRole('button', { name: 'Cabut' });
    fireEvent.click(rows[1]!);

    expect(screen.getByText(/Cabut Doni dari tim sales/)).toBeDefined();
    expect(screen.getByText(/3 prospek yang dipegangnya kembali ke papan/)).toBeDefined();
    expect(api.removeSalesMember).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByText(/kembali ke papan/)).toBeNull();
    expect(api.removeSalesMember).not.toHaveBeenCalled();
  });

  it('setelah dibenarkan, pencabutannya benar-benar dikirim', async () => {
    api.fetchSalesTeam.mockResolvedValue({ kind: 'ok', value: { items: TEAM } });
    api.removeSalesMember.mockResolvedValue(null);
    render(<TeamPanel />);

    const rows = await screen.findAllByRole('button', { name: 'Cabut' });
    fireEvent.click(rows[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cabut' }).at(-1)!);

    await waitFor(() => expect(api.removeSalesMember).toHaveBeenCalledWith('01JSALES02'));
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
