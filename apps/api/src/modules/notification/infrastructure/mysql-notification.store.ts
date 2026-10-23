/**
 * Penyimpanan pemberitahuan di MySQL (P27-07, migration 0031).
 *
 * "Terbaru" ditentukan oleh `id` ULID dan bukan oleh `created_at`: dua baris pada milidetik yang
 * sama tetap punya urutan total lewat 80 bit acaknya — sama dengan alasan di repository consent.
 */
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { notifications } from '../../../infrastructure/mysql/schema/intelligence.js';
import { userRoles } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  NOTIFICATION_STORE,
  type NewNotification,
  type NotificationRow,
  type NotificationStore,
} from '../domain/notification.js';
import type { NotificationKind } from '../../../shared/notification/notifier.port.js';

@Injectable()
export class MysqlNotificationStore implements NotificationStore {
  constructor(private readonly database: QueryRunner) {}

  private get db() {
    return this.database.db;
  }

  async append(rows: readonly NewNotification[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert(notifications).values(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        subjectId: row.subjectId,
        data: row.data,
      })),
    );
  }

  async list(userId: string, limit: number): Promise<readonly NotificationRow[]> {
    const rows = await this.db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        subjectId: notifications.subjectId,
        data: notifications.data,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.id))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as NotificationKind,
      subjectId: row.subjectId,
      data: (row.data ?? {}) as Readonly<Record<string, string | number | null>>,
      readAt: row.readAt,
      createdAt: row.createdAt,
    }));
  }

  async unreadCount(userId: string): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return rows[0]?.n ?? 0;
  }

  async markRead(userId: string, ids: readonly string[], now: Date): Promise<void> {
    // `userId` selalu ikut di WHERE: id dari klien tidak boleh menyentuh baris orang lain.
    const owned = eq(notifications.userId, userId);
    await this.db
      .update(notifications)
      .set({ readAt: now })
      .where(
        ids.length === 0
          ? and(owned, isNull(notifications.readAt))
          : and(owned, isNull(notifications.readAt), inArray(notifications.id, [...ids])),
      );
  }

  async usersWithRole(roles: readonly string[]): Promise<readonly string[]> {
    if (roles.length === 0) return [];
    const rows = await this.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.role, [...roles]));
    return [...new Set(rows.map((row) => row.userId))];
  }
}

export const notificationStoreProvider = {
  provide: NOTIFICATION_STORE,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): NotificationStore =>
    new MysqlNotificationStore(database),
};
