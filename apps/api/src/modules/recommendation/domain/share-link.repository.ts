/**
 * Port tautan bagikan baca-saja (P24-03, pemilik 2026-10-19). Token tidak pernah disimpan —
 * hanya SHA-256-nya — sehingga kebocoran tabel tidak membuka satu pun solusi.
 */

export const SHARE_LINK_REPOSITORY = Symbol('SHARE_LINK_REPOSITORY');

export interface ShareLinkRow {
  readonly id: string;
  readonly recommendationId: string;
  readonly conversationId: string;
  readonly ownerId: string;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export interface ShareLinkRepository {
  /** Mencabut tautan aktif rekomendasi ini lalu membuat yang baru — satu tautan aktif per solusi. */
  replace(row: {
    id: string;
    tokenHash: string;
    recommendationId: string;
    conversationId: string;
    ownerId: string;
  }): Promise<void>;
  findActiveByHash(tokenHash: string): Promise<ShareLinkRow | null>;
  activeFor(recommendationId: string): Promise<ShareLinkRow | null>;
  revokeFor(recommendationId: string): Promise<void>;
}
