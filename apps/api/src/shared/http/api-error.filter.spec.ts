/**
 * Bentuk galat tunggal, dan janji yang menyertainya: tidak ada stack trace, tidak
 * ada pesan driver, dan selalu ada `correlationId`.
 */
import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { ApiErrorBody } from '@snouty/shared-types';
import { ApiErrorFilter } from './api-error.filter.js';

const CORRELATION_ID = '01JBXYZ1234567890ABCDEF';

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
      getRequest: () => ({ correlationId: CORRELATION_ID }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new ApiErrorFilter().catch(error, host);
  if (body === undefined) throw new Error('filter tidak menulis respons');
  return { status, body };
}

class CatalogDown extends Error {
  readonly code = 'CATALOG_UNAVAILABLE' as const;
  constructor() {
    super('Koneksi ke katalog Pralon terputus.');
  }
}

class NotEntitled extends Error {
  readonly code = 'NOT_ENTITLED' as const;
  readonly details = { capability: 'MATERIAL_BOM' };
  constructor() {
    super('Fitur ini tersedia untuk pengguna terdaftar.');
  }
}

describe('ApiErrorFilter — galat domain', () => {
  it('memakai kode, status, dan sifat retryable dari tabel kontrak', () => {
    const { status, body } = render(new CatalogDown());

    expect(status).toBe(503);
    expect(body.error.code).toBe('CATALOG_UNAVAILABLE');
    expect(body.error.retryable).toBe(true);
  });

  it('selalu menyertakan correlationId', () => {
    const { body } = render(new CatalogDown());

    expect(body.error.correlationId).toBe(CORRELATION_ID);
  });

  it('meneruskan details bila galatnya membawanya', () => {
    const { status, body } = render(new NotEntitled());

    expect(status).toBe(403);
    expect(body.error.details).toEqual({ capability: 'MATERIAL_BOM' });
  });

  it('tidak menyertakan details saat galatnya tidak punya', () => {
    const { body } = render(new CatalogDown());

    expect(body.error).not.toHaveProperty('details');
  });
});

describe('ApiErrorFilter — galat yang tidak dikenali', () => {
  it('tidak pernah membocorkan pesan aslinya', () => {
    const { status, body } = render(new Error("Unknown column 'secret_token' in 'field list'"));

    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('secret_token');
  });

  it('tidak pernah membocorkan stack trace', () => {
    const { body } = render(new Error('boom'));

    expect(JSON.stringify(body)).not.toContain('api-error.filter');
    expect(body.error).not.toHaveProperty('stack');
  });

  it('memetakan 404 dari framework menjadi NOT_FOUND, bukan kegagalan layanan', () => {
    // Rute yang tidak ada adalah permintaan yang salah, bukan sistem yang rusak.
    const { status, body } = render(new HttpException('Not Found', 404));

    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('memakai pesan baku Bahasa Indonesia yang aman ditampilkan', () => {
    const { body } = render(new Error('ECONNREFUSED 127.0.0.1:3306'));

    expect(body.error.message).toBe('Layanan sedang tidak tersedia.');
  });
});
