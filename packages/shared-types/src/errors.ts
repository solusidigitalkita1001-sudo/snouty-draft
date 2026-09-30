/**
 * Kode error stabil yang bisa dirender klien. docs/API_CONTRACTS.md §4.
 *
 * Perhatikan pemisahannya: keputusan kebijakan BUKAN error. Menolak
 * membandingkan merek adalah jawaban yang benar (HTTP 200 + kartu), bukan
 * kegagalan sistem — dan mood mascot-nya pun berbeda.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'NOT_ENTITLED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'LLM_UNAVAILABLE'
  | 'CATALOG_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'REPORT_GENERATION_FAILED'
  | 'UPLOAD_REJECTED';

/** Keputusan kebijakan — dikembalikan sebagai jawaban, bukan sebagai kegagalan. */
export type PolicyCode =
  | 'COMPETITOR_COMPARISON_REFUSED'
  | 'INSUFFICIENT_DATA'
  | 'TECHNICAL_VALIDATION_REQUIRED'
  | 'SCOPE_NOT_YET_SUPPORTED';

export interface ApiErrorBody {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly correlationId: string;
  };
}
