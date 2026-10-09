/**
 * Mode jawaban (catatan pemilik 2026-10-09 "mode hemat / high quality") ikut terkirim bersama pesan.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from './chat-api';

afterEach(() => vi.unstubAllGlobals());

describe('sendMessage — mode jawaban', () => {
  it('mengirim mode yang dipilih; tanpa pilihan → hemat', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendMessage('C'.repeat(26), 'pipa vp itu apa?', () => undefined, undefined, 'kualitas');
    await sendMessage('C'.repeat(26), 'pipa vp itu apa?', () => undefined);
    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse(String((c as unknown as [string, RequestInit])[1].body)),
    );
    expect(bodies[0]).toEqual({ text: 'pipa vp itu apa?', mode: 'kualitas' });
    expect(bodies[1]).toEqual({ text: 'pipa vp itu apa?', mode: 'hemat' });
  });
});
