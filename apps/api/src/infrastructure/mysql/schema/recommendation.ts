import { sql } from 'drizzle-orm';
import {
  char,
  check,
  datetime,
  foreignKey,
  index,
  json,
  mysqlTable,
  text,
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
