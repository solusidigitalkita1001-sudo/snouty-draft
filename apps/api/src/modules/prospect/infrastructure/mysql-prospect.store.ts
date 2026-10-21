/**
 * Membaca kejadian tahap 5A dari tabel yang sudah ada (P26-05). Setiap jenis kejadian diringkas per
 * pengguna menjadi waktu pertama dan terakhir: yang pertama menentukan kapan tahap dicapai, yang
 * terakhir menentukan kebaruan — dua angka per jenis cukup untuk `assessProspect`, tanpa memuat
 * seluruh riwayat pesan.
 *
 * Pemilik selalu dibaca lewat percakapan, sehingga jejak tamu yang kemudian mendaftar ikut terhitung.
 */
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  min,
  ne,
  notInArray,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { consents, userRoles, users } from '../../../infrastructure/mysql/schema/identity.js';
import {
  conversations,
  messages,
  requirementSnapshots,
} from '../../../infrastructure/mysql/schema/conversation.js';
import {
  prospectSignals,
  salesLeads,
  salesRequests,
} from '../../../infrastructure/mysql/schema/intelligence.js';
import {
  recommendations,
  reports,
  shareLinks,
  technicalHandoffs,
} from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { ulid } from '../../../shared/ulid.js';
import {
  LEAD_STATUSES,
  PROSPECT_STORE,
  type LeadAssignment,
  type LeadStatus,
  type ProspectRecord,
  type ProspectStore,
  type SalesMember,
} from '../domain/prospect-board.js';
import { projectScaleOf, type ProjectScale, type ProspectEvent } from '../domain/prospect-stage.js';

type Db = Pick<DatabaseService, 'db'>['db'];
type SpanKind = Exclude<ProspectEvent['kind'], 'intent'>;

interface Span {
  readonly owner: string | null;
  readonly first: Date | null;
  readonly last: Date | null;
}

/** Percakapan milik pengguna terdaftar yang belum dihapus. */
const ownedByUser = and(eq(conversations.ownerKind, 'user'), isNull(conversations.deletedAt));

export class MysqlProspectStore implements ProspectStore {
  constructor(private readonly database: Pick<DatabaseService, 'db'>) {}

  private get db(): Db {
    return this.database.db;
  }

  /** Pengguna aktif tanpa peran internal — staf Pralon bukan prospek. */
  private staff() {
    return this.db.select({ id: userRoles.userId }).from(userRoles);
  }

  async readAll(): Promise<readonly ProspectRecord[]> {
    const people = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.status, 'active'), notInArray(users.id, this.staff())));
    if (people.length === 0) return [];

    const events = new Map<string, ProspectEvent[]>();
    const push = (owner: string | null, event: ProspectEvent) => {
      if (owner === null) return;
      const list = events.get(owner) ?? [];
      list.push(event);
      events.set(owner, list);
    };
    const spans = (kind: SpanKind, rows: readonly Span[]) => {
      for (const row of rows) {
        if (row.first) push(row.owner, { kind, at: row.first } as ProspectEvent);
        if (row.last && row.last !== row.first)
          push(row.owner, { kind, at: row.last } as ProspectEvent);
      }
    };

    for (const person of people) push(person.id, { kind: 'account_created', at: person.createdAt });

    const conversationRows = await this.db
      .select({
        owner: conversations.ownerId,
        first: min(conversations.createdAt),
        last: max(conversations.updatedAt),
        n: count(),
      })
      .from(conversations)
      .where(ownedByUser)
      .groupBy(conversations.ownerId);
    const conversationCount = new Map<string, number>();
    for (const row of conversationRows) {
      conversationCount.set(row.owner, row.n);
      if (row.first) push(row.owner, { kind: 'conversation_started', at: row.first });
      if (row.last) push(row.owner, { kind: 'activity', at: row.last });
    }

    const intents = await this.db
      .select({
        owner: conversations.ownerId,
        label: messages.intent,
        first: min(messages.createdAt),
        last: max(messages.createdAt),
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(ownedByUser, eq(messages.role, 'user'), isNotNull(messages.intent)))
      .groupBy(conversations.ownerId, messages.intent);
    for (const row of intents) {
      if (row.label === null) continue;
      if (row.first) push(row.owner, { kind: 'intent', label: row.label, at: row.first });
      if (row.last) push(row.owner, { kind: 'intent', label: row.label, at: row.last });
    }

    spans(
      'analysis',
      await this.db
        .select({
          owner: conversations.ownerId,
          first: min(recommendations.createdAt),
          last: max(recommendations.createdAt),
        })
        .from(recommendations)
        .innerJoin(conversations, eq(recommendations.conversationId, conversations.id))
        .where(ownedByUser)
        .groupBy(conversations.ownerId),
    );
    spans(
      'technical_handoff',
      await this.db
        .select({
          owner: conversations.ownerId,
          first: min(technicalHandoffs.createdAt),
          last: max(technicalHandoffs.createdAt),
        })
        .from(technicalHandoffs)
        .innerJoin(conversations, eq(technicalHandoffs.conversationId, conversations.id))
        .where(ownedByUser)
        .groupBy(conversations.ownerId),
    );
    spans(
      'report_created',
      await this.db
        .select({
          owner: conversations.ownerId,
          first: min(reports.createdAt),
          last: max(reports.createdAt),
        })
        .from(reports)
        .innerJoin(recommendations, eq(reports.recommendationId, recommendations.id))
        .innerJoin(conversations, eq(recommendations.conversationId, conversations.id))
        .where(ownedByUser)
        .groupBy(conversations.ownerId),
    );
    spans(
      'report_download',
      await this.db
        .select({
          owner: conversations.ownerId,
          first: min(prospectSignals.createdAt),
          last: max(prospectSignals.createdAt),
        })
        .from(prospectSignals)
        .innerJoin(reports, eq(prospectSignals.refId, reports.id))
        .innerJoin(recommendations, eq(reports.recommendationId, recommendations.id))
        .innerJoin(conversations, eq(recommendations.conversationId, conversations.id))
        .where(and(ownedByUser, eq(prospectSignals.kind, 'report_download')))
        .groupBy(conversations.ownerId),
    );
    spans(
      'product_view',
      await this.db
        .select({
          owner: prospectSignals.userId,
          first: min(prospectSignals.createdAt),
          last: max(prospectSignals.createdAt),
        })
        .from(prospectSignals)
        .where(and(eq(prospectSignals.kind, 'product_view'), isNotNull(prospectSignals.userId)))
        .groupBy(prospectSignals.userId),
    );
    spans(
      'share_created',
      await this.db
        .select({
          owner: shareLinks.ownerId,
          first: min(shareLinks.createdAt),
          last: max(shareLinks.createdAt),
        })
        .from(shareLinks)
        .groupBy(shareLinks.ownerId),
    );
    spans(
      'share_visit',
      await this.db
        .select({
          owner: shareLinks.ownerId,
          first: min(prospectSignals.createdAt),
          last: max(prospectSignals.createdAt),
        })
        .from(prospectSignals)
        .innerJoin(shareLinks, eq(prospectSignals.refId, shareLinks.tokenHash))
        .where(eq(prospectSignals.kind, 'share_visit'))
        .groupBy(shareLinks.ownerId),
    );
    spans(
      'pin',
      await this.db
        .select({
          owner: conversations.ownerId,
          first: min(conversations.pinnedAt),
          last: max(conversations.pinnedAt),
        })
        .from(conversations)
        .where(and(ownedByUser, isNotNull(conversations.pinnedAt)))
        .groupBy(conversations.ownerId),
    );
    const requestRows = await this.db
      .select({
        owner: salesRequests.userId,
        first: min(salesRequests.createdAt),
        last: max(salesRequests.createdAt),
      })
      .from(salesRequests)
      .groupBy(salesRequests.userId);
    spans('sales_request', requestRows);
    const requestedAt = new Map(requestRows.map((row) => [row.owner, row.last]));

    const scales = await this.scales();
    const consent = await this.salesConsents();
    const leads = await this.leads();

    return people.map((person) => ({
      user: person,
      events: events.get(person.id) ?? [],
      scales: scales.get(person.id) ?? [],
      salesContactConsent: consent.get(person.id) ?? false,
      salesRequestedAt: requestedAt.get(person.id) ?? null,
      conversationCount: conversationCount.get(person.id) ?? 0,
      lead: leads.get(person.id) ?? null,
    }));
  }

  /** Skala tiap proyek dari snapshot kebutuhan TERAKHIR percakapannya. */
  private async scales(): Promise<Map<string, ProjectScale[]>> {
    const rows = await this.db
      .select({
        owner: conversations.ownerId,
        buildingType: sql<
          string | null
        >`JSON_UNQUOTE(JSON_EXTRACT(${requirementSnapshots.state}, '$.building.type.value'))`,
        caseId: sql<
          string | null
        >`JSON_UNQUOTE(JSON_EXTRACT(${requirementSnapshots.state}, '$.useCase.caseId'))`,
        useCaseKind: sql<
          string | null
        >`JSON_UNQUOTE(JSON_EXTRACT(${requirementSnapshots.state}, '$.useCase.kind'))`,
      })
      .from(requirementSnapshots)
      .innerJoin(conversations, eq(requirementSnapshots.conversationId, conversations.id))
      .where(
        and(
          ownedByUser,
          sql`${requirementSnapshots.version} = (SELECT MAX(s2.version) FROM requirement_snapshots s2 WHERE s2.conversation_id = ${requirementSnapshots.conversationId})`,
        ),
      );
    const byOwner = new Map<string, ProjectScale[]>();
    const value = (raw: string | null) => (raw === null || raw === 'null' ? null : raw);
    for (const row of rows) {
      const useCase = value(row.useCaseKind) === 'irrigation' ? 'irrigation' : value(row.caseId);
      const list = byOwner.get(row.owner) ?? [];
      list.push(projectScaleOf({ useCase, buildingType: value(row.buildingType) }));
      byOwner.set(row.owner, list);
    }
    return byOwner;
  }

  /** Opt-in TERAKHIR per pengguna — pencabutan atau penolakan menimpa izin sebelumnya. */
  private async salesConsents(): Promise<Map<string, boolean>> {
    const rows = await this.db
      .select({
        subject: consents.subjectId,
        granted: consents.granted,
        revokedAt: consents.revokedAt,
      })
      .from(consents)
      .where(and(eq(consents.subjectKind, 'user'), eq(consents.kind, 'SALES_CONTACT')))
      .orderBy(desc(consents.id));
    const latest = new Map<string, boolean>();
    for (const row of rows) {
      if (!latest.has(row.subject))
        latest.set(row.subject, row.granted === 1 && row.revokedAt === null);
    }
    return latest;
  }

  private async leads(): Promise<Map<string, LeadAssignment>> {
    const sales = alias(users, 'sales_user');
    const rows = await this.db
      .select({
        userId: salesLeads.userId,
        salesUserId: salesLeads.assignedTo,
        salesName: sales.name,
        status: salesLeads.status,
        assignedAt: salesLeads.updatedAt,
      })
      .from(salesLeads)
      .innerJoin(sales, eq(salesLeads.assignedTo, sales.id));
    return new Map(
      rows.map((row) => [
        row.userId,
        {
          salesUserId: row.salesUserId,
          salesName: row.salesName,
          status: toStatus(row.status),
          assignedAt: row.assignedAt,
        },
      ]),
    );
  }

  async contactBasis(userId: string) {
    const [person] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.id, userId), eq(users.status, 'active'), notInArray(users.id, this.staff())),
      )
      .limit(1);
    if (!person) return null;
    const [consent] = await this.db
      .select({ granted: consents.granted, revokedAt: consents.revokedAt })
      .from(consents)
      .where(
        and(
          eq(consents.subjectKind, 'user'),
          eq(consents.subjectId, userId),
          eq(consents.kind, 'SALES_CONTACT'),
        ),
      )
      .orderBy(desc(consents.id))
      .limit(1);
    const [request] = await this.db
      .select({ last: max(salesRequests.createdAt) })
      .from(salesRequests)
      .where(eq(salesRequests.userId, userId));
    return {
      salesContactConsent:
        consent !== undefined && consent.granted === 1 && consent.revokedAt === null,
      salesRequestedAt: request?.last ?? null,
    };
  }

  async isSales(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.role, INTERNAL_ROLES.sales),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async assign(input: { userId: string; salesUserId: string; assignedBy: string }): Promise<void> {
    await this.db
      .insert(salesLeads)
      .values({
        id: ulid(),
        userId: input.userId,
        assignedTo: input.salesUserId,
        assignedBy: input.assignedBy,
      })
      .onDuplicateKeyUpdate({
        set: {
          assignedTo: input.salesUserId,
          assignedBy: input.assignedBy,
          updatedAt: sql`CURRENT_TIMESTAMP(3)`,
        },
      });
  }

  async salesTeam(): Promise<readonly SalesMember[]> {
    const members = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, INTERNAL_ROLES.sales), eq(users.status, 'active')))
      .orderBy(users.name);
    if (members.length === 0) return [];
    const open = await this.db
      .select({ salesUserId: salesLeads.assignedTo, n: count() })
      .from(salesLeads)
      .where(
        and(
          inArray(
            salesLeads.assignedTo,
            members.map((m) => m.id),
          ),
          ne(salesLeads.status, 'won'),
          ne(salesLeads.status, 'lost'),
        ),
      )
      .groupBy(salesLeads.assignedTo);
    const openBy = new Map(open.map((row) => [row.salesUserId, row.n]));
    return members.map((m) => ({ ...m, openLeads: openBy.get(m.id) ?? 0 }));
  }

  async grantSales(email: string, grantedBy: string): Promise<{ readonly userId: string } | null> {
    const [person] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), eq(users.status, 'active')))
      .limit(1);
    if (!person) return null;
    await this.db
      .insert(userRoles)
      .ignore()
      .values({ userId: person.id, role: INTERNAL_ROLES.sales, grantedBy });
    return { userId: person.id };
  }

  async revokeSales(userId: string): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, INTERNAL_ROLES.sales)));
  }
}

function toStatus(raw: string): LeadStatus {
  const status = LEAD_STATUSES.find((s) => s === raw);
  if (status === undefined) throw new Error(`status prospek tidak dikenal di database: ${raw}`);
  return status;
}

export const prospectStoreProvider = {
  provide: PROSPECT_STORE,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): ProspectStore => new MysqlProspectStore(database),
};
