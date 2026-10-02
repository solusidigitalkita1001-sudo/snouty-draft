/**
 * Port repository snapshot kebutuhan. docs/CONTEXT_ENGINE.md §7.
 *
 * Append-only: hanya `append` dan pembacaan — tidak ada `update` maupun `delete`.
 * Bentuk port ini sendiri yang menegakkan sifat append-only; `version` monoton
 * ditegakkan basis data lewat unique index.
 */

import type { RequirementState, SnapshotTrigger } from '@snouty/shared-types';

export const REQUIREMENT_SNAPSHOT_REPOSITORY = Symbol('REQUIREMENT_SNAPSHOT_REPOSITORY');

export interface RequirementSnapshotRow {
  readonly id: string;
  readonly conversationId: string;
  readonly version: number;
  readonly state: RequirementState;
  readonly trigger: SnapshotTrigger;
  readonly createdAt: Date;
}

export interface AppendSnapshotInput {
  readonly id: string;
  readonly conversationId: string;
  readonly version: number;
  readonly state: RequirementState;
  readonly trigger: SnapshotTrigger;
}

export interface RequirementSnapshotRepository {
  append(input: AppendSnapshotInput): Promise<RequirementSnapshotRow>;
  /** Snapshot ter-versi tertinggi, atau `null` bila percakapan belum punya. */
  findLatest(conversationId: string): Promise<RequirementSnapshotRow | null>;
  findByVersion(conversationId: string, version: number): Promise<RequirementSnapshotRow | null>;
}
