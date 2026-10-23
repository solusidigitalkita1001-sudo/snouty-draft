import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  decimal,
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
    /** Provinsi (P26-07); kota dan koordinat kasar menyusul di 0030 untuk peta. */
    region: varchar('region', { length: 120 }),
    city: varchar('city', { length: 120 }),
    /** Dibulatkan 0,1° (±11 km): cukup untuk titik di peta, tidak cukup untuk menunjuk alamat. */
    lat: decimal('lat', { precision: 4, scale: 1 }),
    lng: decimal('lng', { precision: 5, scale: 1 }),
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

/**
 * Sinyal tahap 5A yang tidak meninggalkan baris lain (P26-02, docs/PROSPECT_5A.md §2): unduh laporan,
 * buka detail produk oleh pengguna terdaftar, kunjungan tautan bagikan. Tanpa IP, tanpa teks. Pemilik
 * ditentukan saat dibaca (laporan → percakapan → pemilik), jadi sinyal tamu ikut pindah saat mendaftar.
 */
export const prospectSignals = mysqlTable(
  'prospect_signals',
  {
    id: id().primaryKey(),
    kind: varchar('kind', { length: 24 }).notNull(),
    /** Id laporan, id produk, atau SHA-256 token tautan — token mentah tidak pernah disimpan. */
    refId: varchar('ref_id', { length: 64 }).notNull(),
    userId: char('user_id', { length: 26 }),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    /** Satu baris per jenis × rujukan × pengguna × hari. */
    dedupeKey: char('dedupe_key', { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('uq_prospect_signals_dedupe').on(t.dedupeKey),
    index('ix_prospect_signals_kind_ref').on(t.kind, t.refId),
    index('ix_prospect_signals_user_day').on(t.userId, t.occurredOn),
    check(
      'ck_prospect_signals_kind',
      sql`\`kind\` IN ('report_download','product_view','share_visit')`,
    ),
  ],
);

/**
 * "Minta dihubungi tim Pralon" (P26-04, OQ-76): sinyal tahap Act dan dasar sah bagi sales untuk
 * menghubungi pengguna terdaftar yang tidak memberi opt-in umum.
 */
export const salesRequests = mysqlTable(
  'sales_requests',
  {
    id: id().primaryKey(),
    userId: char('user_id', { length: 26 }).notNull(),
    conversationId: char('conversation_id', { length: 26 }),
    source: varchar('source', { length: 16 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_sales_requests_user_created').on(t.userId, t.createdAt),
    index('ix_sales_requests_conversation').on(t.conversationId),
    check('ck_sales_requests_source', sql`\`source\` IN ('solution','price')`),
  ],
);

/**
 * Penugasan prospek ke sales (P26-05). Satu baris per prospek: dipindah, bukan digandakan. Status
 * menang/kalah dipakai mengkalibrasi ulang prioritas (docs/PROSPECT_5A.md §5).
 */
export const salesLeads = mysqlTable(
  'sales_leads',
  {
    id: id().primaryKey(),
    userId: char('user_id', { length: 26 }).notNull(),
    assignedTo: char('assigned_to', { length: 26 }).notNull(),
    assignedBy: char('assigned_by', { length: 26 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('new'),
    lostReason: varchar('lost_reason', { length: 255 }),
    /** Ringkasan percakapan untuk sales (P26-06). */
    summary: json('summary'),
    createdAt: createdAt(),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex('uq_sales_leads_user').on(t.userId),
    index('ix_sales_leads_assignee_status').on(t.assignedTo, t.status),
    check('ck_sales_leads_status', sql`\`status\` IN ('new','contacted','quoted','won','lost')`),
  ],
);

/**
 * Pemberitahuan di dalam aplikasi (P27-07). Barisnya menyimpan KEJADIAN (`kind`, `subjectId`,
 * `data`), bukan kalimat: teks yang dibaca orang dirakit di lapisan tampilan per bahasa.
 */
export const notifications = mysqlTable(
  'notifications',
  {
    id: id().primaryKey(),
    userId: char('user_id', { length: 26 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    /** Yang dirujuk: prospek, permintaan dihubungi, atau laporan. */
    subjectId: char('subject_id', { length: 26 }),
    data: json('data'),
    readAt: datetime('read_at', { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_notifications_user_created').on(t.userId, t.createdAt),
    index('ix_notifications_user_unread').on(t.userId, t.readAt),
    check(
      'ck_notifications_kind',
      sql`\`kind\` IN ('lead_assigned','contact_requested','report_ready')`,
    ),
  ],
);
