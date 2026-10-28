import { sql } from 'drizzle-orm';
import {
  char,
  check,
  datetime,
  int,
  mysqlTable,
  primaryKey,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Skema validasi aturan teknik (P31-82).
 *
 * Paket `@snouty/engineering` sengaja bebas I/O: formula, versi, dan test case-nya murni, dan
 * itulah yang membuat laporan lama bisa dibuat ulang identik. Tanda tangan bukan bagian dari
 * formula — ia fakta tentang siapa dan kapan — jadi ia tinggal di sini, bukan di sana.
 */

/**
 * Keputusan ahli domain Pralon atas satu versi aturan (OQ-06, P16-69).
 *
 * Kuncinya aturan + versi, bukan aturan saja: menaikkan versi berarti formulanya berubah, dan
 * tanda tangan atas formula lama tidak ikut pindah. Tanpa baris, aturan tetap
 * `REQUIRES_DOMAIN_VALIDATION`, dan keluarannya tetap asumsi.
 */
export const ruleSignOffs = mysqlTable(
  'rule_sign_offs',
  {
    ruleId: varchar('rule_id', { length: 16 }).notNull(),
    ruleVersion: int('rule_version').notNull(),
    /** `approved` → aturan dipakai apa adanya; `rejected` → nilainya tidak boleh ditampilkan. */
    decision: varchar('decision', { length: 16 }).notNull(),
    decidedBy: char('decided_by', { length: 26 }).notNull(),
    note: varchar('note', { length: 500 }),
    decidedAt: datetime('decided_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.ruleVersion] }),
    check('ck_rule_sign_offs_decision', sql`${table.decision} IN ('approved', 'rejected')`),
  ],
);
