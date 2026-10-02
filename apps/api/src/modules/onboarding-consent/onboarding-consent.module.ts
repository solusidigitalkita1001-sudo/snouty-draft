import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { ConsentService } from './application/consent.service.js';
import {
  ONBOARDING_STATE_REPOSITORY,
  OnboardingService,
  type OnboardingStateRepository,
} from './application/onboarding.service.js';
import { CONSENT_REPOSITORY, type ConsentRepository } from './domain/consent.repository.js';
import { consentRepositoryProvider } from './infrastructure/mysql-consent.repository.js';
import { onboardingStateRepositoryProvider } from './infrastructure/mysql-onboarding-state.repository.js';

const onboardingServiceProvider = {
  provide: OnboardingService,
  inject: [ONBOARDING_STATE_REPOSITORY],
  useFactory: (repository: OnboardingStateRepository) => new OnboardingService(repository),
};

const consentServiceProvider = {
  provide: ConsentService,
  inject: [CONSENT_REPOSITORY],
  useFactory: (repository: ConsentRepository) =>
    new ConsentService(repository, loadEnv().POLICY_VERSION),
};

/**
 * Konteks identity, modul `onboarding-consent` (docs/ARCHITECTURE.md §6).
 *
 * Endpoint-nya menyusul di P3-11.
 */
@Module({
  providers: [
    consentRepositoryProvider,
    consentServiceProvider,
    onboardingStateRepositoryProvider,
    onboardingServiceProvider,
  ],
  exports: [consentServiceProvider, onboardingServiceProvider],
})
export class OnboardingConsentModule {}
