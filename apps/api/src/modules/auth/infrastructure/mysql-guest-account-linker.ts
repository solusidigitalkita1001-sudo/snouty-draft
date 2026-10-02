/**
 * Implementasi G-1: SATU transaksi database untuk dua konteks.
 *
 * Ini satu-satunya tempat di basis kode yang menulis tabel dua konteks sekaligus
 * (identity: `guest_sessions`; conversation: `conversations`), dan itu bukan
 * pelanggaran yang tidak disadari — justru inilah titik temunya. Invarian G-1
 * menuntut keduanya ter-commit bersama, dan transaksi tidak bisa dibagi antar
 * repository yang masing-masing membuka transaksinya sendiri.
 *
 * Dua kegagalan yang desain ini tutup:
 *
 *   - Sesi tertanda tertaut, percakapan belum pindah → sesi tamu diganti oleh
 *     `GuestSessionService.ensure()` (karena sudah tertaut), dan percakapannya
 *     tidak terjangkau siapa pun. INILAH baris anak yatim yang dilarang G-1.
 *   - Percakapan pindah, sesi belum tertanda → tamu "kosong" yang bisa dipakai
 *     lagi; membingungkan, walau tidak menghilangkan data.
 *
 * Satu transaksi menghapus keduanya sekaligus, bukan memilih yang lebih ringan.
 */
import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { conversations } from '../../../infrastructure/mysql/schema/conversation.js';
import { guestSessions } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  GUEST_ACCOUNT_LINKER,
  type GuestAccountLinker,
  type LinkResult,
} from '../domain/guest-account-linker.port.js';

const NOTHING: LinkResult = { movedConversations: 0, resumedConversationId: null };

@Injectable()
export class MysqlGuestAccountLinker implements GuestAccountLinker {
  constructor(private readonly database: QueryRunner) {}

  async link(guestSessionId: string, userId: string): Promise<LinkResult> {
    return this.database.db.transaction(async (tx) => {
      // FOR UPDATE: dua register serentak dengan cookie yang sama tidak boleh
      // dua-duanya lolos pemeriksaan "belum tertaut".
      const sessions = await tx
        .select({
          id: guestSessions.id,
          linkedUserId: guestSessions.linkedUserId,
          expiresAt: guestSessions.expiresAt,
        })
        .from(guestSessions)
        .where(eq(guestSessions.id, guestSessionId))
        .for('update');

      const session = sessions[0];
      // Tidak ada, kedaluwarsa, atau sudah tertaut (ke siapa pun): tidak ada yang
      // ditautkan, dan registrasi TIDAK digagalkan — lihat kontrak port.
      if (session === undefined) return NOTHING;
      if (session.linkedUserId !== null) return NOTHING;
      if (session.expiresAt.getTime() <= Date.now()) return NOTHING;

      const owned = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.ownerKind, 'guest'),
            eq(conversations.ownerId, guestSessionId),
            isNull(conversations.deletedAt),
          ),
        )
        .orderBy(desc(conversations.updatedAt));

      await tx
        .update(conversations)
        .set({ ownerKind: 'user', ownerId: userId })
        .where(
          and(eq(conversations.ownerKind, 'guest'), eq(conversations.ownerId, guestSessionId)),
        );

      await tx
        .update(guestSessions)
        .set({ linkedUserId: userId, linkedAt: sql`CURRENT_TIMESTAMP(3)` })
        .where(eq(guestSessions.id, guestSessionId));

      return {
        movedConversations: owned.length,
        resumedConversationId: owned[0]?.id ?? null,
      };
    });
  }
}

export const guestAccountLinkerProvider = {
  provide: GUEST_ACCOUNT_LINKER,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): GuestAccountLinker =>
    new MysqlGuestAccountLinker(database),
};
