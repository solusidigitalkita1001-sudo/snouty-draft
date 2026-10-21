/**
 * Permintaan "minta dihubungi tim Pralon" (P26-04, docs/PROSPECT_5A.md §4). Sinyal tahap Act dan dasar
 * sah bagi sales untuk menghubungi pengguna yang tidak memberi opt-in umum (OQ-76).
 */
export type SalesRequestSource = 'solution' | 'price';

export interface SalesRequestRow {
  readonly id: string;
  readonly userId: string;
  readonly conversationId: string | null;
  readonly source: SalesRequestSource;
  readonly createdAt: Date;
}

export interface SalesRequestRepository {
  create(row: Omit<SalesRequestRow, 'createdAt'>): Promise<void>;
  /** Permintaan terakhir pengguna untuk percakapan ini sejak `since` — tombol yang ditekan dua kali. */
  latestSince(userId: string, conversationId: string, since: Date): Promise<SalesRequestRow | null>;
  findById(id: string): Promise<SalesRequestRow | null>;
}

export const SALES_REQUEST_REPOSITORY = Symbol('SALES_REQUEST_REPOSITORY');
