/**
 * Dashboard admin (P26-05): yang diuji adalah aturan tampilannya, bukan tata letaknya (belum didesain):
 * angka dari API apa adanya, prospek tanpa dasar kontak tidak bisa ditugaskan, dan akun tanpa akses
 * diarahkan masuk — bukan papan kosong.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProspectItem } from './dashboard-api';

const api = vi.hoisted(() => ({
  fetchProspects: vi.fn(),
  fetchSalesTeam: vi.fn(),
  assignProspect: vi.fn(),
  addSalesMember: vi.fn(),
  removeSalesMember: vi.fn(),
}));
vi.mock('./dashboard-api', () => api);
vi.mock('../auth/session', () => ({
  restoreSession: vi.fn(async () => true),
  getCurrentUser: () => ({ name: 'Admin', tier: 'registered', roles: ['admin'] }),
}));

const { ProspectDashboard } = await import('./prospect-dashboard');

function prospect(over: Partial<ProspectItem>): ProspectItem {
  return {
    userId: '01JPROSPECT000000000000001',
    name: 'Budi',
    email: 'budi@example.test',
    phone: null,
    registeredAt: '2026-10-01T00:00:00Z',
    stage: 'ask',
    stageReachedAt: '2026-10-20T00:00:00Z',
    lastActivityAt: '2026-10-20T00:00:00Z',
    scale: 'district',
    score: 16,
    priority: 'hot',
    salesContactConsent: false,
    salesRequestedAt: '2026-10-20T00:00:00Z',
    contactable: true,
    conversationCount: 2,
    lead: null,
    ...over,
  };
}

const FUNNEL = { aware: 3, appeal: 2, ask: 1, act: 0, advocate: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSalesTeam.mockResolvedValue({
    kind: 'ok',
    value: {
      items: [{ id: '01JSALES0000000000000000001', name: 'Sari', email: 's@x.test', openLeads: 0 }],
    },
  });
});

describe('dashboard prospek (P26-05)', () => {
  it('corong 5A dan baris prospek dari API', async () => {
    api.fetchProspects.mockResolvedValue({
      kind: 'ok',
      value: { funnel: FUNNEL, items: [prospect({})] },
    });
    render(<ProspectDashboard />);
    expect(await screen.findByText('Budi')).toBeDefined();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Panas')).toBeDefined();
    expect(table.getByText('Kawasan')).toBeDefined();
    expect(table.getByText('Minta dihubungi')).toBeDefined();
    expect(screen.getByRole('button', { name: /3\s*Aware/ })).toBeDefined();
  });

  it('prospek tanpa izin maupun permintaan kontak tidak bisa ditugaskan', async () => {
    api.fetchProspects.mockResolvedValue({
      kind: 'ok',
      value: {
        funnel: FUNNEL,
        items: [prospect({ contactable: false, salesRequestedAt: null })],
      },
    });
    render(<ProspectDashboard />);
    expect(await screen.findByText('Belum bisa ditugaskan')).toBeDefined();
    expect(screen.queryByRole('combobox', { name: /Sales — Budi/ })).toBeNull();
  });

  it('menugaskan ke sales lalu memuat ulang papan', async () => {
    api.fetchProspects.mockResolvedValue({
      kind: 'ok',
      value: { funnel: FUNNEL, items: [prospect({})] },
    });
    api.assignProspect.mockResolvedValue(null);
    render(<ProspectDashboard />);
    const select = await screen.findByRole('combobox', { name: /Sales — Budi/ });
    fireEvent.change(select, { target: { value: '01JSALES0000000000000000001' } });
    await waitFor(() =>
      expect(api.assignProspect).toHaveBeenCalledWith(
        '01JPROSPECT000000000000001',
        '01JSALES0000000000000000001',
      ),
    );
  });

  it('akun tanpa akses diarahkan masuk, bukan papan kosong', async () => {
    api.fetchProspects.mockResolvedValue({ kind: 'forbidden' });
    render(<ProspectDashboard />);
    expect(await screen.findByText(/untuk tim Pralon/)).toBeDefined();
  });
});
