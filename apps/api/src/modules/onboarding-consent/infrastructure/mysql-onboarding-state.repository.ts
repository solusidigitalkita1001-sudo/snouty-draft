import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { onboardingStates } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import type { ConsentSubject } from '../domain/consent.repository.js';
import {
  ONBOARDING_STATE_REPOSITORY,
  type OnboardingOutcome,
  type OnboardingStateRepository,
} from '../application/onboarding.service.js';

@Injectable()
export class MysqlOnboardingStateRepository implements OnboardingStateRepository {
  constructor(private readonly database: QueryRunner) {}

  async find(subject: ConsentSubject): Promise<OnboardingOutcome | null> {
    const rows = await this.database.db
      .select({ state: onboardingStates.state })
      .from(onboardingStates)
      .where(
        and(
          eq(onboardingStates.subjectKind, subject.kind),
          eq(onboardingStates.subjectId, subject.id),
        ),
      )
      .limit(1);
    const state = rows[0]?.state;
    return state === 'done' || state === 'guest' || state === 'skip' ? state : null;
  }

  async upsert(subject: ConsentSubject, state: OnboardingOutcome): Promise<void> {
    await this.database.db
      .insert(onboardingStates)
      .values({ subjectKind: subject.kind, subjectId: subject.id, state })
      .onDuplicateKeyUpdate({ set: { state, updatedAt: sql`CURRENT_TIMESTAMP(3)` } });
  }
}

export const onboardingStateRepositoryProvider = {
  provide: ONBOARDING_STATE_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): OnboardingStateRepository =>
    new MysqlOnboardingStateRepository(database),
};
