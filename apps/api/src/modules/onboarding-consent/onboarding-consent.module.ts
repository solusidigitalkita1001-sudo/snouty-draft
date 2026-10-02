import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { ConsentService } from './application/consent.service.js';
import { CONSENT_REPOSITORY, type ConsentRepository } from './domain/consent.repository.js';
import { consentRepositoryProvider } from './infrastructure/mysql-consent.repository.js';

const consentServiceProvider = {
  provide: ConsentService,
  inject: [CONSENT_REPOSITORY],
  useFactory: (repository: ConsentRepository) =>
    new ConsentService(repository, loadEnv().POLICY_VERSION),
};

/**
 * Konteks identity, modul `onboarding-consent` (docs/ARCHITECTURE.md §6).
 *
 * Onboarding state (P3-09) menyusul di modul ini juga; endpoint-nya di P3-11.
 */
@Module({
  providers: [consentRepositoryProvider, consentServiceProvider],
  exports: [consentServiceProvider],
})
export class OnboardingConsentModule {}
