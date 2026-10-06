/**
 * Bantuan tes integrasi terhadap MySQL sekali pakai.
 *
 * Repository diuji terhadap MySQL sungguhan, bukan mock, karena yang ingin
 * dibuktikan justru hal-hal yang hanya database bisa jawab: apakah
 * `ORDER BY size_unit, size_value_x1000` benar-benar mengurutkan `1"` sebelum `1¼"`,
 * apakah CHECK constraint menolak baris yang melanggar, dan **berapa query yang
 * sebenarnya dikirim**. Mock akan menjawab semuanya "ya".
 *
 * Berkas ini MENOLAK berjalan terhadap server bersama (docs/DATABASE.md §2).
 */
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/mysql2';
import type { Logger } from 'drizzle-orm/logger';
import mysql, { type Pool } from 'mysql2/promise';
import * as schema from '../src/infrastructure/mysql/schema/index.js';
import type { SnoutyDatabase } from '../src/shared/database/database.service.js';

const SHARED_HOST = '192.168.1.136';

/**
 * Menghitung query yang benar-benar dikirim ke MySQL.
 *
 * Tes N+1 memakai penghitung, bukan pemeriksaan manual: "sepertinya ini satu
 * query" adalah klaim yang berumur sampai seseorang menambahkan satu `await` di
 * dalam `map` (docs/CODING_STANDARDS.md §7).
 */
export class QueryCounter implements Logger {
  private readonly log: string[] = [];

  logQuery(query: string): void {
    this.log.push(query);
  }

  reset(): void {
    this.log.length = 0;
  }

  get count(): number {
    return this.log.length;
  }

  get queries(): readonly string[] {
    return this.log;
  }
}

export interface TestDatabase {
  readonly db: SnoutyDatabase;
  readonly counter: QueryCounter;
  /** Mengosongkan seluruh tabel katalog — dipakai di `beforeEach`. */
  clear(): Promise<void>;
  close(): Promise<void>;
}

/** Seluruh migration naik, berurutan; turunnya dibalik. */
const UP = [
  '0000_catalog.sql',
  '0001_catalog_import_runs.sql',
  '0002_audit_logs.sql',
  '0003_identity.sql',
  '0004_onboarding_states.sql',
  '0005_conversation.sql',
  '0006_requirement_snapshots.sql',
  '0007_llm_calls.sql',
  '0008_recommendations.sql',
  '0009_reports_handoffs.sql',
  '0010_intelligence.sql',
  '0011_catalog_foreign_keys.sql',
  '0012_recommendation_prose_source.sql',
  '0013_catalog_version_kind.sql',
  '0014_recommendation_kind.sql',
  '0015_recommendation_technical.sql',
  '0016_product_sizes_unit.sql',
];
const DOWN = [
  '0016_product_sizes_unit.down.sql',
  '0015_recommendation_technical.down.sql',
  '0014_recommendation_kind.down.sql',
  '0013_catalog_version_kind.down.sql',
  '0012_recommendation_prose_source.down.sql',
  '0011_catalog_foreign_keys.down.sql',
  '0010_intelligence.down.sql',
  '0009_reports_handoffs.down.sql',
  '0008_recommendations.down.sql',
  '0007_llm_calls.down.sql',
  '0006_requirement_snapshots.down.sql',
  '0005_conversation.down.sql',
  '0004_onboarding_states.down.sql',
  '0003_identity.down.sql',
  '0002_audit_logs.down.sql',
  '0001_catalog_import_runs.down.sql',
  '0000_catalog.down.sql',
];

/**
 * Urutan penghapusan dibalik dari urutan pembuatan, mengikuti arah rujukan.
 *
 * Sejak konteks identity punya foreign key sungguhan, urutan ini **mengikat**:
 * `users` harus terakhir, karena `guest_sessions` merujuknya dengan `RESTRICT`.
 */
const TABLES = [
  'market_events',
  'email_analyses',
  'emails',
  'technical_handoffs',
  'reports',
  'report_number_counters',
  'calculation_traces',
  'recommendations',
  'requirement_snapshots',
  'messages',
  'conversations',
  'onboarding_states',
  'consents',
  'refresh_tokens',
  'user_roles',
  'guest_sessions',
  'users',
  'llm_calls',
  'audit_logs',
  'catalog_import_runs',
  'product_images',
  'product_documents',
  'product_compatibility',
  'product_specs',
  'product_sizes',
  'products',
  'catalog_versions',
] as const;

/**
 * Menyiapkan database tes tersendiri dan menerapkan migration katalog ke
 * dalamnya. Namanya diturunkan dari `DB_DATABASE` dengan sufiks, supaya tes
 * repository tidak pernah bertabrakan dengan `scripts/test-migration.mjs` yang
 * memakai skema yang sama.
 */
export async function createTestDatabase(suffix: string): Promise<TestDatabase> {
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number(process.env.DB_PORT ?? 3317);
  const user = process.env.DB_USERNAME ?? 'root';
  const password = process.env.DB_PASSWORD ?? 'test';
  const database = `${process.env.DB_DATABASE ?? 'snouty_test'}_${suffix}`;

  // Assertion, bukan hanya konfigurasi: konfigurasi bisa salah (SPEC §31c).
  if (host.includes(SHARED_HOST)) {
    throw new Error(`Tes integrasi menolak berjalan terhadap server bersama (${SHARED_HOST}).`);
  }

  const admin = await connect({ host, port, user, password });
  // `IF NOT EXISTS`, dan tidak pernah DROP DATABASE — skema dibersihkan lewat
  // DROP TABLE di bawah, sehingga tidak ada jalur kode tes yang bisa menghapus
  // database milik orang lain kalau suatu hari host-nya salah diset.
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await admin.end();

  // POOL, bukan koneksi tunggal — dan ini pernah menggigit: dua transaksi
  // "paralel" di SATU koneksi saling menyelipkan statement-nya, sehingga
  // `FOR UPDATE` tidak pernah benar-benar mengunci dan tes balapan meloloskan
  // perilaku yang di produksi (yang memakai pool) justru dicegah. Fixture harus
  // berbohong sesedikit mungkin tentang produksi.
  const conn = await connectPool({ host, port, user, password, database });
  await applyMigration(conn);

  const counter = new QueryCounter();
  const db = drizzle(conn, { schema, mode: 'default', logger: counter });

  return {
    db,
    counter,
    async clear() {
      for (const table of TABLES) await conn.query(`DELETE FROM \`${table}\``);
      counter.reset();
    },
    async close() {
      await conn.end();
    },
  };
}

interface ConnectOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

async function connect(options: ConnectOptions): Promise<mysql.Connection> {
  try {
    const conn = await mysql.createConnection({
      ...options,
      multipleStatements: true,
      timezone: 'Z',
      connectTimeout: 5_000,
    });
    return conn;
  } catch (cause) {
    throw unreachable(options, cause);
  }
}

async function connectPool(options: ConnectOptions): Promise<Pool> {
  const pool = mysql.createPool({
    ...options,
    multipleStatements: true,
    timezone: 'Z',
    connectTimeout: 5_000,
    connectionLimit: 5,
    waitForConnections: true,
  });
  try {
    // Pool malas membuka koneksi; satu ping membuat kegagalan koneksi muncul di
    // sini dengan pesan yang jelas, bukan di tengah tes pertama.
    await pool.query('SELECT 1');
    return pool;
  } catch (cause) {
    throw unreachable(options, cause);
  }
}

function unreachable(options: ConnectOptions, cause: unknown): Error {
  return new Error(
    `Tidak bisa terhubung ke MySQL tes di ${options.host}:${options.port}. ` +
      'Jalankan `docker compose --profile test up -d mysql-test` lebih dulu.',
    { cause },
  );
}

/**
 * Menerapkan seluruh migration dari nol. Turun lebih dulu supaya tes bisa
 * dijalankan berulang kali di kontainer yang sama tanpa sisa proses sebelumnya.
 */
async function applyMigration(conn: Pool): Promise<void> {
  // Turun lebih dulu, mengabaikan kegagalan: pada database yang masih bersih
  // tidak ada indeks untuk di-drop, dan MySQL 8 tidak punya DROP INDEX IF EXISTS.
  for (const file of DOWN) {
    try {
      await run(conn, file);
    } catch {
      // Sengaja ditelan — lihat komentar di atas. Kegagalan naik tetap dilempar.
    }
  }
  for (const file of UP) await run(conn, file);
}

async function run(conn: Pool, file: string): Promise<void> {
  const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed !== '') await conn.query(trimmed);
  }
}

/** ID gaya ULID yang stabil dan terbaca di pesan kegagalan tes. */
export function testId(label: string): string {
  return label
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '0')
    .padEnd(26, '0')
    .slice(0, 26);
}
