/**
 * Tab Skema (laporan pemilik 2026-10-08): pengguna yang sudah masuk selalu melihat "Skema belum
 * tersedia" karena permintaan skema tidak membawa access token. Tautan "Lihat skema instalasi"
 * juga tampil tanpa skema di baliknya — tautan tanpa layar dilarang aturan teks proyek.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../auth/session';
import { SchematicTab } from './schematic-tab';

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe('SchematicTab', () => {
  it('permintaan skema membawa access token akun', async () => {
    setAccessToken('token-akun');
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 404 })));
    vi.stubGlobal('fetch', fetchMock);
    render(<SchematicTab recommendationId="01JBREC0000000000000000000" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-akun');
  });

  it('tanpa skema: pesan belum tersedia, tanpa tautan ke halaman skema', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<SchematicTab recommendationId="01JBREC0000000000000000000" available={false} />);
    expect(screen.getByText('Skema belum tersedia untuk konsultasi ini.')).toBeTruthy();
    expect(screen.queryByText(/Lihat skema instalasi/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
