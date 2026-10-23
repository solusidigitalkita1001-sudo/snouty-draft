/**
 * Tindak lanjut prospek (P27-09): jadwal menengok, catatan, dan jejaknya. Yang dipaku di sini
 * adalah apa yang dilihat dan dikirim sales — kalimat jejak dirakit dari jenis barisnya, bukan
 * dari teks yang dikirim server.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeadActivityItem } from './dashboard-api';

const api = vi.hoisted(() => ({
  fetchLeadActivity: vi.fn(async () => ({
    kind: 'ok' as const,
    value: { items: [] as LeadActivityItem[] },
  })),
  addLeadNote: vi.fn(async () => null),
  setLeadFollowUp: vi.fn(async () => null),
}));
vi.mock('./dashboard-api', () => api);

const { LeadFollowUp, dateInputValue, isOverdue } = await import('./lead-followup');

const USER = '01JPROSPECT000000000000001';
const row = (over: Partial<LeadActivityItem>): LeadActivityItem => ({
  id: 'A'.repeat(26),
  kind: 'note',
  actorName: 'Sales Satu',
  note: null,
  status: null,
  followUpAt: null,
  at: '2026-10-23T02:00:00.000Z',
  ...over,
});

afterEach(() => vi.clearAllMocks());

describe('jadwal menengok', () => {
  it('belum dijadwalkan: dikatakan apa adanya, tanpa tombol hapus', async () => {
    render(<LeadFollowUp userId={USER} followUpAt={null} onChanged={() => undefined} />);
    expect(await screen.findByText('Belum dijadwalkan.')).toBeTruthy();
    expect(screen.queryByText('Hapus jadwal')).toBeNull();
  });

  it('menyimpan tanggal mengirim ISO tengah hari lokal, bukan tengah malam', async () => {
    render(<LeadFollowUp userId={USER} followUpAt={null} onChanged={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Tanggal menengok'), {
      target: { value: '2026-11-02' },
    });
    fireEvent.click(screen.getByText('Simpan jadwal'));
    await waitFor(() => expect(api.setLeadFollowUp).toHaveBeenCalled());
    const [, iso] = api.setLeadFollowUp.mock.calls[0] as unknown as [string, string];
    expect(new Date(iso).getHours()).toBe(12);
  });

  it('tanggal yang sudah lewat ditandai', async () => {
    render(
      <LeadFollowUp
        userId={USER}
        followUpAt="2020-01-01T12:00:00.000Z"
        onChanged={() => undefined}
      />,
    );
    expect(await screen.findByText('Jadwalnya sudah lewat.')).toBeTruthy();
  });

  it('menghapus jadwal mengirim null', async () => {
    render(
      <LeadFollowUp
        userId={USER}
        followUpAt="2030-01-01T12:00:00.000Z"
        onChanged={() => undefined}
      />,
    );
    fireEvent.click(screen.getByText('Hapus jadwal'));
    await waitFor(() => expect(api.setLeadFollowUp).toHaveBeenCalledWith(USER, null));
  });
});

describe('catatan dan jejak', () => {
  it('belum ada catatan: diajak menulis, bukan dibiarkan kosong', async () => {
    render(<LeadFollowUp userId={USER} followUpAt={null} onChanged={() => undefined} />);
    expect(
      await screen.findByText(
        'Belum ada catatan. Tulis apa yang terjadi saat Anda menghubunginya.',
      ),
    ).toBeTruthy();
  });

  it('catatan kosong tidak bisa dikirim', async () => {
    render(<LeadFollowUp userId={USER} followUpAt={null} onChanged={() => undefined} />);
    const button = await screen.findByText('Simpan catatan');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(api.addLeadNote).not.toHaveBeenCalled();
  });

  it('catatan terkirim lalu jejaknya ditarik ulang', async () => {
    render(<LeadFollowUp userId={USER} followUpAt={null} onChanged={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('Catatan tindak lanjut'), {
      target: { value: '  Sudah ditelepon, minta penawaran.  ' },
    });
    fireEvent.click(screen.getByText('Simpan catatan'));
    await waitFor(() =>
      expect(api.addLeadNote).toHaveBeenCalledWith(USER, 'Sudah ditelepon, minta penawaran.'),
    );
    await waitFor(() => expect(api.fetchLeadActivity).toHaveBeenCalledTimes(2));
  });

  it('tiap jenis baris jejak punya kalimatnya sendiri', async () => {
    api.fetchLeadActivity.mockResolvedValue({
      kind: 'ok',
      value: {
        items: [
          row({ id: 'N'.repeat(26), kind: 'note', note: 'Sudah ditelepon.' }),
          row({ id: 'S'.repeat(26), kind: 'status', status: 'lost', note: 'harga belum cocok' }),
          row({ id: 'F'.repeat(26), kind: 'follow_up', followUpAt: '2026-11-02T12:00:00.000Z' }),
          row({ id: 'G'.repeat(26), kind: 'follow_up', followUpAt: null }),
          row({ id: 'X'.repeat(26), kind: 'assigned', actorName: null }),
        ],
      },
    });
    render(<LeadFollowUp userId={USER} followUpAt={null} onChanged={() => undefined} />);
    expect(await screen.findByText('Sudah ditelepon.')).toBeTruthy();
    expect(screen.getByText('Status menjadi Kalah — harga belum cocok')).toBeTruthy();
    expect(screen.getByText(/Dijadwalkan ditengok/)).toBeTruthy();
    expect(screen.getByText('Jadwal menengok dihapus')).toBeTruthy();
    expect(screen.getByText('Ditugaskan ke sales')).toBeTruthy();
    // Pencatat tanpa nama tetap punya penyebut, bukan baris menggantung.
    expect(screen.getByText(/Tim Pralon · /)).toBeTruthy();
  });
});

describe('pembantu tanggal', () => {
  it('ISO menjadi nilai input tanggal; nilai tak sah menjadi kosong', () => {
    expect(dateInputValue('2026-11-02T12:00:00.000Z')).toBe('2026-11-02');
    expect(dateInputValue(null)).toBe('');
    expect(dateInputValue('bukan tanggal')).toBe('');
  });

  it('hari ini belum lewat; kemarin sudah', () => {
    const now = new Date('2026-10-23T08:00:00.000Z');
    expect(isOverdue('2026-10-23T12:00:00.000Z', new Date(now))).toBe(false);
    expect(isOverdue('2026-10-22T12:00:00.000Z', new Date(now))).toBe(true);
    expect(isOverdue(null, new Date(now))).toBe(false);
  });
});
