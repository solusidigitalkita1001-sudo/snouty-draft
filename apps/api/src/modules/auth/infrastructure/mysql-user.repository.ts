/**
 * Implementasi MySQL dari `UserRepository`.
 *
 * Email ganda ditangkap dari unique index, bukan dari find-lalu-insert: dua
 * registrasi serentak dengan email sama akan lolos pemeriksaan find dua-duanya,
 * dan hanya database yang bisa memenangkan balapan itu dengan benar.
 */
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { userRoles, users } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import { EmailAlreadyRegisteredError } from '../domain/auth.errors.js';
import {
  USER_REPOSITORY,
  type NewUser,
  type UserRepository,
  type UserRow,
} from '../domain/user.repository.js';

@Injectable()
export class MysqlUserRepository implements UserRepository {
  constructor(private readonly database: QueryRunner) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.findOne(eq(users.email, email));
  }

  async findById(id: string): Promise<UserRow | null> {
    return this.findOne(eq(users.id, id));
  }

  async create(user: NewUser): Promise<void> {
    try {
      await this.database.db.insert(users).values(user);
    } catch (error) {
      if (isDuplicateKey(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.database.db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.database.db.update(users).set({ name }).where(eq(users.id, id));
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.database.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  private async findOne(condition: ReturnType<typeof eq>): Promise<UserRow | null> {
    const rows = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        tier: users.tier,
        status: users.status,
        role: userRoles.role,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .where(condition);

    const first = rows[0];
    if (first === undefined) return null;

    return {
      id: first.id,
      email: first.email,
      passwordHash: first.passwordHash,
      name: first.name,
      tier: toTier(first.tier),
      status: toStatus(first.status),
      roles: rows.map((row) => row.role).filter((role): role is string => role !== null),
    };
  }
}

function toTier(raw: string): 'registered' | 'advanced' {
  if (raw === 'registered' || raw === 'advanced') return raw;
  throw new Error(`tier tidak dikenal di database: ${raw}`);
}

function toStatus(raw: string): 'active' | 'disabled' {
  if (raw === 'active' || raw === 'disabled') return raw;
  throw new Error(`status pengguna tidak dikenal di database: ${raw}`);
}

/** Kode galat mysql2 untuk pelanggaran unique index. */
function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    // Drizzle membungkus galat driver; kodenya ada di `cause`.
    ((error as { code?: string }).code === 'ER_DUP_ENTRY' ||
      ((error as { cause?: { code?: string } }).cause?.code ?? '') === 'ER_DUP_ENTRY')
  );
}

export const userRepositoryProvider = {
  provide: USER_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): UserRepository => new MysqlUserRepository(database),
};
