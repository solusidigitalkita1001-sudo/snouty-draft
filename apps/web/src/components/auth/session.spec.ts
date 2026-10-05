/**
 * Pemulihan sesi hanya dicoba bila browser ini pernah masuk. Tamu tidak pernah punya
 * cookie refresh, jadi `/auth/refresh` untuknya hanya 401 di console — dan itu yang
 * dilaporkan pemilik sebagai "belum clear".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSessionHint, restoreSession, setAccessToken } from './session';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  localStorage.clear();
  setAccessToken(null);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('restoreSession', () => {
  it('tamu (tanpa penanda) tidak memanggil /auth/refresh sama sekali', async () => {
    expect(await restoreSession()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('setelah masuk, penanda ada dan refresh dicoba', async () => {
    setAccessToken('tok');
    expect(hasSessionHint()).toBe(true);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'baru' }), { status: 200 }),
    );

    expect(await restoreSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/refresh', expect.anything());
  });

  it('401 saat refresh menghapus penanda — muat berikutnya tidak menembak lagi', async () => {
    setAccessToken('tok');
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    expect(await restoreSession()).toBe(false);
    expect(hasSessionHint()).toBe(false);
    fetchMock.mockClear();
    expect(await restoreSession()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('penanda bukan kredensial: token sendiri tidak pernah masuk localStorage', () => {
    setAccessToken('rahasia');
    expect(JSON.stringify(localStorage)).not.toContain('rahasia');
  });
});
