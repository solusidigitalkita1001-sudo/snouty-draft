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
import {
  consents,
  guestSessions,
  onboardingStates,
} from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import { ulid } from '../../../shared/ulid.js';
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

      // Onboarding yang sudah dilewati sebagai tamu ikut ke akun: tanpa ini akun baru dianggap belum
      // pernah melihatnya dan wizard muncul lagi setelah daftar/masuk (pemilik 2026-10-19). Keadaan
      // milik akun sendiri tidak ditimpa.
      const seen = await tx
        .select({ state: onboardingStates.state })
        .from(onboardingStates)
        .where(
          and(
            eq(onboardingStates.subjectKind, 'guest'),
            eq(onboardingStates.subjectId, guestSessionId),
          ),
        );
      if (seen[0] !== undefined) {
        await tx
          .insert(onboardingStates)
          .values({ subjectKind: 'user', subjectId: userId, state: seen[0].state })
          .onDuplicateKeyUpdate({ set: { state: sql`\`state\`` } });
      }

      await copyConsents(tx, guestSessionId, userId);

      return {
        movedConversations: owned.length,
        resumedConversationId: owned[0]?.id ?? null,
      };
    });
  }
}

/**
 * Persetujuan yang diberikan sebagai tamu ikut ke akun (P27-04, pemilik 2026-10-23: "pastiin
 * ketika udh pernah akses, lokasinya nempel"). Tanpa ini izin lokasi hilang begitu orangnya
 * mendaftar, dan ia ditanya lagi di kunjungan berikutnya.
 *
 * Consent bersifat append-only (docs/PRIVACY.md §3), jadi yang pindah adalah SALINAN baris
 * terakhir per jenis — jejak tamunya tidak diubah. Jenis yang sudah diputuskan akun itu sendiri
 * tidak ditimpa: keputusan atas nama akun yang berlaku.
 */
async function copyConsents(
  tx: Parameters<Parameters<QueryRunner['db']['transaction']>[0]>[0],
  guestSessionId: string,
  userId: string,
): Promise<void> {
  const rows = await tx
    .select({
      id: consents.id,
      kind: consents.kind,
      granted: consents.granted,
      policyVersion: consents.policyVersion,
      grantedAt: consents.grantedAt,
      revokedAt: consents.revokedAt,
    })
    .from(consents)
    .where(and(eq(consents.subjectKind, 'guest'), eq(consents.subjectId, guestSessionId)))
    .orderBy(desc(consents.id));
  if (rows.length === 0) return;

  const mine = await tx
    .select({ kind: consents.kind })
    .from(consents)
    .where(and(eq(consents.subjectKind, 'user'), eq(consents.subjectId, userId)));
  const decided = new Set(mine.map((row) => row.kind));

  // Terbaru dulu (ULID menurun), jadi entri pertama per jenis adalah yang berlaku.
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.kind)) latest.set(row.kind, row);

  const copies = [...latest.values()]
    .filter((row) => !decided.has(row.kind))
    .map((row) => ({
      id: ulid(),
      subjectId: userId,
      subjectKind: 'user',
      kind: row.kind,
      granted: row.granted,
      policyVersion: row.policyVersion,
      grantedAt: row.grantedAt,
      revokedAt: row.revokedAt,
    }));
  if (copies.length > 0) await tx.insert(consents).values(copies);
}

export const guestAccountLinkerProvider = {
  provide: GUEST_ACCOUNT_LINKER,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): GuestAccountLinker =>
    new MysqlGuestAccountLinker(database),
};
