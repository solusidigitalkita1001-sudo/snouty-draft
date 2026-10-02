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
import { conversations } from './conversation.js';

/**
 * Skema konteks recommendation. docs/DOMAIN_MODEL.md §7 · docs/DATABASE.md §6.
 *
 * `catalog_version_id` **dibekukan** saat pembuatan: laporan lama harus tetap bisa
 * dijelaskan dengan katalog yang dipakai saat itu, walaupun katalog sudah dipromosikan
 * berkali-kali sejak itu. Lintas konteks → kolom pemilik tanpa FK.
 *
 * Isi solusi (`system_lines`, `products`, `bom`, `assumptions`, `stats`) disimpan JSON
 * karena tidak pernah di-query per field: yang di-query selalu "solusi percakapan ini,
 * utuh". Menormalkannya akan menambah lima tabel yang tidak pernah dibaca sendiri-sendiri.
 */

const id = () => char('id', { length: 26 });
const createdAt = () =>
  datetime('created_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

export const recommendations = mysqlTable(
  'recommendations',
  {
    id: id().primaryKey(),
    conversationId: char('conversation_id', { length: 26 }).notNull(),
    /** Snapshot kebutuhan yang dipakai — lintas konteks dalam `conversation`, ada FK. */
    snapshotId: char('snapshot_id', { length: 26 }).notNull(),
    /** Dibekukan; lintas konteks ke `catalog` → tanpa FK. */
    catalogVersionId: char('catalog_version_id', { length: 26 }).notNull(),

    /** Prosa LLM yang sudah lulus pemeriksaan REC-1. */
    headline: varchar('headline', { length: 300 }).notNull(),
    body: text('body').notNull(),

    stats: json('stats').notNull(),
    systemLines: json('system_lines').notNull(),
    products: json('products').notNull(),
    bom: json('bom').notNull(),
    assumptions: json('assumptions').notNull(),

    /** Provenance paling lemah di seluruh isi. */
    overallProvenance: varchar('overall_provenance', { length: 12 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_recommendations_conversation').on(t.conversationId, t.createdAt),
    foreignKey({
      name: 'fk_recommendations_conversation',
      columns: [t.conversationId],
      foreignColumns: [conversations.id],
    }).onDelete('cascade'),
    /**
     * Invarian C-1 berlaku juga di sini: nilai yang ditampilkan hanya boleh
     * `VERIFIED` atau `UNAVAILABLE` bila berasal dari katalog — tetapi solusi juga
     * boleh `ASSUMED`/`ESTIMATED` karena ia memuat hasil aturan. Keempatnya sah,
     * yang dilarang adalah nilai di luar kosakata.
     */
    check(
      'ck_recommendations_provenance',
      sql`\`overall_provenance\` IN ('VERIFIED','ASSUMED','ESTIMATED','UNAVAILABLE')`,
    ),
  ],
);

/**
 * Jejak perhitungan — satu baris per eksekusi aturan, **append-only**.
 *
 * Invarian T-1 bersandar pada tabel ini: setiap nilai teknik yang tampil punya minimal
 * satu trace, dan kolom "DASAR PERHITUNGAN" dirender dari `explanation` di sini, bukan
 * dari prosa LLM. Itulah yang membuat auditabilitas SPEC §8 terlihat pengguna.
 */
export const calculationTraces = mysqlTable(
  'calculation_traces',
  {
    id: id().primaryKey(),
    recommendationId: char('recommendation_id', { length: 26 }).notNull(),
    ruleId: varchar('rule_id', { length: 16 }).notNull(),
    ruleVersion: char('rule_version', { length: 8 }).notNull(),
    inputs: json('inputs').notNull(),
    output: json('output').notNull(),
    provenance: varchar('provenance', { length: 12 }).notNull(),
    explanation: text('explanation').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_traces_recommendation').on(t.recommendationId),
    index('ix_traces_rule').on(t.ruleId, t.ruleVersion),
    foreignKey({
      name: 'fk_traces_recommendation',
      columns: [t.recommendationId],
      foreignColumns: [recommendations.id],
    }).onDelete('cascade'),
    check(
      'ck_traces_provenance',
      sql`\`provenance\` IN ('VERIFIED','ASSUMED','ESTIMATED','UNAVAILABLE')`,
    ),
  ],
);

/**
 * Laporan dua halaman. docs/REPORT.md.
 *
 * `report_number` dialokasikan **saat baris ini dibuat**, bukan saat PDF selesai —
 * supaya nomor yang sudah tampil di UI tetap sama meski pembuatan PDF gagal lalu
 * diulang. Nomor tidak pernah dipakai ulang, bahkan untuk laporan yang gagal.
 *
 * `payload_json` menyimpan data laporan yang **sudah dirakit**: laporan harus terbaca
 * sama bertahun kemudian meski katalog, aturan, dan harga sudah berubah. Merujuk
 * ulang ke tabel lain saat mencetak akan membuat laporan lama ikut berubah.
 */
export const reports = mysqlTable(
  'reports',
  {
    id: id().primaryKey(),
    recommendationId: char('recommendation_id', { length: 26 }).notNull(),
    /** `SNTY-YYYY-MM-NNNN`, unik selamanya. */
    reportNumber: varchar('report_number', { length: 20 }).notNull(),
    status: varchar('status', { length: 10 }).notNull().default('PENDING'),
    /** Data laporan yang sudah dirakit — dibekukan saat pembuatan. */
    payloadJson: json('payload_json').notNull(),
    /** Jalur berkas PDF bila sudah jadi; `NULL` selama PENDING/FAILED. */
    fileRef: varchar('file_ref', { length: 255 }),
    failureReason: varchar('failure_reason', { length: 255 }),
    createdAt: createdAt(),
    completedAt: datetime('completed_at', { fsp: 3 }),
  },
  (t) => [
    uniqueIndex('uq_reports_number').on(t.reportNumber),
    index('ix_reports_recommendation').on(t.recommendationId),
    index('ix_reports_status_created').on(t.status, t.createdAt),
    foreignKey({
      name: 'fk_reports_recommendation',
      columns: [t.recommendationId],
      foreignColumns: [recommendations.id],
    }).onDelete('cascade'),
    check('ck_reports_status', sql`\`status\` IN ('PENDING','READY','FAILED')`),
  ],
);

/**
 * Penghitung nomor laporan per bulan. docs/REPORT.md §3.
 *
 * Penambahan dilakukan dalam transaksi dengan `SELECT … FOR UPDATE`, sehingga dua
 * permintaan bersamaan tidak pernah mendapat nomor yang sama. Tabel terpisah — bukan
 * `MAX(report_number) + 1` — karena menghitung maksimum tidak mengunci apa pun.
 */
export const reportNumberCounters = mysqlTable('report_number_counters', {
  /** `YYYY-MM`. */
  yearMonth: char('year_month', { length: 7 }).primaryKey(),
  lastSeq: int('last_seq').notNull().default(0),
});

/**
 * Antrean handoff ke tim teknis Pralon (layar 11). docs/BACKOFFICE.md.
 *
 * Kebutuhan yang sudah terkumpul disalin ke `captured_json`: pengguna tidak boleh
 * mengulang ceritanya, dan tim teknis harus melihat apa yang dilihat pengguna saat
 * kasusnya diserahkan — bukan keadaan percakapan yang mungkin sudah berubah sejak itu.
 */
export const technicalHandoffs = mysqlTable(
  'technical_handoffs',
  {
    id: id().primaryKey(),
    conversationId: char('conversation_id', { length: 26 }).notNull(),
    /** Alasan kebijakan yang memicu handoff (mis. instalasi industri). */
    reason: varchar('reason', { length: 255 }).notNull(),
    capturedJson: json('captured_json').notNull(),
    status: varchar('status', { length: 12 }).notNull().default('QUEUED'),
    /** Peran internal yang mengambil kasus; `NULL` selama belum diambil. */
    assignedTo: char('assigned_to', { length: 26 }),
    createdAt: createdAt(),
    resolvedAt: datetime('resolved_at', { fsp: 3 }),
  },
  (t) => [
    index('ix_handoffs_status_created').on(t.status, t.createdAt),
    index('ix_handoffs_conversation').on(t.conversationId),
    foreignKey({
      name: 'fk_handoffs_conversation',
      columns: [t.conversationId],
      foreignColumns: [conversations.id],
    }).onDelete('cascade'),
    check('ck_handoffs_status', sql`\`status\` IN ('QUEUED','IN_REVIEW','RESOLVED','CLOSED')`),
  ],
);
