import { sql } from 'drizzle-orm';
import {
  char,
  check,
  datetime,
  foreignKey,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Skema konteks conversation — bagian Fase 3: percakapan dan pesan.
 * docs/DOMAIN_MODEL.md §4 · docs/DATABASE.md §6.
 *
 * `requirement_snapshots` dan `conversation_events` SENGAJA belum ada: penulisnya
 * (Context Engine) datang di Fase 4, dan tabel tanpa penulis hanya menambah skema
 * yang harus dijelaskan. Kolom `current_snapshot_id` sudah disediakan karena
 * bentuk percakapannya memuat rujukan itu sejak lahir — nilainya saja yang
 * menunggu Fase 4.
 */

const id = () => char('id', { length: 26 });
const createdAt = () =>
  datetime('created_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

export const conversations = mysqlTable(
  'conversations',
  {
    id: id().primaryKey(),
    /**
     * Pemilik: user ATAU sesi tamu — polimorfik seperti `consents`, tanpa FK.
     * Invarian G-1 justru hidup di kolom ini: penautan tamu → akun mengubah
     * `owner_kind`+`owner_id` seluruh baris milik sesi itu dalam satu transaksi.
     */
    ownerKind: varchar('owner_kind', { length: 8 }).notNull(),
    ownerId: char('owner_id', { length: 26 }).notNull(),

    /** Dibuat LLM dari pesan pertama (Fase 4), boleh diedit. NULL = belum berjudul. */
    title: varchar('title', { length: 160 }),
    status: varchar('status', { length: 20 }).notNull().default('IN_PROGRESS'),
    /** Indikator tahap di header: KEBUTUHAN → ANALISIS → SOLUSI → LAPORAN. */
    stage: varchar('stage', { length: 12 }).notNull().default('KEBUTUHAN'),

    /** Menunjuk `requirement_snapshots` — tabelnya lahir di Fase 4. */
    currentSnapshotId: char('current_snapshot_id', { length: 26 }),
    /** Terisi setelah solusi tersusun (Fase 7). */
    recommendationId: char('recommendation_id', { length: 26 }),
    /**
     * Versi katalog saat konsultasi berjalan. Lintas konteks → tanpa FK.
     * Dibekukan saat pipeline rekomendasi berjalan (Fase 7), bukan saat percakapan
     * dibuat: percakapan yang dibuka hari ini dan dianalisis minggu depan harus
     * memakai katalog minggu depan.
     */
    catalogVersionId: char('catalog_version_id', { length: 26 }),

    createdAt: createdAt(),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => sql`CURRENT_TIMESTAMP(3)`),
    /** Soft delete — tabel milik pengguna, demi hak penghapusan (docs/DATABASE.md §5). */
    deletedAt: datetime('deleted_at', { fsp: 3 }),
  },
  (t) => [
    // Bentuk query layar 12: riwayat milikku, terbaru dulu, difilter status.
    index('ix_conversations_owner_updated').on(t.ownerKind, t.ownerId, t.updatedAt),
    index('ix_conversations_status_updated').on(t.status, t.updatedAt),
    check('ck_conversations_owner_kind', sql`\`owner_kind\` IN ('user','guest')`),
    check(
      'ck_conversations_status',
      sql`\`status\` IN ('IN_PROGRESS','CHECKING_DATA','ANALYZING','INCOMPLETE_DATA','SOLUTION_READY','NEEDS_VALIDATION','SAVED','REOPENED')`,
    ),
    check('ck_conversations_stage', sql`\`stage\` IN ('KEBUTUHAN','ANALISIS','SOLUSI','LAPORAN')`),
  ],
);

export const messages = mysqlTable(
  'messages',
  {
    id: id().primaryKey(),
    conversationId: char('conversation_id', { length: 26 }).notNull(),
    role: varchar('role', { length: 10 }).notNull(),
    text: text('text').notNull(),
    /**
     * `AssistantCard[]` — union tertutup dari `shared-types`. Disimpan JSON karena
     * tidak pernah di-query per field; yang di-query selalu "pesan percakapan ini,
     * urut waktu".
     */
    cards: json('cards'),
    /** Mood mascot penyerta, diturunkan dari state sistem — bukan dipilih LLM. */
    mood: varchar('mood', { length: 16 }),
    /** Rujukan audit biaya ke `llm_calls` (konteks ops) — lintas konteks, tanpa FK. */
    llmCallId: char('llm_call_id', { length: 26 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_messages_conversation_created').on(t.conversationId, t.createdAt),
    foreignKey({
      name: 'fk_messages_conversation',
      columns: [t.conversationId],
      foreignColumns: [conversations.id],
    }).onDelete('cascade'),
    check('ck_messages_role', sql`\`role\` IN ('user','assistant')`),
  ],
);

/**
 * requirement_snapshots — SEMUA snapshot state kebutuhan, append-only.
 * docs/CONTEXT_ENGINE.md §7 · docs/DOMAIN_MODEL.md §4.
 *
 * MySQL adalah sumber kebenaran; Redis hanya cache baca (write-through). Sifat
 * append-only memberi tiga hal tanpa kerja tambahan: jalur undo "Perbaiki asumsi
 * ini", riwayat audit siapa mengubah apa, dan korpus transisi state untuk evaluasi.
 *
 * `version` naik monoton per percakapan; `uq_snapshots_conversation_version`
 * menjadikan itu invarian basis data, bukan sekadar janji kode (SPEC §9 #5).
 * Saat tamu mendaftar snapshot TIDAK disalin — hanya `owner_id` percakapan yang
 * berpindah — karena menyalin akan menduplikasi `version` dan merusak append-only.
 */
export const requirementSnapshots = mysqlTable(
  'requirement_snapshots',
  {
    id: id().primaryKey(),
    conversationId: char('conversation_id', { length: 26 }).notNull(),
    /** Naik monoton per percakapan, mulai 1. */
    version: int('version').notNull(),
    /** `RequirementState` utuh — dibaca langsung, tidak pernah di-query per field. */
    state: json('state').notNull(),
    /** Apa yang memicu snapshot ini terbentuk. */
    trigger: varchar('trigger', { length: 24 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('uq_snapshots_conversation_version').on(t.conversationId, t.version),
    foreignKey({
      name: 'fk_snapshots_conversation',
      columns: [t.conversationId],
      foreignColumns: [conversations.id],
    }).onDelete('cascade'),
    check(
      'ck_snapshots_trigger',
      sql`\`trigger\` IN ('extraction','clarification_answer','user_edit','default_applied')`,
    ),
  ],
);
