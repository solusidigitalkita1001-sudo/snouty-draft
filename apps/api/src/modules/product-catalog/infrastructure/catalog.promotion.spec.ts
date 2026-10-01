/**
 * P1-07a — tepat satu versi `active`; promosi membatalkan cache dan menulis audit.
 *
 * Diuji terhadap MySQL **dan** Redis sungguhan karena ketiga janji item ini hanya
 * bermakna di sana: "tepat satu aktif" adalah unique index, bukan kesepakatan;
 * audit dalam satu transaksi hanya bisa dibuktikan oleh transaksi sungguhan; dan
 * invalidasi cache yang diuji terhadap mock hanya membuktikan mock-nya dipanggil.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { catalogVersions } from '../../../infrastructure/mysql/schema/catalog.js';
import { auditLogs } from '../../../infrastructure/mysql/schema/ops.js';
import type { AuditActor } from '../../../shared/audit/audit.types.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { createTestRedis, type TestRedis } from '../../../../test/redis.js';
import { CatalogPromotionService } from '../application/catalog-promotion.service.js';
import { catalogProductKey, CATALOG_ACTIVE_VERSION_KEY } from '../domain/catalog-cache.port.js';
import { CatalogVersionNotPromotableError } from '../domain/catalog-writer.repository.js';
import { MysqlCatalogRepository } from './catalog.mysql.repository.js';
import { MysqlCatalogWriter } from './catalog.mysql.writer.js';
import { RedisCatalogCache } from './catalog.redis.cache.js';

const DRAFT = testId('VDRAFT');
const ACTIVE = testId('VACTIVE');
const ARCHIVED = testId('VARCH');
const ACTOR: AuditActor = { id: testId('ADMIN'), role: 'catalog_admin', correlationId: 'corr-1' };
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

let fixture: TestDatabase;
let redis: TestRedis;
let service: CatalogPromotionService;

beforeAll(async () => {
  fixture = await createTestDatabase('promotion');
  redis = await createTestRedis(1);
  service = new CatalogPromotionService(
    new MysqlCatalogRepository({ db: fixture.db }),
    new MysqlCatalogWriter({ db: fixture.db }),
    new RedisCatalogCache(redis.client),
  );
});

afterAll(async () => {
  await fixture.close();
  await redis.close();
});

beforeEach(async () => {
  await fixture.clear();
  await redis.clear();
});

function version(id: string, label: string, status: 'draft' | 'active' | 'archived') {
  return {
    id,
    label,
    sourceDocument: 'Katalog produk Pralon 2026',
    status,
    effectiveFrom: EFFECTIVE_FROM,
    importedBy: ACTOR.id,
  };
}

async function statuses(): Promise<Record<string, string>> {
  const rows = await fixture.db
    .select({ id: catalogVersions.id, status: catalogVersions.status })
    .from(catalogVersions);
  return Object.fromEntries(rows.map((row) => [row.id, row.status]));
}

describe('promosi versi katalog — tepat satu aktif', () => {
  it('mengarsipkan versi aktif sebelumnya dan mengaktifkan yang baru', async () => {
    await fixture.db
      .insert(catalogVersions)
      .values([version(ACTIVE, 'v2.3', 'active'), version(DRAFT, 'v2.4', 'draft')]);

    const outcome = await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    expect(outcome.previousActiveId).toBe(ACTIVE);
    expect(await statuses()).toEqual({ [ACTIVE]: 'archived', [DRAFT]: 'active' });
  });

  it('berhasil juga saat belum ada versi aktif sama sekali', async () => {
    await fixture.db.insert(catalogVersions).values([version(DRAFT, 'v2.4', 'draft')]);

    const outcome = await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    expect(outcome.previousActiveId).toBeNull();
    expect(await statuses()).toEqual({ [DRAFT]: 'active' });
  });

  it('tidak pernah meninggalkan dua versi aktif, karena pengarsipan terjadi lebih dulu', async () => {
    await fixture.db
      .insert(catalogVersions)
      .values([version(ACTIVE, 'v2.3', 'active'), version(DRAFT, 'v2.4', 'draft')]);

    await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    const active = await fixture.db
      .select({ id: catalogVersions.id })
      .from(catalogVersions)
      .where(eq(catalogVersions.status, 'active'));

    expect(active).toHaveLength(1);
  });

  it('menolak versi yang sudah diarsipkan tanpa mengubah apa pun', async () => {
    await fixture.db
      .insert(catalogVersions)
      .values([version(ACTIVE, 'v2.3', 'active'), version(ARCHIVED, 'v2.2', 'archived')]);

    await expect(service.promote({ catalogVersionId: ARCHIVED, actor: ACTOR })).rejects.toThrow(
      CatalogVersionNotPromotableError,
    );
    expect(await statuses()).toEqual({ [ACTIVE]: 'active', [ARCHIVED]: 'archived' });
  });
});

describe('promosi versi katalog — audit', () => {
  it('menulis dua baris audit: yang dipromosikan dan yang digantikan', async () => {
    await fixture.db
      .insert(catalogVersions)
      .values([version(ACTIVE, 'v2.3', 'active'), version(DRAFT, 'v2.4', 'draft')]);

    await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    const rows = await fixture.db
      .select({
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        before: auditLogs.beforeJson,
        after: auditLogs.afterJson,
      })
      .from(auditLogs)
      .orderBy(asc(auditLogs.action));

    expect(rows).toEqual([
      {
        action: 'catalog.version.archive',
        entityType: 'catalog_version',
        entityId: ACTIVE,
        before: { status: 'active' },
        after: { status: 'archived' },
      },
      {
        action: 'catalog.version.promote',
        entityType: 'catalog_version',
        entityId: DRAFT,
        before: { status: 'draft' },
        after: { status: 'active' },
      },
    ]);
  });

  it('mencatat peran aktor saat aksi dilakukan, bukan hanya id-nya', async () => {
    await fixture.db.insert(catalogVersions).values([version(DRAFT, 'v2.4', 'draft')]);

    await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    const rows = await fixture.db
      .select({
        actorId: auditLogs.actorId,
        actorRole: auditLogs.actorRole,
        correlationId: auditLogs.correlationId,
      })
      .from(auditLogs);

    expect(rows).toEqual([
      { actorId: ACTOR.id, actorRole: 'catalog_admin', correlationId: 'corr-1' },
    ]);
  });

  it('tidak menulis audit saat tidak ada yang berubah', async () => {
    await fixture.db.insert(catalogVersions).values([version(ACTIVE, 'v2.3', 'active')]);

    await service.promote({ catalogVersionId: ACTIVE, actor: ACTOR });

    const rows = await fixture.db.select({ id: auditLogs.id }).from(auditLogs);

    expect(rows).toEqual([]);
  });
});

describe('promosi versi katalog — invalidasi cache', () => {
  it('membuang kunci produk dan kunci versi aktif', async () => {
    await fixture.db.insert(catalogVersions).values([version(DRAFT, 'v2.4', 'draft')]);
    await redis.client.set(CATALOG_ACTIVE_VERSION_KEY, 'v2.3');
    await redis.client.set(catalogProductKey('P1'), '{}');
    await redis.client.set(catalogProductKey('P2'), '{}');

    const outcome = await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    expect(outcome.cacheKeysInvalidated).toBe(3);
    expect(await redis.client.exists(CATALOG_ACTIVE_VERSION_KEY)).toBe(0);
    expect(await redis.client.exists(catalogProductKey('P1'))).toBe(0);
    expect(await redis.client.exists(catalogProductKey('P2'))).toBe(0);
  });

  it('tidak menyentuh kunci Redis milik bagian lain sistem', async () => {
    // Invalidasi katalog memindai awalan katalog saja. Kalau ia menyapu
    // `snouty:*`, promosi katalog akan memutus setiap sesi tamu yang sedang jalan.
    await fixture.db.insert(catalogVersions).values([version(DRAFT, 'v2.4', 'draft')]);
    await redis.client.set('snouty:guest:abc', 'sesi');
    await redis.client.set('snouty:rl:guest:1:w', '3');

    await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    expect(await redis.client.get('snouty:guest:abc')).toBe('sesi');
    expect(await redis.client.get('snouty:rl:guest:1:w')).toBe('3');
  });

  it('melaporkan 0 tanpa gagal saat cache memang sedang kosong', async () => {
    await fixture.db.insert(catalogVersions).values([version(DRAFT, 'v2.4', 'draft')]);

    const outcome = await service.promote({ catalogVersionId: DRAFT, actor: ACTOR });

    expect(outcome.cacheKeysInvalidated).toBe(0);
    expect(outcome.changed).toBe(true);
  });
});
