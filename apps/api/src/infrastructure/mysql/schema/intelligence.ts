import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
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
 * Skema konteks email intelligence dan market intelligence.
 * docs/EMAIL_INTELLIGENCE.md §9 · docs/MARKET_INTELLIGENCE.md §3.
 */

const id = () => char('id', { length: 26 });
const createdAt = () =>
  datetime('created_at', { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

/**
 * Email masuk. Badan **asli** disimpan — peninjau manusia perlu melihat apa yang
 * sebenarnya dikirim, dan redaksi hanya berlaku pada salinan yang dikirim ke model
 * (docs/EMAIL_INTELLIGENCE.md §5).
 *
 * Retensi 24 bulan lalu dianonimkan (docs/PRIVACY.md).
 */
export const emails = mysqlTable(
  'emails',
  {
    id: id().primaryKey(),
    /** `Message-ID` header — unik, dan itu yang membuat ingest idempoten. */
    messageId: varchar('message_id', { length: 255 }).notNull(),
    /** `In-Reply-To`; thread dikelompokkan dari sini agar satu percakapan = satu lead. */
    inReplyTo: varchar('in_reply_to', { length: 255 }),
    threadKey: varchar('thread_key', { length: 255 }).notNull(),
    fromAddress: varchar('from_address', { length: 320 }).notNull(),
    toAddress: varchar('to_address', { length: 320 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    /** Badan asli, apa adanya. Hanya ditampilkan kepada peninjau yang berwenang. */
    bodyRaw: text('body_raw').notNull(),
    /** Badan setelah riwayat balasan dibuang dan tanda tangan dipisah. */
    bodyClean: text('body_clean').notNull(),
    language: varchar('language', { length: 8 }),
    receivedAt: datetime('received_at', { fsp: 3 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('uq_emails_message_id').on(t.messageId),
    index('ix_emails_thread').on(t.threadKey, t.receivedAt),
    index('ix_emails_received').on(t.receivedAt),
  ],
);

/**
 * Hasil analisis satu email. `llm_call_id` menunjuk audit biaya (lintas konteks, tanpa FK).
 *
 * `score_breakdown` disimpan: tim penjualan harus bisa bertanya "kenapa 65?" dan mendapat
 * jawaban. Skor tanpa rinciannya adalah angka ajaib.
 */
export const emailAnalyses = mysqlTable(
  'email_analyses',
  {
    id: id().primaryKey(),
    emailId: char('email_id', { length: 26 }).notNull(),
    analysisJson: json('analysis_json').notNull(),
    score: int('score').notNull(),
    temperature: varchar('temperature', { length: 8 }).notNull(),
    scoreBreakdown: json('score_breakdown').notNull(),
    /** Versi model yang dipakai — analisis lama tetap bisa dijelaskan. */
    modelVersion: varchar('model_version', { length: 96 }),
    llmCallId: char('llm_call_id', { length: 26 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_email_analyses_email').on(t.emailId),
    index('ix_email_analyses_temperature').on(t.temperature, t.createdAt),
    foreignKey({
      name: 'fk_email_analyses_email',
      columns: [t.emailId],
      foreignColumns: [emails.id],
    }).onDelete('cascade'),
    check('ck_email_analyses_temperature', sql`\`temperature\` IN ('panas','hangat','dingin')`),
  ],
);

/**
 * Event market intelligence — **anonim**. docs/MARKET_INTELLIGENCE.md §3.
 *
 * Yang sengaja TIDAK ada di tabel ini, dan tidak boleh ditambahkan: `user_id`,
 * `guest_session_id`, `conversation_id`, `email_id`, nama, alamat email, nomor telepon,
 * dan **teks bebas apa pun**.
 *
 * Teks bebas dilarang karena satu kalimat mentah dari percakapan bisa memuat nama atau
 * detail yang membuat orang dapat dikenali — dan begitu masuk ke tabel agregat, ia sulit
 * ditarik kembali.
 *
 * `occurred_on` bertipe DATE, bukan DATETIME: presisi detik ditambah wilayah kecil adalah
 * kombinasi yang membuat identifikasi ulang jauh lebih mudah. Pembulatan ke hari ditegakkan
 * oleh **tipe kolomnya**, bukan oleh kedisiplinan pemanggil.
 */
export const marketEvents = mysqlTable(
  'market_events',
  {
    id: id().primaryKey(),
    source: varchar('source', { length: 8 }).notNull(),
    occurredOn: date('occurred_on').notNull(),
    /** Kota/kabupaten saja. */
    region: varchar('region', { length: 120 }),
    buildingType: varchar('building_type', { length: 24 }),
    projectScale: varchar('project_scale', { length: 8 }),
    installationType: varchar('installation_type', { length: 16 }),
    outletCount: int('outlet_count'),
    floors: int('floors'),
    /** Kunci keluarga+ukuran, bukan SKU — minat pasar bukan riwayat pembelian. */
    productInterest: json('product_interest').notNull(),
    quotationIntent: boolean('quotation_intent').notNull().default(false),
    reachedSolution: boolean('reached_solution').notNull().default(false),
    routedToTechnical: boolean('routed_to_technical').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_market_events_day_region').on(t.occurredOn, t.region),
    index('ix_market_events_source_day').on(t.source, t.occurredOn),
    check('ck_market_events_source', sql`\`source\` IN ('chat','email')`),
    check(
      'ck_market_events_scale',
      sql`\`project_scale\` IS NULL OR \`project_scale\` IN ('kecil','sedang','besar')`,
    ),
    check(
      'ck_market_events_installation',
      sql`\`installation_type\` IS NULL OR \`installation_type\` IN ('air_bersih','pembuangan','keduanya')`,
    ),
  ],
);
