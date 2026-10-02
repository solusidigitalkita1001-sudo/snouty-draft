import { sql } from 'drizzle-orm';
import {
  char,
  check,
  datetime,
  foreignKey,
  index,
  mysqlTable,
  primaryKey,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Skema konteks identity. docs/DATABASE.md §5–§6 · docs/DOMAIN_MODEL.md §3.
 *
 * Berbeda dari skema katalog, berkas ini **memakai foreign key** — konvensi di
 * `docs/DATABASE.md` §5 berbunyi "constraint dalam satu konteks; lintas konteks
 * cukup kolom pemilik tanpa FK". Seluruh tabel di sini satu konteks, jadi
 * `user_roles`, `refresh_tokens`, dan `guest_sessions.linked_user_id` menunjuk
 * `users` dengan constraint sungguhan.
 *
 * Dua kolom sengaja **tanpa** FK, dan keduanya karena alasan yang sama:
 * `consents.subject_id` dan (nanti) `conversations.owner_id` menunjuk **user atau
 * sesi tamu**. Rujukan polimorfik tidak bisa diberi FK ke dua tabel, dan memaksakan
 * satu tabel "subjek" hanya untuk menyenangkan constraint akan menambah join di
 * setiap pembacaan demi integritas yang tetap harus diperiksa di aplikasi.
 */

const id = () => char('id', { length: 26 });
const createdAt = () =>
  datetime('created_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);
/**
 * Waktu pemberian, dengan nama kolomnya sendiri.
 *
 * Tidak memakai helper `createdAt()`: helper itu mengunci nama kolom menjadi
 * `created_at`, dan memakainya untuk `grantedAt` menghasilkan kolom `created_at`
 * sementara CHECK di bawah merujuk `granted_at` — migration yang gagal saat
 * dijalankan. Ketahuan oleh tes migration, bukan oleh review.
 */
const grantedAt = () =>
  datetime('granted_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

const updatedAt = () =>
  datetime('updated_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP(3)`);

/**
 * Pelanggan dan pengguna internal adalah **entity yang sama** dengan peran
 * berbeda (docs/DOMAIN_MODEL.md §3). Memisahkannya akan menduplikasi autentikasi
 * tanpa alasan — dan duplikasi autentikasi berarti dua tempat untuk salah.
 */
export const users = mysqlTable(
  'users',
  {
    id: id().primaryKey(),
    /**
     * Dinormalkan huruf kecil di lapisan aplikasi.
     *
     * Collation baku MySQL juga tidak membedakan huruf besar-kecil, jadi
     * `A@x.com` dan `a@x.com` sudah bertabrakan di unique index ini. Itu memang
     * yang diinginkan: dua akun yang alamatnya "sama bagi manusia" adalah dua akun
     * yang suatu hari akan tertukar.
     */
    email: varchar('email', { length: 255 }).notNull(),
    /** Argon2id dalam bentuk ter-encode (memuat salt dan parameternya). */
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),

    /** `registered` | `advanced` — untuk MVP keduanya setara (OQ-05). */
    tier: varchar('tier', { length: 16 }).notNull().default('registered'),
    /** Server yang berwenang atas preferensi tema, bukan `localStorage` (OQ-19). */
    themePreference: varchar('theme_preference', { length: 8 }).notNull().default('system'),

    /**
     * Akun internal **dinonaktifkan**, tidak dihapus (docs/BACKOFFICE.md §5).
     * Audit log harus tetap bisa merujuk pelakunya, dan rujukan ke baris yang
     * sudah hilang bukan audit.
     */
    status: varchar('status', { length: 16 }).notNull().default('active'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastSeenAt: datetime('last_seen_at', { fsp: 3 }),
  },
  (t) => [
    uniqueIndex('uq_users_email').on(t.email),
    index('ix_users_status').on(t.status),
    check('ck_users_tier', sql`\`tier\` IN ('registered','advanced')`),
    check('ck_users_status', sql`\`status\` IN ('active','disabled')`),
    check('ck_users_theme_preference', sql`\`theme_preference\` IN ('light','dark','system')`),
  ],
);

/**
 * Peran internal, satu baris per peran.
 *
 * Tabel terpisah, bukan kolom `roles` bertipe JSON, karena pertanyaan nyata yang
 * akan ditanyakan layar back-office adalah "siapa saja yang `catalog_admin`?" —
 * dan itu `WHERE role = ?`, bukan pemindaian JSON seluruh tabel pengguna.
 *
 * **Peran tidak diwariskan secara implisit** (docs/BACKOFFICE.md §7 tes 8): `admin`
 * bukan `catalog_admin`. Tidak ada hierarki di sini yang bisa membuatnya begitu.
 */
export const userRoles = mysqlTable(
  'user_roles',
  {
    userId: char('user_id', { length: 26 }).notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    grantedAt: grantedAt(),
    /** Siapa yang memberikannya — pertanyaan pertama setiap kali peran dipertanyakan. */
    grantedBy: char('granted_by', { length: 26 }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.role] }),
    index('ix_user_roles_role').on(t.role),
    foreignKey({
      name: 'fk_user_roles_user',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    check(
      'ck_user_roles_role',
      sql`\`role\` IN ('sales_reviewer','technical_team','catalog_admin','domain_expert','admin')`,
    ),
  ],
);

/**
 * Refresh token, **dirotasi setiap pemakaian** (docs/SECURITY.md §3).
 *
 * Tiga keputusan yang membentuk tabel ini:
 *
 * **Yang disimpan adalah hash, bukan tokennya.** Database yang bocor tidak boleh
 * berarti sesi yang bisa dipakai. SHA-256 cukup di sini — berbeda dari password,
 * token ini sudah berentropi tinggi, jadi KDF lambat tidak menambah apa pun selain
 * biaya di setiap refresh.
 *
 * **`family_id` mengikat satu rantai rotasi.** Deteksi pemakaian ulang mencabut
 * seluruh rantai, bukan satu token: kalau token dicuri, pemakaian oleh penyerang
 * **atau** oleh pengguna asli membuat keduanya ter-logout — terlihat, bukan diam.
 *
 * **`used_at` tidak dihapus setelah rotasi.** Baris yang dihapus tidak bisa
 * mendeteksi pemakaian ulang; justru baris bekas itulah alat deteksinya.
 */
export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: id().primaryKey(),
    userId: char('user_id', { length: 26 }).notNull(),
    /** SHA-256 heksadesimal dari token yang dikirim ke klien. */
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    /** Rantai rotasi. Satu login = satu family; refresh memperpanjangnya. */
    familyId: char('family_id', { length: 26 }).notNull(),

    expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
    /** Terisi saat token ini dirotasi. Pemakaian kedua setelah ini adalah serangan. */
    usedAt: datetime('used_at', { fsp: 3 }),
    revokedAt: datetime('revoked_at', { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('uq_refresh_tokens_hash').on(t.tokenHash),
    index('ix_refresh_tokens_user').on(t.userId),
    index('ix_refresh_tokens_family').on(t.familyId),
    /** Pembersihan token kedaluwarsa memindai kolom ini. */
    index('ix_refresh_tokens_expires').on(t.expiresAt),
    foreignKey({
      name: 'fk_refresh_tokens_user',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    check('ck_refresh_tokens_expiry', sql`\`expires_at\` > \`created_at\``),
  ],
);

/**
 * Sesi tamu. Cookie `httpOnly`, id ULID, TTL `GUEST_SESSION_TTL`.
 *
 * `linked_user_id` terisi saat tamu mendaftar, dan barisnya **tidak dihapus**:
 * invarian G-1 menjanjikan seluruh percakapan berpindah kepemilikan, dan menyimpan
 * tautannya adalah cara membuktikan perpindahan itu benar terjadi — bukan sekadar
 * mengaku.
 */
export const guestSessions = mysqlTable(
  'guest_sessions',
  {
    id: id().primaryKey(),
    linkedUserId: char('linked_user_id', { length: 26 }),
    linkedAt: datetime('linked_at', { fsp: 3 }),
    expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
    createdAt: createdAt(),
    lastSeenAt: datetime('last_seen_at', { fsp: 3 }),
  },
  (t) => [
    index('ix_guest_sessions_expires').on(t.expiresAt),
    index('ix_guest_sessions_linked_user').on(t.linkedUserId),
    /**
     * `RESTRICT`, bukan `SET NULL`.
     *
     * Dua alasan, dan keduanya mengarah ke tempat yang sama. Pertama: akun tidak
     * pernah dihapus, hanya dinonaktifkan (docs/BACKOFFICE.md §5), jadi `SET NULL`
     * mengantisipasi peristiwa yang seharusnya tidak pernah terjadi. Kedua: MySQL
     * **menolak** CHECK di bawah ini bila kolomnya dipakai aksi referensial —
     * dan penolakan itu benar, karena meng-NULL-kan `linked_user_id` sambil
     * meninggalkan `linked_at` justru melanggar invarian yang hendak dijaga.
     *
     * Ketahuan oleh tes migration, bukan oleh review: ALTER yang gagal
     * menghentikan seluruh migration, sehingga foreign key setelahnya pun tidak
     * pernah terpasang — dua gejala, satu penyebab.
     */
    foreignKey({
      name: 'fk_guest_sessions_linked_user',
      columns: [t.linkedUserId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    /** Waktu penautan dan penggunanya datang sepasang, atau tidak sama sekali. */
    check(
      'ck_guest_sessions_link_pair',
      sql`(\`linked_user_id\` IS NULL) = (\`linked_at\` IS NULL)`,
    ),
  ],
);

/**
 * Persetujuan — **baris database, bukan flag `localStorage`** (docs/PRIVACY.md §3).
 *
 * Tidak ada unique index pada (subjek, jenis): mencabut lalu memberi lagi
 * menghasilkan baris baru, dan riwayatnya yang menjadi buktinya. Keadaan sekarang
 * adalah baris terbaru, bukan satu-satunya baris.
 *
 * `policy_version` wajib di setiap baris (SPEC §30b). Persetujuan tanpa versi
 * kebijakan tidak bisa dijawab saat seseorang bertanya "disetujui atas dasar apa?".
 */
export const consents = mysqlTable(
  'consents',
  {
    id: id().primaryKey(),
    /** `userId` atau `guestSessionId` — polimorfik, karena itu tanpa FK. */
    subjectId: char('subject_id', { length: 26 }).notNull(),
    subjectKind: varchar('subject_kind', { length: 8 }).notNull(),
    kind: varchar('kind', { length: 24 }).notNull(),
    granted: tinyint('granted').notNull(),
    policyVersion: varchar('policy_version', { length: 32 }).notNull(),
    grantedAt: grantedAt(),
    revokedAt: datetime('revoked_at', { fsp: 3 }),
  },
  (t) => [
    index('ix_consents_subject').on(t.subjectKind, t.subjectId, t.kind),
    check('ck_consents_subject_kind', sql`\`subject_kind\` IN ('user','guest')`),
    check('ck_consents_kind', sql`\`kind\` IN ('LOCATION','ANALYTICS_STORAGE')`),
    /** Pencabutan tidak pernah mendahului pemberian. */
    check(
      'ck_consents_revoked_after_granted',
      sql`(\`revoked_at\` IS NULL) OR (\`revoked_at\` >= \`granted_at\`)`,
    ),
    /**
     * Penolakan tidak bisa dicabut — tidak ada yang namanya "mencabut penolakan".
     * Memberi izin setelah menolak adalah baris baru, bukan pengubahan baris lama.
     */
    check('ck_consents_revoke_only_granted', sql`(\`revoked_at\` IS NULL) OR (\`granted\` = 1)`),
  ],
);

/**
 * Keadaan onboarding per subjek — DARI SERVER, bukan `localStorage` (OQ-19).
 *
 * Tidak ada baris = `pending`. Satu baris per subjek (PK gabungan), di-upsert saat
 * onboarding selesai: berbeda dari consent, riwayat "kapan onboarding ditutup"
 * tidak bernilai bukti apa pun, jadi append-only di sini hanya menumpuk baris.
 *
 * Polimorfik user/guest seperti `consents`, dan karena itu tanpa FK.
 */
export const onboardingStates = mysqlTable(
  'onboarding_states',
  {
    subjectKind: varchar('subject_kind', { length: 8 }).notNull(),
    subjectId: char('subject_id', { length: 26 }).notNull(),
    /** `done` | `guest` | `skip` — `pending` dinyatakan oleh ketiadaan baris. */
    state: varchar('state', { length: 8 }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.subjectKind, t.subjectId] }),
    check('ck_onboarding_states_subject', sql`\`subject_kind\` IN ('user','guest')`),
    check('ck_onboarding_states_state', sql`\`state\` IN ('done','guest','skip')`),
  ],
);
