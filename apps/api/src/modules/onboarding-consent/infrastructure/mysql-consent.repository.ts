/**
 * Implementasi MySQL dari `ConsentRepository`.
 *
 * "Baris terbaru" ditentukan oleh `id` ULID, bukan oleh `granted_at`: dua baris
 * yang lahir pada milidetik yang sama tetap punya urutan total lewat 80 bit
 * acaknya, sementara stempel waktu bisa seri — dan "terbaru" yang ambigu berarti
 * keadaan consent yang ambigu.
 */
import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { consents } from '../../../infrastructure/mysql/schema/identity.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  CONSENT_REPOSITORY,
  type ConsentKind,
  type ConsentRepository,
  type ConsentRow,
  type ConsentSubject,
  type NewConsent,
} from '../domain/consent.repository.js';

const COLUMNS = {
  id: consents.id,
  subjectId: consents.subjectId,
  subjectKind: consents.subjectKind,
  kind: consents.kind,
  granted: consents.granted,
  policyVersion: consents.policyVersion,
  grantedAt: consents.grantedAt,
  revokedAt: consents.revokedAt,
};

@Injectable()
export class MysqlConsentRepository implements ConsentRepository {
  constructor(private readonly database: QueryRunner) {}

  async append(consent: NewConsent): Promise<void> {
    await this.database.db.insert(consents).values({
      id: consent.id,
      subjectId: consent.subject.id,
      subjectKind: consent.subject.kind,
      kind: consent.kind,
      granted: consent.granted ? 1 : 0,
      policyVersion: consent.policyVersion,
    });
  }

  async findLatest(subject: ConsentSubject, kind: ConsentKind): Promise<ConsentRow | null> {
    const rows = await this.database.db
      .select(COLUMNS)
      .from(consents)
      .where(
        and(
          eq(consents.subjectKind, subject.kind),
          eq(consents.subjectId, subject.id),
          eq(consents.kind, kind),
        ),
      )
      .orderBy(desc(consents.id))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toRow(row);
  }

  async findAllLatest(subject: ConsentSubject): Promise<readonly ConsentRow[]> {
    // Seluruh riwayat subjek kecil (satuan baris, dua jenis), jadi "terbaru per
    // jenis" diselesaikan di memori — window function untuk selusin baris adalah
    // kerumitan tanpa imbalan.
    const rows = await this.database.db
      .select(COLUMNS)
      .from(consents)
      .where(and(eq(consents.subjectKind, subject.kind), eq(consents.subjectId, subject.id)))
      .orderBy(desc(consents.id));

    const latestPerKind = new Map<string, ConsentRow>();
    for (const row of rows) {
      if (!latestPerKind.has(row.kind)) latestPerKind.set(row.kind, toRow(row));
    }
    return [...latestPerKind.values()];
  }

  async markRevoked(id: string): Promise<void> {
    await this.database.db
      .update(consents)
      // Jam DATABASE, bukan `new Date()`: `granted_at` diisi CURRENT_TIMESTAMP
      // milik server, dan CHECK `revoked_at >= granted_at` membandingkan keduanya.
      // Dua jam yang berbeda — Node dan kontainer — berselisih milidetik, dan
      // pencabutan yang menyusul pemberian pada milidetik yang sama kalah balapan
      // jam itu. Satu jam untuk kedua kolom menghapus balapannya, bukan menang undi.
      .set({ revokedAt: sql`CURRENT_TIMESTAMP(3)` })
      .where(eq(consents.id, id));
  }
}

function toRow(row: {
  id: string;
  subjectId: string;
  subjectKind: string;
  kind: string;
  granted: number;
  policyVersion: string;
  grantedAt: Date;
  revokedAt: Date | null;
}): ConsentRow {
  return {
    id: row.id,
    subject: { kind: toSubjectKind(row.subjectKind), id: row.subjectId },
    kind: toKind(row.kind),
    granted: row.granted === 1,
    policyVersion: row.policyVersion,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
  };
}

function toSubjectKind(raw: string): 'user' | 'guest' {
  if (raw === 'user' || raw === 'guest') return raw;
  throw new Error(`subjek consent tidak dikenal di database: ${raw}`);
}

function toKind(raw: string): ConsentKind {
  if (raw === 'LOCATION' || raw === 'ANALYTICS_STORAGE') return raw;
  throw new Error(`jenis consent tidak dikenal di database: ${raw}`);
}

export const consentRepositoryProvider = {
  provide: CONSENT_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): ConsentRepository =>
    new MysqlConsentRepository(database),
};
