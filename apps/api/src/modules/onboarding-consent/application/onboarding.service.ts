/**
 * Keadaan onboarding — dari server, bukan `localStorage` (OQ-19, SPEC §33e).
 *
 * `pending` dinyatakan oleh KETIADAAN baris: subjek baru belum pernah menyentuh
 * onboarding, dan tidak ada yang perlu ditulis untuk mengatakan itu. Menulis baris
 * `pending` untuk setiap tamu berarti satu INSERT per pengunjung demi informasi
 * yang sudah terkandung dalam ketiadaannya.
 *
 * Completion di-upsert, bukan di-append: berbeda dari consent, riwayat "kapan
 * modal onboarding ditutup" bukan bukti apa pun. "Never auto-open again" (SPEC
 * §33e) cukup dijawab oleh satu baris terkini.
 */

import type { ConsentSubject } from '../domain/consent.repository.js';

export const ONBOARDING_STATE_REPOSITORY = Symbol('ONBOARDING_STATE_REPOSITORY');

export type OnboardingOutcome = 'done' | 'guest' | 'skip';
export type OnboardingState = OnboardingOutcome | 'pending';

export interface OnboardingStateRepository {
  find(subject: ConsentSubject): Promise<OnboardingOutcome | null>;
  upsert(subject: ConsentSubject, state: OnboardingOutcome): Promise<void>;
}

export class OnboardingService {
  constructor(private readonly repository: OnboardingStateRepository) {}

  async state(subject: ConsentSubject): Promise<OnboardingState> {
    return (await this.repository.find(subject)) ?? 'pending';
  }

  async complete(subject: ConsentSubject, outcome: OnboardingOutcome): Promise<void> {
    await this.repository.upsert(subject, outcome);
  }
}
