/**
 * Satu bentuk galat untuk seluruh API (docs/API_CONTRACTS.md §1, §4).
 *
 * Dua janji dipegang di satu tempat ini, karena keduanya jenis janji yang bocor
 * begitu setiap controller mengurusnya sendiri:
 *
 *   - **Klien hanya menerima kode stabil dan pesan yang aman ditampilkan.**
 *     Stack trace, pesan driver, dan nama tabel tidak pernah keluar
 *     (docs/SECURITY.md §11).
 *   - **Setiap respons galat membawa `correlationId`**, sehingga keluhan pengguna
 *     bisa ditelusuri ke satu permintaan tanpa menebak.
 */
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody, ErrorCode } from '@snouty/shared-types';
import { correlationIdOf, type WithCorrelationId } from './correlation-id.middleware.js';

/** Status HTTP dan sifat retryable per kode — tabel docs/API_CONTRACTS.md §4. */
const ERROR_SHAPE: Readonly<Record<ErrorCode, { status: number; retryable: boolean }>> = {
  VALIDATION_FAILED: { status: 400, retryable: false },
  UNAUTHENTICATED: { status: 401, retryable: false },
  NOT_ENTITLED: { status: 403, retryable: false },
  NOT_FOUND: { status: 404, retryable: false },
  RATE_LIMITED: { status: 429, retryable: true },
  LLM_UNAVAILABLE: { status: 503, retryable: true },
  CATALOG_UNAVAILABLE: { status: 503, retryable: true },
  SERVICE_UNAVAILABLE: { status: 503, retryable: true },
  REPORT_GENERATION_FAILED: { status: 500, retryable: true },
  UPLOAD_REJECTED: { status: 400, retryable: false },
};

/** Pesan baku Bahasa Indonesia, aman ditampilkan apa adanya — docs/API_CONTRACTS.md §4. */
const DEFAULT_MESSAGE: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'Ada isian yang belum sesuai.',
  UNAUTHENTICATED: 'Silakan masuk terlebih dahulu.',
  NOT_ENTITLED: 'Fitur ini tersedia untuk pengguna terdaftar.',
  NOT_FOUND: 'Data tidak ditemukan.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Coba lagi sebentar.',
  LLM_UNAVAILABLE: 'Layanan sedang sibuk. Coba lagi.',
  CATALOG_UNAVAILABLE:
    'Koneksi ke katalog Pralon terputus. Kebutuhan Anda tetap tersimpan, jadi tidak perlu mengetik ulang.',
  SERVICE_UNAVAILABLE: 'Layanan sedang tidak tersedia.',
  REPORT_GENERATION_FAILED: 'Laporan gagal diunduh.',
  UPLOAD_REJECTED: 'Berkas tidak dapat diterima.',
};

/**
 * Galat domain yang tahu kode API-nya sendiri.
 *
 * Diperiksa dengan duck typing, bukan `instanceof`, supaya galat domain tidak
 * perlu mewarisi kelas dari `shared` — itu akan membalik arah dependensi yang
 * dijaga `docs/ARCHITECTURE.md` §7.
 */
export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

function isApiError(error: unknown): error is ApiError {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code in ERROR_SHAPE;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & WithCorrelationId>();
    const response = http.getResponse<Response>();
    const correlationId = correlationIdOf(request);

    const { code, message, details } = this.classify(error);
    const shape = ERROR_SHAPE[code];

    const body: ApiErrorBody = {
      error: {
        code,
        message,
        retryable: shape.retryable,
        ...(details !== undefined ? { details } : {}),
        correlationId,
      },
    };

    response.status(shape.status).json(body);
  }

  private classify(error: unknown): {
    code: ErrorCode;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  } {
    if (isApiError(error)) {
      return {
        code: error.code,
        // Pesan galat domain ditulis untuk pengguna, jadi boleh tampil apa adanya.
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      };
    }

    if (error instanceof HttpException) {
      const code = error.getStatus() === 404 ? 'NOT_FOUND' : 'VALIDATION_FAILED';
      return { code, message: DEFAULT_MESSAGE[code] };
    }

    // Apa pun yang tidak dikenali tidak pernah ikut keluar. Ia dicatat di server
    // (logger menyusul bersama Pino request-scoped) dan klien hanya menerima
    // pesan baku: galat tak terduga adalah tempat paling umum bocornya nama tabel.
    return { code: 'SERVICE_UNAVAILABLE', message: DEFAULT_MESSAGE.SERVICE_UNAVAILABLE };
  }
}
