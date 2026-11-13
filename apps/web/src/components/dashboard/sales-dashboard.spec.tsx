/**
 * Dashboard sales (P26-06): ringkasan menampilkan data terstruktur apa adanya, kalah wajib beralasan
 * sebelum dikirim, dan nomor WhatsApp Indonesia dinormalkan untuk tautan.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeadDetail, ProspectItem } from './dashboard-api';

const api = vi.hoisted(() => ({
  fetchMyLeads: vi.fn(),
  fetchLead: vi.fn(),
  setLeadStatus: vi.fn(),
  refreshLeadContext: vi.fn(),
  fetchTranscript: vi.fn(),
  fetchLeadActivity: vi.fn(async () => ({ kind: 'ok', value: { items: [] } })),
  addLeadNote: vi.fn(async () => null),
  setLeadFollowUp: vi.fn(async () => null),
}));
vi.mock('./dashboard-api', () => api);
vi.mock('../auth/session', () => ({
  restoreSession: vi.fn(async () => true),
  getCurrentUser: () => ({ name: 'Sari', tier: 'registered', roles: ['sales'] }),
  canOpenDashboard: () => false,
}));

const { SalesDashboard, whatsappNumber } = await import('./sales-dashboard');

const ITEM: ProspectItem = {
  userId: '01JPROSPECT000000000000001',
  name: 'Budi',
  email: 'budi@example.test',
  phone: '0812 3456 7890',
  registeredAt: '2026-10-01T00:00:00Z',
  stage: 'act',
  stageReachedAt: '2026-10-20T00:00:00Z',
  lastActivityAt: '2026-10-20T00:00:00Z',
  scale: 'house',
  score: 6,
  priority: 'warm',
  salesContactConsent: true,
  salesRequestedAt: null,
  contactable: true,
  conversationCount: 1,
  lead: {
    salesUserId: '01JSALES0000000000000000001',
    salesName: 'Sari',
    status: 'new',
    assignedAt: '2026-10-20T00:00:00Z',
  },
};

const DETAIL: LeadDetail = {
  status: 'new',
  lostReason: null,
  followUpAt: null,
  assignedAt: '2026-10-20T00:00:00Z',
  context: { text: 'Pelanggan membangun rumah 2 lantai.', generatedAt: '2026-10-20T00:00:00Z' },
  prospect: ITEM,
  facts: {
    projects: [
      {
        conversationId: '01JCONV00000000000000000001',
        title: 'Rumah 2 lantai',
        updatedAt: '2026-10-20T00:00:00Z',
        buildingType: 'residential',
        floors: 2,
        bathrooms: 3,
        waterSource: 'rooftop_tank',
        caseId: null,
        headline: 'Sistem distribusi untuk 9 titik air',
        mainSize: '1"',
        products: [{ name: 'Pipa AW 1" x 4 Meter', family: 'PVC AW', size: '1"' }],
      },
    ],
    reports: 1,
    shares: 0,
    salesRequest: null,
    quotes: [{ text: 'harga pipa 1 inch?', at: '2026-10-20T00:00:00Z' }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchMyLeads.mockResolvedValue({ kind: 'ok', value: { items: [ITEM] } });
  api.fetchLead.mockResolvedValue({ kind: 'ok', value: DETAIL });
});

describe('dashboard sales (P26-06)', () => {
  it('ringkasan: data terstruktur, paragraf konteks, dan kalimat pelanggan', async () => {
    render(<SalesDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: /Budi/ }));
    expect(await screen.findByText('Pelanggan membangun rumah 2 lantai.')).toBeDefined();
    expect(screen.getByText('Rumah tinggal')).toBeDefined();
    expect(screen.getByText('Toren atap')).toBeDefined();
    expect(screen.getByText('Sistem distribusi untuk 9 titik air')).toBeDefined();
    expect(screen.getByText('“harga pipa 1 inch?”')).toBeDefined();
    expect(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')).toBe(
      'https://wa.me/6281234567890',
    );
  });

  it('kalah tanpa alasan tidak dikirim', async () => {
    render(<SalesDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: /Budi/ }));
    const status = await screen.findByLabelText('Status');
    fireEvent.change(status, { target: { value: 'lost' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan status' }));
    expect(await screen.findByText('Tulis alasan kalahnya.')).toBeDefined();
    expect(api.setLeadStatus).not.toHaveBeenCalled();

    api.setLeadStatus.mockResolvedValue(null);
    fireEvent.change(screen.getByLabelText('Alasan kalah'), { target: { value: 'beli di toko' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan status' }));
    await waitFor(() =>
      expect(api.setLeadStatus).toHaveBeenCalledWith(ITEM.userId, 'lost', 'beli di toko'),
    );
  });

  it('tanpa prospek: tidak ada panel yang menunggu dipilih (P31-78)', async () => {
    api.fetchMyLeads.mockResolvedValue({ kind: 'ok', value: { items: [] } });
    render(<SalesDashboard />);
    expect(await screen.findByText(/Belum ada prospek yang ditugaskan/)).toBeDefined();
    expect(screen.queryByText(/Pilih prospek untuk melihat/)).toBeNull();
  });

  /**
   * Daftarnya urut prioritas, jadi kalimat "pilih prospek" di sebelah prospek yang sudah ada hanya
   * satu klik yang jawabannya sudah pasti (P38).
   */
  it('prospek teratas terbuka sendiri', async () => {
    render(<SalesDashboard />);
    expect(await screen.findByText('Pelanggan membangun rumah 2 lantai.')).toBeDefined();
    expect(screen.queryByText(/Pilih prospek untuk melihat/)).toBeNull();
  });

  it('konsultasi lama terlipat dengan tanggalnya, dan rinciannya tetap bisa dibuka', async () => {
    api.fetchLead.mockResolvedValue({
      kind: 'ok',
      value: {
        ...DETAIL,
        facts: {
          ...DETAIL.facts,
          projects: [
            DETAIL.facts.projects[0]!,
            {
              ...DETAIL.facts.projects[0]!,
              conversationId: '01JCONV00000000000000000002',
              updatedAt: '2026-09-02T00:00:00Z',
              headline: 'Sistem distribusi untuk 4 titik air',
            },
          ],
        },
      },
    });

    render(<SalesDashboard />);
    // Yang terbaru tergelar; yang lama baru judul dan tanggalnya.
    expect(await screen.findByText('Sistem distribusi untuk 9 titik air')).toBeDefined();
    expect(screen.queryByText('Sistem distribusi untuk 4 titik air')).toBeNull();
    expect(screen.getByText('2 Sep 2026')).toBeDefined();
    expect(screen.getByText('20 Okt 2026')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Lihat rinciannya' }));
    expect(await screen.findByText('Sistem distribusi untuk 4 titik air')).toBeDefined();
  });

  /**
   * Admin membuka ringkasan dari papan prospek lewat `?u=`. Daftar "prospek saya" miliknya memang
   * kosong — dan dulu layarnya menjawab "belum ada prospek yang ditugaskan ke Anda", bukan
   * ringkasan yang baru saja diklik (P38).
   */
  it('ringkasan yang dibuka dari papan tetap tampil walau daftar sendiri kosong', async () => {
    api.fetchMyLeads.mockResolvedValue({ kind: 'ok', value: { items: [] } });
    window.history.replaceState({}, '', '/internal/leads?u=01JQRSTVWX0000000000000001');

    render(<SalesDashboard />);

    expect(await screen.findByText('Pelanggan membangun rumah 2 lantai.')).toBeDefined();
    expect(screen.queryByText(/Belum ada prospek yang ditugaskan/)).toBeNull();
    window.history.replaceState({}, '', '/internal/leads');
  });

  it('nomor WhatsApp Indonesia dinormalkan', () => {
    expect(whatsappNumber('0812-3456-7890')).toBe('6281234567890');
    expect(whatsappNumber('+62 812 3456 7890')).toBe('6281234567890');
    expect(whatsappNumber('12345')).toBeNull();
  });
});
