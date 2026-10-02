import { Inject, Injectable } from '@nestjs/common';
import type { RequirementState, SnapshotTrigger } from '@snouty/shared-types';
import { RedisService } from '../../../shared/redis/redis.service.js';
import { ulid } from '../../../shared/ulid.js';
import {
  REQUIREMENT_SNAPSHOT_REPOSITORY,
  type RequirementSnapshotRepository,
  type RequirementSnapshotRow,
} from '../domain/requirement-snapshot.repository.js';

/** TTL cache snapshot: 24 jam (docs/CONTEXT_ENGINE.md §7). */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

function cacheKey(conversationId: string): string {
  return `snouty:ctx:${conversationId}`;
}

/**
 * Store snapshot kebutuhan — menegakkan pola **write-through** (CONTEXT_ENGINE §7).
 *
 * Tulis: MySQL dulu (sumber kebenaran), baru Redis. Bila Redis gagal, snapshot
 * tetap tersimpan — cache yang mati kehilangan kecepatan, bukan data. `version`
 * berikutnya diturunkan dari snapshot terbaru di MySQL, bukan dari cache, supaya
 * cache yang basi tidak pernah menghasilkan versi duplikat.
 *
 * Baca: coba Redis; miss → baca MySQL dan isi ulang cache. Redis boleh di-flush
 * kapan saja tanpa kehilangan apa pun (SPEC §18).
 */
@Injectable()
export class RequirementSnapshotStore {
  constructor(
    @Inject(REQUIREMENT_SNAPSHOT_REPOSITORY)
    private readonly repository: RequirementSnapshotRepository,
    private readonly redis: RedisService,
  ) {}

  /**
   * Menyimpan state sebagai snapshot baru dan mengembalikannya. `version` adalah
   * versi terbaru + 1, dibaca dari MySQL — titik serialisasi yang menjaga monoton.
   */
  async append(
    conversationId: string,
    state: RequirementState,
    trigger: SnapshotTrigger,
  ): Promise<RequirementSnapshotRow> {
    const latest = await this.repository.findLatest(conversationId);
    const version = (latest?.version ?? 0) + 1;
    const persisted = await this.repository.append({
      id: ulid(),
      conversationId,
      version,
      state: { ...state, version },
      trigger,
    });

    await this.writeCache(persisted);
    return persisted;
  }

  /** Snapshot aktif: Redis dulu, lalu MySQL (dan isi ulang cache saat miss). */
  async current(conversationId: string): Promise<RequirementSnapshotRow | null> {
    const cached = await this.readCache(conversationId);
    if (cached) return cached;

    const latest = await this.repository.findLatest(conversationId);
    if (latest) await this.writeCache(latest);
    return latest;
  }

  private async writeCache(row: RequirementSnapshotRow): Promise<void> {
    try {
      await this.redis.client.set(
        cacheKey(row.conversationId),
        JSON.stringify(serialize(row)),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Redis mati: snapshot sudah aman di MySQL. Jangan jatuhkan permintaan.
    }
  }

  private async readCache(conversationId: string): Promise<RequirementSnapshotRow | null> {
    try {
      const raw = await this.redis.client.get(cacheKey(conversationId));
      if (!raw) return null;
      return deserialize(JSON.parse(raw) as SerializedSnapshot);
    } catch {
      return null; // Cache miss karena Redis mati dilayani MySQL oleh pemanggil.
    }
  }
}

interface SerializedSnapshot {
  id: string;
  conversationId: string;
  version: number;
  state: RequirementState;
  trigger: SnapshotTrigger;
  createdAt: string;
}

function serialize(row: RequirementSnapshotRow): SerializedSnapshot {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function deserialize(s: SerializedSnapshot): RequirementSnapshotRow {
  return { ...s, createdAt: new Date(s.createdAt) };
}
