/**
 * Port penyimpanan consent. docs/PRIVACY.md §3 · SPEC §30b.
 *
 * Tidak ada method `delete`, dan tidak akan ada: baris consent adalah bukti
 * kepatuhan. Mencabut berarti mengisi `revokedAt`; memberi lagi setelah mencabut
 * berarti baris BARU. Riwayatnya yang menjadi jawabannya ketika seseorang bertanya
 * "disetujui kapan, atas dasar versi apa".
 */

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');

export type ConsentKind = 'LOCATION' | 'ANALYTICS_STORAGE';

export interface ConsentSubject {
  readonly kind: 'user' | 'guest';
  readonly id: string;
}

export interface ConsentRow {
  readonly id: string;
  readonly subject: ConsentSubject;
  readonly kind: ConsentKind;
  readonly granted: boolean;
  readonly policyVersion: string;
  readonly grantedAt: Date;
  readonly revokedAt: Date | null;
}

export interface NewConsent {
  readonly id: string;
  readonly subject: ConsentSubject;
  readonly kind: ConsentKind;
  readonly granted: boolean;
  readonly policyVersion: string;
}

export interface ConsentRepository {
  append(consent: NewConsent): Promise<void>;
  /** Baris TERBARU per jenis untuk satu subjek — keadaan sekarang. */
  findLatest(subject: ConsentSubject, kind: ConsentKind): Promise<ConsentRow | null>;
  findAllLatest(subject: ConsentSubject): Promise<readonly ConsentRow[]>;
  /** Mengisi `revokedAt`; barisnya tidak pernah dihapus. */
  markRevoked(id: string): Promise<void>;
}
