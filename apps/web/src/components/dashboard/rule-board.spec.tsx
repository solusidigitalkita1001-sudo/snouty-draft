/**
 * Validasi aturan teknik (P31-82): layar ini harus benar-benar menampilkan aturannya, bukan
 * satu paragraf tentang menunggu — dan menolak tanpa alasan tidak boleh lewat.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuleBoard } from './dashboard-api';

const api = vi.hoisted(() => ({
  fetchRuleBoard: vi.fn(),
  decideRule: vi.fn(),
  withdrawRuleDecision: vi.fn(),
}));
vi.mock('./dashboard-api', () => api);

const { RuleBoardPanel } = await import('./rule-board');

const BOARD: RuleBoard = {
  priority: [
    {
      ruleId: 'ENG-601',
      version: 2,
      category: 'load_sizing',
      standard: 'UPC Table 702.1',
      status: 'REQUIRES_DOMAIN_VALIDATION',
      why: 'Beban alat pembuangan. Baris urinoir belum terbaca.',
      examples: [
        {
          name: 'rumah 2 lantai',
          input: {},
          output: {},
          explanation: 'Beban air kotor 12 = 4 kloset × 3.',
        },
      ],
      decision: null,
    },
  ],
  rest: [
    {
      ruleId: 'ENG-404',
      version: 1,
      category: 'geometry',
      standard: null,
      status: 'REQUIRES_DOMAIN_VALIDATION',
      why: null,
      examples: [],
      decision: null,
    },
  ],
  signedOff: 0,
  total: 2,
};

beforeEach(() => {
  api.fetchRuleBoard.mockReset().mockResolvedValue({ kind: 'ok', value: BOARD });
  api.decideRule.mockReset().mockResolvedValue(null);
  api.withdrawRuleDecision.mockReset().mockResolvedValue(null);
});

describe('validasi aturan teknik', () => {
  it('menampilkan aturan dan sumbernya, bukan paragraf tentang menunggu', async () => {
    render(<RuleBoardPanel />);

    expect(await screen.findByText('ENG-601')).toBeDefined();
    expect(screen.getByText('UPC Table 702.1')).toBeDefined();
    expect(screen.getByText(/Baris urinoir belum terbaca/)).toBeDefined();
  });

  it('mengatakan akibat dari belum ada tanda tangan', async () => {
    render(<RuleBoardPanel />);
    expect(await screen.findByText(/setiap angka yang dihitung SNOUTY tampil sebagai asumsi/)).toBeDefined();
  });

  it('membuka satu aturan menampilkan contoh kerjanya', async () => {
    render(<RuleBoardPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /ENG-601/ }));

    expect(await screen.findByText('Beban air kotor 12 = 4 kloset × 3.')).toBeDefined();
  });

  it('menyetujui mengirim versinya, bukan hanya nama aturannya', async () => {
    render(<RuleBoardPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /ENG-601/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Saya setujui' }));

    await waitFor(() =>
      expect(api.decideRule).toHaveBeenCalledWith('ENG-601', 2, 'approved', ''),
    );
  });

  it('menolak tanpa alasan ditolak, dan alasannya dikatakan', async () => {
    api.decideRule.mockResolvedValue('VALIDATION_FAILED');
    render(<RuleBoardPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /ENG-601/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tolak' }));

    expect(await screen.findByText(/Menolak sebuah aturan perlu alasan/)).toBeDefined();
  });

  it('aturan lainnya ada, tidak disembunyikan', async () => {
    render(<RuleBoardPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lihat 1 aturan lainnya' }));

    expect(await screen.findByText('ENG-404')).toBeDefined();
  });
});
