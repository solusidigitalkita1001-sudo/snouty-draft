/**
 * Pemberitahuan di dalam aplikasi (P27-07, pemilik 2026-10-23: "notifikasi belum ada").
 *
 * Dua sifat yang dipegang di sini:
 *
 * **Tidak pernah menggagalkan pemanggilnya.** Penugasan prospek yang berhasil tidak boleh
 * dibatalkan hanya karena baris pemberitahuannya gagal ditulis; kegagalan dicatat di log dan
 * selesai. Karena itulah `notify` memakai port, bukan transaksi bersama.
 *
 * **Yang disimpan kejadian, bukan kalimat.** Lihat `NotificationEvent`.
 */

import type { Logger } from 'pino';
import { ulid } from '../../../shared/ulid.js';
import type { NotificationEvent, Notifier } from '../../../shared/notification/notifier.port.js';
import {
  NOTIFICATION_PAGE,
  type NewNotification,
  type NotificationRow,
  type NotificationStore,
} from '../domain/notification.js';

/** Peran yang menerima kejadian yang ditujukan ke tim Pralon, bukan ke satu orang. */
export const TEAM_ROLES = ['admin', 'sales_reviewer'] as const;

export class NotificationService implements Notifier {
  constructor(
    private readonly store: NotificationStore,
    private readonly log: Pick<Logger, 'warn'> | null = null,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async notify(event: NotificationEvent): Promise<void> {
    await this.append([rowOf(event.userId, event)]);
  }

  async notifyAll(
    userIds: readonly string[],
    event: Omit<NotificationEvent, 'userId'>,
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    await this.append(unique.map((userId) => rowOf(userId, event)));
  }

  /** Kejadian untuk seluruh tim internal (mis. ada yang minta dihubungi). */
  async notifyTeam(event: Omit<NotificationEvent, 'userId'>): Promise<void> {
    await this.notifyAll(await this.store.usersWithRole([...TEAM_ROLES]), event);
  }

  async list(userId: string): Promise<readonly NotificationRow[]> {
    return this.store.list(userId, NOTIFICATION_PAGE);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.store.unreadCount(userId);
  }

  /** `ids` kosong = tandai semuanya. Hanya milik pengguna itu sendiri yang tersentuh. */
  async markRead(userId: string, ids: readonly string[]): Promise<void> {
    await this.store.markRead(userId, ids, this.clock());
  }

  private async append(rows: readonly NewNotification[]): Promise<void> {
    try {
      await this.store.append(rows);
    } catch (cause) {
      this.log?.warn({ err: cause, count: rows.length }, 'pemberitahuan gagal ditulis');
    }
  }
}

function rowOf(userId: string, event: Omit<NotificationEvent, 'userId'>): NewNotification {
  return {
    id: ulid(),
    userId,
    kind: event.kind,
    subjectId: event.subjectId ?? null,
    data: event.data ?? {},
  };
}
