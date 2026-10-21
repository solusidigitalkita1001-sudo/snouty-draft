/**
 * P26-08 — cangkang sidebar: menu mengikuti peran (tampilan saja; API tetap yang menegakkan), bagian
 * yang dibuka ditandai, dan tren bulanan mengisi bulan kosong dengan nol.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ roles: ['admin'] as string[] }));
vi.mock('../auth/session', () => ({
  restoreSession: vi.fn(async () => true),
  getCurrentUser: () => ({ name: 'Orang Pralon', tier: 'registered', roles: session.roles }),
  canOpenDashboard: () =>
    session.roles.includes('admin') || session.roles.includes('sales_reviewer'),
  isSales: () => session.roles.includes('sales'),
}));

const { DashboardShell } = await import('./dashboard-shell');
const { monthlyTrend } = await import('./market-panel');

describe('DashboardShell (P26-08)', () => {
  it('admin melihat seluruh menu; bagian yang dibuka ditandai', async () => {
    session.roles = ['admin'];
    render(
      <DashboardShell section="prospects">
        <p>isi</p>
      </DashboardShell>,
    );
    for (const name of ['Prospek', 'Prospek saya', 'Pasar', 'Tim sales']) {
      expect(await screen.findByRole('link', { name })).toBeDefined();
    }
    expect(screen.getByRole('link', { name: 'Prospek' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('isi')).toBeDefined();
  });

  it('sales hanya melihat prospeknya sendiri di menu', async () => {
    session.roles = ['sales'];
    render(
      <DashboardShell section="leads">
        <p>isi</p>
      </DashboardShell>,
    );
    expect(await screen.findByRole('link', { name: 'Prospek saya' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Tim sales' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Pasar' })).toBeNull();
  });
});

describe('tren bulanan dari agregat wilayah', () => {
  it('menjumlahkan per bulan dan mengisi bulan kosong dengan nol', () => {
    const points = monthlyTrend(
      {
        buckets: [
          { key: 'Jawa Barat|2026-08', count: 5 },
          { key: 'DKI Jakarta|2026-08', count: 2 },
          { key: 'Jawa Barat|2026-10', count: 4 },
        ],
        suppressedGroups: 0,
        suppressedEvents: 0,
      },
      (ym) => ym,
    );
    expect(points).toEqual([
      { label: '2026-08', value: 7 },
      { label: '2026-09', value: 0 },
      { label: '2026-10', value: 4 },
    ]);
  });

  it('tanpa data: tanpa titik', () => {
    expect(
      monthlyTrend({ buckets: [], suppressedGroups: 0, suppressedEvents: 0 }, (m) => m),
    ).toEqual([]);
  });
});
