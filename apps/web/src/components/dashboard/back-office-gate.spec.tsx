/**
 * P29-03a — gerbang cangkang back-office.
 *
 * Ditemukan saat memeriksa produksi: layar validasi aturan dan peninjauan email tidak memanggil
 * API sama sekali, jadi tidak ada 401 yang menolak siapa pun — alamatnya terbuka untuk semua
 * yang mengetiknya. Gerbangnya sekarang di cangkang, memakai daftar peran yang sama dengan menu.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  restoreSession: vi.fn(async () => true),
  getCurrentUser: vi.fn(),
  canOpenDashboard: (user: { roles?: string[] } | null) =>
    (user?.roles ?? []).some((role) => ['admin', 'sales_reviewer'].includes(role)),
  isSales: (user: { roles?: string[] } | null) => (user?.roles ?? []).includes('sales'),
}));
vi.mock('../auth/session', () => session);
vi.mock('../notification/notification-bell', () => ({ NotificationBell: () => null }));

const { DashboardShell } = await import('./dashboard-shell');

const as = (...roles: string[]) => {
  session.getCurrentUser.mockReturnValue({ name: 'Uji', tier: 'registered', roles });
};

describe('gerbang cangkang back-office', () => {
  it('layar tanpa API pun tertutup bagi yang tidak berhak', async () => {
    as();
    render(
      <DashboardShell section="rules">
        <p>isi layar aturan</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(screen.getByText(/Halaman ini untuk tim Pralon/)).toBeTruthy());
    expect(screen.queryByText('isi layar aturan')).toBeNull();
  });

  it('ahli domain melihat isinya', async () => {
    as('domain_expert');
    render(
      <DashboardShell section="rules">
        <p>isi layar aturan</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(screen.getByText('isi layar aturan')).toBeTruthy());
  });

  it('peran untuk layar lain tidak membuka layar ini', async () => {
    as('catalog_admin');
    render(
      <DashboardShell section="handoff">
        <p>antrean teknis</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(screen.getByText(/Halaman ini untuk tim Pralon/)).toBeTruthy());
  });

  it('tim teknis membuka antrean teknis', async () => {
    as('technical_team');
    render(
      <DashboardShell section="handoff">
        <p>antrean teknis</p>
      </DashboardShell>,
    );

    await waitFor(() => expect(screen.getByText('antrean teknis')).toBeTruthy());
  });

  it('selama sesi belum terbaca, isinya belum ditampilkan maupun ditolak', async () => {
    as('admin');
    let selesai: (value: boolean) => void = () => {};
    session.restoreSession.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        selesai = resolve;
      }),
    );
    render(
      <DashboardShell section="prospects">
        <p>papan prospek</p>
      </DashboardShell>,
    );

    expect(screen.queryByText('papan prospek')).toBeNull();
    expect(screen.queryByText(/Halaman ini untuk tim Pralon/)).toBeNull();
    selesai(true);
    await waitFor(() => expect(screen.getByText('papan prospek')).toBeTruthy());
  });
});
