import { sql } from 'drizzle-orm';
import {
  char,
  check,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlTable,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Skema konteks ops. docs/BACKOFFICE.md §6.
 *
 * Satu tabel untuk sekarang, dibuat bersama penulis pertamanya (promosi versi
 * katalog, P1-07). Tabel `llm_calls`, `job_runs`, dan `feedback` menyusul bersama
 * pemakainya masing-masing — tabel tanpa penulis hanya menambah skema yang harus
 * dijelaskan ke pemilik server bersama.
 */

/**
 * Audit tulis internal.
 *
 * `before_json` / `after_json` menyimpan **hanya field yang berubah**, bukan
 * seluruh entitas. Dua alasan: audit tidak perlu menduplikasi basis data ke dalam
 * log, dan menyalin seluruh entitas berarti menyalin data pribadi lebih banyak
 * dari yang diperlukan (docs/PRIVACY.md).
 *
 * Tidak ada foreign key ke akun internal, dan itu disengaja: akun internal
 * dinonaktifkan dan tidak pernah dihapus, tetapi audit harus tetap terbaca
 * walaupun suatu hari barisnya hilang (docs/BACKOFFICE.md §5).
 */
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: char('id', { length: 26 }).primaryKey(),
    actorId: char('actor_id', { length: 26 }).notNull(),
    /** Peran saat aksi dilakukan — bukan peran sekarang, yang bisa sudah berubah. */
    actorRole: varchar('actor_role', { length: 32 }).notNull(),
    /** mis. `catalog.version.promote`. Verba tetap Inggris, seperti identifier lain. */
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 48 }).notNull(),
    entityId: char('entity_id', { length: 26 }).notNull(),
    beforeJson: json('before_json'),
    afterJson: json('after_json'),
    correlationId: varchar('correlation_id', { length: 64 }),
    ip: varchar('ip', { length: 45 }),
    createdAt: datetime('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    // Bentuk query nyata layar audit: "apa yang dilakukan aktor ini, terbaru dulu".
    index('ix_audit_logs_actor_created').on(t.actorId, t.createdAt),
    index('ix_audit_logs_entity').on(t.entityType, t.entityId),
    index('ix_audit_logs_action_created').on(t.action, t.createdAt),
  ],
);

/**
 * Audit biaya LLM. docs/AI_BEHAVIOR.md · docs/PRIVACY.md.
 *
 * Satu baris per panggilan model: model, token, latensi, biaya, correlation ID,
 * dan **alasan routing** (tugas + tingkat). Pelacakan biaya tidak memerlukan isi
 * prompt, jadi **isi prompt tidak pernah disimpan** di sini — kolomnya memang tidak
 * ada, sehingga mustahil bocor lewat tabel ini (docs/SECURITY.md §Logging).
 *
 * Lintas konteks ke `messages.llm_call_id` adalah rujukan kolom tanpa FK (arah
 * kebalikan): pesan menunjuk panggilan, panggilan tidak tahu-menahu soal pesan.
 */
export const llmCalls = mysqlTable(
  'llm_calls',
  {
    id: char('id', { length: 26 }).primaryKey(),
    correlationId: varchar('correlation_id', { length: 64 }),
    /** Tugas yang memicu panggilan (mis. `extraction`) — alasan routing. */
    task: varchar('task', { length: 32 }).notNull(),
    /** Tingkat yang dipilih routing (`fast`/`balanced`/`strong`). */
    tier: varchar('tier', { length: 12 }).notNull(),
    /** ID model konkret yang benar-benar dipakai (dari env, dicatat apa adanya). */
    model: varchar('model', { length: 96 }).notNull(),
    promptTokens: int('prompt_tokens').notNull().default(0),
    completionTokens: int('completion_tokens').notNull().default(0),
    costUsd: decimal('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    latencyMs: int('latency_ms').notNull().default(0),
    /** `success` | `validation_failed` | `error` — hasil, bukan isi. */
    outcome: varchar('outcome', { length: 20 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index('ix_llm_calls_created').on(t.createdAt),
    index('ix_llm_calls_task_created').on(t.task, t.createdAt),
    check('ck_llm_calls_outcome', sql`\`outcome\` IN ('success','validation_failed','error')`),
  ],
);
