import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
  type WithCorrelationId,
} from './correlation-id.middleware.js';

function run(incoming?: string | string[]): { id: string; headerSet: string | undefined } {
  const request = {
    headers: incoming === undefined ? {} : { [CORRELATION_ID_HEADER]: incoming },
  } as unknown as Request & WithCorrelationId;

  let headerSet: string | undefined;
  const response = {
    setHeader: (_name: string, value: string) => {
      headerSet = value;
    },
  } as unknown as Response;

  let called = false;
  new CorrelationIdMiddleware().use(request, response, () => {
    called = true;
  });

  if (!called) throw new Error('middleware tidak memanggil next()');
  return { id: request.correlationId ?? '', headerSet };
}

describe('CorrelationIdMiddleware', () => {
  it('memakai ulang correlation id dari klien dan mengembalikannya', () => {
    const { id, headerSet } = run('01JBXYZ1234567890ABCDEF');

    expect(id).toBe('01JBXYZ1234567890ABCDEF');
    expect(headerSet).toBe('01JBXYZ1234567890ABCDEF');
  });

  it('membangkitkan id baru saat klien tidak mengirimkannya', () => {
    const { id, headerSet } = run();

    expect(id).toHaveLength(26);
    expect(headerSet).toBe(id);
  });

  it('mengganti nilai yang memuat baris baru — log palsu disuntikkan lewat celah itu', () => {
    const { id } = run('abcdefgh\nERROR fake log line');

    expect(id).not.toContain('\n');
    expect(id).toHaveLength(26);
  });

  it('mengganti nilai yang terlalu panjang', () => {
    const { id } = run('a'.repeat(200));

    expect(id).toHaveLength(26);
  });

  it('mengganti nilai yang terlalu pendek untuk berguna', () => {
    const { id } = run('ab');

    expect(id).toHaveLength(26);
  });

  it('mengambil nilai pertama saat header dikirim berulang', () => {
    const { id } = run(['abcdefgh1234', 'xyz']);

    expect(id).toBe('abcdefgh1234');
  });
});
