/** P17-08: "Coba ubah" — tombol bergambar, tabel Sekarang ↔ skenario, perubahan ditandai. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScenarioComparison } from '@snouty/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../auth/session';
import { ScenarioCard } from './scenario-card';

const BASE = {
  outletCount: 11,
  mainSize: '1"',
  velocityMs: 1.49,
  branches: [
    { size: '1"', count: 1 },
    { size: '3/4"', count: 1 },
    { size: '1/2"', count: 2 },
  ],
  boosterPumpNeeded: true,
  residualBar: 0.02,
  tankFill: { netM: 23, size: '3/4"' },
};
const COMPARISON: ScenarioComparison = {
  base: BASE,
  raisedByM: 3.5,
  scenarios: [
    {
      id: 'tank_raised',
      metrics: {
        ...BASE,
        boosterPumpNeeded: false,
        residualBar: 0.33,
        tankFill: { netM: 26.5, size: '3/4"' },
      },
    },
    { id: 'add_bathroom', metrics: { ...BASE, outletCount: 13 } },
  ],
};

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe('ScenarioCard', () => {
  it('tombol per skenario; memilih satu menampilkan perbandingan dengan perubahan ditandai', async () => {
    setAccessToken('token-akun');
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(COMPARISON), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ScenarioCard recommendationId="01JBREC0000000000000000000" />);
    const button = await screen.findByText('Toren dinaikkan 3,5 m');
    expect(screen.getByText('Tambah 1 kamar mandi')).toBeTruthy();
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-akun');

    fireEvent.click(button);
    const rows = [...document.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );
    expect(rows).toContainEqual(['Pompa pendorong', 'Perlu', 'Tidak perlu']);
    expect(rows).toContainEqual(['Tekanan di titik tertinggi', '0,02 bar', '0,33 bar']);
    expect(rows).toContainEqual(['Titik air', '11', '11']);
    const changed = document.querySelectorAll('td[class*="scenarioChanged"]');
    expect(changed).toHaveLength(3);
  });

  it('skenario tidak tersedia (kasus teknis): kartu tidak tampil', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response('{"error":{"code":"NOT_FOUND"}}', { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<ScenarioCard recommendationId="01JBREC0000000000000000000" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
