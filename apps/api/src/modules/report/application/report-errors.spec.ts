/**
 * Laporan yang tidak ada adalah permintaan yang salah, bukan sistem yang rusak.
 *
 * Tanpa kode `NOT_FOUND`, `ApiErrorFilter` memperlakukan galat ini sebagai tak dikenal
 * dan menjawab 503 `retryable` — worker PDF lalu mengulang job untuk laporan yang memang
 * tidak ada sampai masuk DLQ.
 */
import { describe, expect, it } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import type { ApiErrorBody } from '@snouty/shared-types';
import { ApiErrorFilter } from '../../../shared/http/api-error.filter.js';
import { ReportNotFoundError } from './report.service.js';

function render(error: unknown): { status: number; body: ApiErrorBody } {
  let status = 0;
  let body: ApiErrorBody | undefined;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: ApiErrorBody) {
      body = payload;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ correlationId: '01JBXYZ1234567890ABCDEF' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new ApiErrorFilter().catch(error, host);
  if (body === undefined) throw new Error('filter tidak menulis respons');
  return { status, body };
}

describe('ReportNotFoundError', () => {
  it('dijawab 404 NOT_FOUND yang tidak retryable, bukan 503', () => {
    const { status, body } = render(new ReportNotFoundError());

    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.retryable).toBe(false);
  });
});
