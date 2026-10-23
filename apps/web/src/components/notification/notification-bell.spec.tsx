/**
 * Lonceng pemberitahuan (P27-07). Yang dipaku: tamu tidak melihatnya, kalimatnya dirakit dari
 * kejadian (bukan dari teks yang dikirim server), dan "tandai sudah dibaca" benar-benar memanggil
 * server lalu menyegarkan isinya.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './notification-bell';
import { notificationAge, notificationLine, notificationShell } from './notification-copy';
import type { NotificationItem } from './notification-api';

const api = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(async () => undefined),
}));
vi.mock('./notification-api', () => api);

const COPY = notificationShell('id');

const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'N'.repeat(26),
  kind: 'lead_assigned',
  subjectId: 'U'.repeat(26),
  data: {},
  read: false,
  createdAt: new Date().toISOString(),
  ...over,
});

afterEach(() => vi.clearAllMocks());

describe('NotificationBell', () => {
  it('tamu: tidak dirender, dan servernya tidak ditanya', () => {
    const { container } = render(<NotificationBell enabled={false} />);
    expect(container.firstChild).toBeNull();
    expect(api.fetchNotifications).not.toHaveBeenCalled();
  });

  it('tidak ada apa-apa: loncengnya tidak dirender — bukan lonceng kosong', async () => {
    api.fetchNotifications.mockResolvedValue({ unread: 0, items: [] });
    const { container } = render(<NotificationBell />);
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('jumlah belum dibaca tampil sebagai angka, bukan titik', async () => {
    api.fetchNotifications.mockResolvedValue({
      unread: 3,
      items: [item(), item({ id: 'M'.repeat(26) })],
    });
    render(<NotificationBell />);
    expect(await screen.findByText('3')).toBeTruthy();
  });

  it('dibuka: kalimatnya dirakit dari kejadian', async () => {
    api.fetchNotifications.mockResolvedValue({ unread: 1, items: [item()] });
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /Pemberitahuan/ }));
    expect(screen.getByText('Ada prospek yang ditugaskan kepada Anda.')).toBeTruthy();
  });

  it('tandai sudah dibaca memanggil server lalu menyegarkan', async () => {
    api.fetchNotifications.mockResolvedValue({ unread: 1, items: [item()] });
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /Pemberitahuan/ }));
    fireEvent.click(screen.getByText(COPY.markAll));
    await waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalledWith());
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalledTimes(2));
  });
});

describe('kalimat pemberitahuan', () => {
  it('permintaan dihubungi menyebut dari mana', () => {
    const line = notificationLine(
      item({ kind: 'contact_requested', data: { source: 'price' } }),
      'id',
    );
    expect(line.text).toBe('Ada yang minta dihubungi tim Pralon saat menanyakan harga.');
    expect(line.href).toBe('/internal/prospects');
  });

  it('sumber yang tidak dikenali tidak membuat kalimat menggantung', () => {
    const line = notificationLine(item({ kind: 'contact_requested', data: { source: 'x' } }), 'id');
    expect(line.text).toBe('Ada yang minta dihubungi tim Pralon.');
  });

  it('laporan siap membawa nomornya dan jalan ke percakapannya', () => {
    const line = notificationLine(
      item({
        kind: 'report_ready',
        data: { reportNumber: 'SNTY-2026-10-0020', conversationId: 'C'.repeat(26) },
      }),
      'id',
    );
    expect(line.text).toBe('Laporan SNTY-2026-10-0020 sudah siap diunduh.');
    expect(line.href).toBe(`/consultation?c=${'C'.repeat(26)}`);
  });

  it('Inggris setara, tanpa kata Indonesia yang tertinggal', () => {
    const line = notificationLine(item({ kind: 'lead_assigned' }), 'en');
    expect(line.text).toBe('A prospect was assigned to you.');
  });

  it('umurnya dalam bahasa biasa, bukan stempel waktu', () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const at = (iso: string) => notificationAge(iso, 'id', now);
    expect(at('2026-10-23T11:59:40.000Z')).toBe('baru saja');
    expect(at('2026-10-23T11:45:00.000Z')).toBe('15 menit lalu');
    expect(at('2026-10-23T09:00:00.000Z')).toBe('3 jam lalu');
    expect(at('2026-10-21T12:00:00.000Z')).toBe('2 hari lalu');
  });
});
