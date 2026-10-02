/**
 * Port penyimpanan sesi tamu. docs/DOMAIN_MODEL.md §3.
 */

export const GUEST_SESSION_REPOSITORY = Symbol('GUEST_SESSION_REPOSITORY');

export interface GuestSessionRow {
  readonly id: string;
  readonly linkedUserId: string | null;
  readonly expiresAt: Date;
}

export interface GuestSessionRepository {
  create(session: { id: string; expiresAt: Date }): Promise<void>;
  findById(id: string): Promise<GuestSessionRow | null>;
  /** Memperbarui `last_seen_at` dan menggeser kedaluwarsa — sesi yang dipakai tetap hidup. */
  touch(id: string, expiresAt: Date): Promise<void>;
}
