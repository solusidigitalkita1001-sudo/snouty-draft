/**
 * Pemberitahuan di dalam aplikasi (P27-07). Domain murni: tipe baris, port penyimpanan, dan satu
 * aturan — berapa banyak yang dibawa sekali tarik.
 */

import type { NotificationKind } from '../../../shared/notification/notifier.port.js';

export const NOTIFICATION_STORE = Symbol('NOTIFICATION_STORE');

export interface NotificationRow {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly subjectId: string | null;
  readonly data: Readonly<Record<string, string | number | null>>;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

/**
 * Daftar pemberitahuan dibatasi, bukan tak hingga: lonceng adalah "apa yang baru", bukan arsip.
 * Yang lebih lama tetap tersimpan dan terbaca lewat jejak audit.
 */
export const NOTIFICATION_PAGE = 30;

export interface NewNotification {
  readonly id: string;
  readonly userId: string;
  readonly kind: NotificationKind;
  readonly subjectId: string | null;
  readonly data: Readonly<Record<string, string | number | null>>;
}

export interface NotificationStore {
  append(rows: readonly NewNotification[]): Promise<void>;
  list(userId: string, limit: number): Promise<readonly NotificationRow[]>;
  unreadCount(userId: string): Promise<number>;
  /** `ids` kosong = tandai semua milik pengguna itu. Hanya miliknya sendiri yang tersentuh. */
  markRead(userId: string, ids: readonly string[], now: Date): Promise<void>;
  /** Akun yang memegang salah satu peran — penerima kejadian yang ditujukan ke tim. */
  usersWithRole(roles: readonly string[]): Promise<readonly string[]>;
}
