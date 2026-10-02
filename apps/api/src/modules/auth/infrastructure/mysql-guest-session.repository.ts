import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { guestSessions } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  GUEST_SESSION_REPOSITORY,
  type GuestSessionRepository,
  type GuestSessionRow,
} from '../domain/guest-session.repository.js';

@Injectable()
export class MysqlGuestSessionRepository implements GuestSessionRepository {
  constructor(private readonly database: QueryRunner) {}

  async create(session: { id: string; expiresAt: Date }): Promise<void> {
    await this.database.db.insert(guestSessions).values(session);
  }

  async findById(id: string): Promise<GuestSessionRow | null> {
    const rows = await this.database.db
      .select({
        id: guestSessions.id,
        linkedUserId: guestSessions.linkedUserId,
        expiresAt: guestSessions.expiresAt,
      })
      .from(guestSessions)
      .where(eq(guestSessions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async touch(id: string, expiresAt: Date): Promise<void> {
    await this.database.db
      .update(guestSessions)
      .set({ expiresAt, lastSeenAt: new Date() })
      .where(eq(guestSessions.id, id));
  }
}

export const guestSessionRepositoryProvider = {
  provide: GUEST_SESSION_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): GuestSessionRepository =>
    new MysqlGuestSessionRepository(database),
};
