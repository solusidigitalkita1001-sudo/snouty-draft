/**
 * Correlation ID — diterima atau dibangkitkan, dan **selalu** dikembalikan
 * (docs/API_CONTRACTS.md §1).
 *
 * Dipasang sekarang, bukan nanti, karena menambahkannya belakangan menyentuh
 * setiap jalur kode: setiap log, setiap respons galat, setiap pesan antrean
 * (docs/ARCHITECTURE.md §9). Satu endpoint adalah waktu termurah untuk itu.
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ulid } from '../ulid.js';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Batas panjang dan daftar karakter yang diterima.
 *
 * Nilai ini datang dari klien dan berakhir di log serta di tabel audit, jadi ia
 * tidak dipercaya apa adanya: header 8 KB berisi baris baru adalah cara klasik
 * menyuntikkan baris palsu ke dalam log. Nilai yang tidak lolos tidak ditolak,
 * hanya diganti — permintaannya sendiri tidak salah apa-apa.
 */
const ACCEPTABLE = /^[A-Za-z0-9_-]{8,64}$/;

/** Tempat correlation id disimpan pada request, dibaca exception filter dan logger. */
export interface WithCorrelationId {
  correlationId?: string;
}

export function correlationIdOf(request: WithCorrelationId): string {
  return request.correlationId ?? 'unknown';
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request & WithCorrelationId, response: Response, next: NextFunction): void {
    const incoming = request.headers[CORRELATION_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;

    const correlationId =
      candidate !== undefined && ACCEPTABLE.test(candidate) ? candidate : ulid();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
