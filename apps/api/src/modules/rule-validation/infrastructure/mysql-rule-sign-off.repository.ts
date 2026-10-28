import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { ruleSignOffs } from '../../../infrastructure/mysql/schema/engineering.js';
import { users } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  RULE_SIGN_OFF_REPOSITORY,
  type DecideRuleInput,
  type RuleSignOffDecision,
  type RuleSignOffRepository,
  type RuleSignOffRow,
} from '../domain/rule-sign-off.repository.js';

@Injectable()
export class MysqlRuleSignOffRepository implements RuleSignOffRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Nama penanda tangan dibaca di sini, bukan disalin ke barisnya: akun internal dinonaktifkan
   * dan tidak pernah dihapus, jadi namanya selalu ada — dan namanya ikut berubah bila orangnya
   * memperbaiki ejaan namanya sendiri.
   */
  async list(): Promise<readonly RuleSignOffRow[]> {
    const rows = await this.database.db
      .select({ signOff: ruleSignOffs, name: users.name })
      .from(ruleSignOffs)
      .innerJoin(users, eq(users.id, ruleSignOffs.decidedBy));
    return rows.map((row) => toRow(row.signOff, row.name));
  }

  async decide(input: DecideRuleInput): Promise<void> {
    await this.database.db
      .insert(ruleSignOffs)
      .values({
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        decision: input.decision,
        decidedBy: input.decidedBy,
        note: input.note,
      })
      // Ahli boleh berubah pikiran atas versi yang sama; yang tercatat keputusan terakhirnya.
      .onDuplicateKeyUpdate({
        set: {
          decision: input.decision,
          decidedBy: input.decidedBy,
          note: input.note,
          decidedAt: sql`CURRENT_TIMESTAMP(3)`,
        },
      });
  }

  async withdraw(ruleId: string, ruleVersion: number): Promise<void> {
    await this.database.db
      .delete(ruleSignOffs)
      .where(and(eq(ruleSignOffs.ruleId, ruleId), eq(ruleSignOffs.ruleVersion, ruleVersion)));
  }
}

function toRow(row: typeof ruleSignOffs.$inferSelect, decidedByName: string): RuleSignOffRow {
  return {
    ruleId: row.ruleId,
    ruleVersion: row.ruleVersion,
    decision: row.decision as RuleSignOffDecision,
    decidedBy: row.decidedBy,
    decidedByName,
    note: row.note,
    decidedAt: row.decidedAt,
  };
}

export const ruleSignOffRepositoryProvider = {
  provide: RULE_SIGN_OFF_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): RuleSignOffRepository =>
    new MysqlRuleSignOffRepository(database),
};
