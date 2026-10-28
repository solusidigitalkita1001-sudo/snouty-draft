/**
 * P29-01a — antrean teknis. Yang dipaku: kasus benar-benar tampil (layar ini dulu hanya
 * memuat paragraf tentang API), kontak pengguna ikut supaya kasusnya bisa dijawab, tamu
 * dikatakan apa adanya, keterlambatan ditandai, dan status berpindah lewat API.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandoffCase } from './dashboard-api';

const api = vi.hoisted(() => ({
  fetchHandoffQueue: vi.fn(),
  setHandoffStatus: vi.fn(),
}));
vi.mock('./dashboard-api', () => api);

const { HandoffQueuePanel } = await import('./handoff-queue');

function kasus(over: Partial<HandoffCase> = {}): HandoffCase {
  return {
    id: '01JHANDOFF00000000000000AB',
    reason: 'Instalasi industri perlu diperiksa tim teknis.',
    captured: [
      { label: 'Jumlah lantai', value: '2' },
      { label: 'asumsi:fixtures.bathrooms', value: 'Dianggap 1 kamar mandi per lantai.' },
      { label: 'lampiran:01JUP', value: 'denah.pdf (2,1 MB)' },
    ],
    status: 'QUEUED',
    submitter: { name: 'Budi Santoso', email: 'budi@example.test', phone: '+628123' },
    createdAt: '2026-10-20T02:00:00Z',
    dueAt: '2026-10-21T02:00:00Z',
    resolvedAt: null,
    overdue: false,
    ...over,
  };
}

const ok = (over: Partial<HandoffCase> = {}) => ({
  kind: 'ok' as const,
  value: { open: [kasus(over)], closed: [], slaHours: 24 },
});

beforeEach(() => {
  api.fetchHandoffQueue.mockReset();
  api.setHandoffStatus.mockReset().mockResolvedValue(null);
});

describe('antrean teknis', () => {
  it('kasus terlama langsung terbuka, bukan kotak kosong (P31-80)', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok());
    render(<HandoffQueuePanel />);

    expect(await screen.findByText('Jumlah lantai')).toBeTruthy();
    expect(screen.queryByText(/Pilih satu kasus/)).toBeNull();
  });

  it('kartu menyebut perkaranya, bukan cuma nama pengirimnya (P31-80)', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok());
    render(<HandoffQueuePanel />);

    const card = await screen.findByRole('button', { name: /Budi Santoso/ });
    expect(card.textContent).toContain('Instalasi industri perlu diperiksa tim teknis.');
  });

  it('ringkasan: berapa menunggu, berapa lewat janji, berapa ditutup (P31-80)', async () => {
    api.fetchHandoffQueue.mockResolvedValue({
      kind: 'ok',
      value: {
        open: [kasus(), kasus({ id: '01JHANDOFF00000000000000CD', overdue: true })],
        closed: [
          kasus({
            id: '01JHANDOFF00000000000000EF',
            status: 'RESOLVED',
            resolvedAt: '2026-10-22T02:00:00Z',
          }),
        ],
        slaHours: 24,
      },
    });
    render(<HandoffQueuePanel />);

    // "Sudah ditutup" juga menjadi judul kelompok di daftar; ringkasannya yang pertama di DOM.
    const summary = (label: string) =>
      screen.getAllByText(label)[0]?.parentElement?.textContent ?? '';
    expect(await screen.findByText('Belum selesai')).toBeTruthy();
    expect(summary('Belum selesai')).toContain('2');
    expect(summary('Lewat janji')).toContain('1');
    expect(summary('Sudah ditutup')).toContain('1');
  });

  it('antrean kosong: satu kalimat, tanpa panel yang menunggu dipilih (P31-80)', async () => {
    api.fetchHandoffQueue.mockResolvedValue({
      kind: 'ok',
      value: { open: [], closed: [], slaHours: 24 },
    });
    render(<HandoffQueuePanel />);

    expect(await screen.findByText(/Belum ada kasus yang diserahkan/)).toBeTruthy();
    expect(screen.queryByText(/Pilih satu kasus/)).toBeNull();
  });

  it('menampilkan kasus yang menunggu, bukan penjelasan tentang API', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok());
    render(<HandoffQueuePanel />);

    expect(await screen.findByText('Budi Santoso')).toBeTruthy();
    expect(screen.queryByText(/API/)).toBeNull();
  });

  it('membuka satu kasus menampilkan yang sudah diceritakan pengguna', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok());
    render(<HandoffQueuePanel />);

    fireEvent.click(await screen.findByRole('button', { name: /Budi Santoso/ }));

    expect(await screen.findByText('Jumlah lantai')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    // Asumsi dipisahkan dari yang dinyatakan pengguna: tim teknis harus tahu mana yang ditebak.
    expect(screen.getByText('Dianggap 1 kamar mandi per lantai.')).toBeTruthy();
    expect(screen.getByText('denah.pdf (2,1 MB)')).toBeTruthy();
  });

  it('kontak pengguna bisa langsung dibalas', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok());
    render(<HandoffQueuePanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Budi Santoso/ }));

    const link = await screen.findByRole('link', { name: 'budi@example.test' });
    expect(link.getAttribute('href')).toBe('mailto:budi@example.test');
  });

  it('kasus dari tamu mengatakan apa adanya, bukan kontak kosong', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok({ submitter: null }));
    render(<HandoffQueuePanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Mengantre/ }));

    expect(await screen.findAllByText(/tidak ada alamat yang bisa dibalas/)).toBeTruthy();
  });

  it('kasus yang lewat janji ditandai terlambat', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok({ overdue: true }));
    render(<HandoffQueuePanel />);

    expect(await screen.findByText(/1×24 jam kerja/)).toBeTruthy();
  });

  it('mengambil kasus mengirim status baru lalu memuat ulang antreannya', async () => {
    api.fetchHandoffQueue.mockResolvedValue(ok());
    render(<HandoffQueuePanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Budi Santoso/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Saya kerjakan' }));

    await waitFor(() =>
      expect(api.setHandoffStatus).toHaveBeenCalledWith('01JHANDOFF00000000000000AB', 'IN_REVIEW'),
    );
    expect(api.fetchHandoffQueue).toHaveBeenCalledTimes(2);
  });

  it('kasus yang sudah ditutup bisa dibuka kembali, bukan hilang', async () => {
    api.fetchHandoffQueue.mockResolvedValue({
      kind: 'ok' as const,
      value: {
        open: [],
        closed: [kasus({ status: 'RESOLVED', resolvedAt: '2026-10-20T06:00:00Z' })],
        slaHours: 24,
      },
    });
    render(<HandoffQueuePanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Budi Santoso/ }));

    expect(await screen.findAllByText(/Ditutup setelah/)).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Buka lagi' }));
    await waitFor(() =>
      expect(api.setHandoffStatus).toHaveBeenCalledWith('01JHANDOFF00000000000000AB', 'QUEUED'),
    );
  });

  it('akun tanpa akses diarahkan masuk, bukan antrean kosong', async () => {
    api.fetchHandoffQueue.mockResolvedValue({ kind: 'forbidden' as const });
    render(<HandoffQueuePanel />);

    expect(await screen.findByText(/Halaman ini untuk tim Pralon/)).toBeTruthy();
  });
});
