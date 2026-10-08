import { createHmac } from 'node:crypto';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { handoffDeliverConsumer } from './handoff-deliver.js';

const JOB = {
  contractVersion: 1 as const,
  correlationId: 'c',
  handoffId: '01JBHANDOFF000000000000000',
};
const CTX = { correlationId: 'c', attempt: 1 };
const MESSAGE = {
  handoffId: JOB.handoffId,
  conversationId: '01JBC0NV0000000000000000AB',
  subject: '[SNOUTY] Kasus',
  text: 'isi',
};
const log = pino({ level: 'silent' });

function deps(fetchImpl: typeof fetch, over: object = {}) {
  return {
    apiBaseUrl: 'http://api:3001',
    internalToken: 'worker-token',
    webhookUrl: 'https://n8n.example/webhook/handoff',
    webhookSecret: 'rahasia',
    target: 'teknis@pralon.test',
    log,
    fetch: fetchImpl,
    nowSeconds: () => 1_791_000_000,
    ...over,
  };
}

describe('handoffDeliverConsumer (P10-06)', () => {
  it('mengambil isi dari API lalu mengirimnya bertanda tangan ke n8n', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(MESSAGE), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    await handoffDeliverConsumer(deps(fetchMock))(JOB, CTX);

    const [apiUrl, apiInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe(`http://api:3001/api/v1/internal/handoff-messages/${JOB.handoffId}`);
    expect(apiInit.headers).toEqual({ authorization: 'Bearer worker-token' });

    const [hookUrl, hookInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(hookUrl).toBe('https://n8n.example/webhook/handoff');
    const body = hookInit.body as string;
    expect(JSON.parse(body)).toEqual({ to: 'teknis@pralon.test', ...MESSAGE });
    const headers = hookInit.headers as Record<string, string>;
    expect(headers['x-snouty-timestamp']).toBe('1791000000');
    expect(headers['x-snouty-signature']).toBe(
      createHmac('sha256', 'rahasia').update(`1791000000.${body}`).digest('hex'),
    );
  });

  it('belum dikonfigurasi: tidak memanggil apa pun dan tidak melempar', async () => {
    const fetchMock = vi.fn();
    await handoffDeliverConsumer(deps(fetchMock, { webhookUrl: undefined }))(JOB, CTX);
    await handoffDeliverConsumer(deps(fetchMock, { target: '' }))(JOB, CTX);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('n8n menolak → melempar supaya transport mencoba lagi', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(MESSAGE), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(handoffDeliverConsumer(deps(fetchMock))(JOB, CTX)).rejects.toThrow('n8n 500');
  });
});
