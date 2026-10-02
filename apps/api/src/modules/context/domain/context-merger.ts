/**
 * ContextMerger — menggabungkan hasil ekstraksi ke dalam state kebutuhan.
 * docs/CONTEXT_ENGINE.md §4. **Fungsi murni, tanpa I/O, tanpa LLM.**
 *
 * Dua hal yang paling halus di seluruh sistem, dan keduanya hidup di sini:
 *
 * **`undefined` bukan `null`.** Ekstraksi yang tidak menyebut sebuah field
 * mengembalikan `undefined` ("tidak disebut di pesan ini") — bukan `null`. `null`
 * dari ekstraksi hanya muncul saat pengguna menyatakan ketiadaan ("tidak ada
 * dapur"), yang menjadi `value: 0`. Kalau keduanya jadi `null`, sistem akan
 * menanyakan ulang hal yang sudah dijawab (docs/CONTEXT_ENGINE.md §4 baris 4–5).
 *
 * **Default tidak pernah menimpa nilai pengguna.** Presedensi sumber, dari paling
 * kuat: `user_edited > user_stated > inferred > default_applied`.
 */

import type {
  FieldSource,
  RequirementFieldPath,
  RequirementState,
  TrackedValue,
} from '@snouty/shared-types';
import { readField, writeField } from './requirement-field.js';

const SOURCE_RANK: Readonly<Record<FieldSource, number>> = {
  user_edited: 3,
  user_stated: 2,
  inferred: 1,
  default_applied: 0,
};

/**
 * Satu nilai yang akan di-merge. `value: undefined` berarti "tidak disebut" dan
 * field yang bersangkutan tidak disentuh sama sekali. `value: null` sah hanya bila
 * pengguna menyatakan ketiadaan — tetapi jalur itu dikodekan sebagai `0`/false
 * oleh pemanggil, jadi di sini `null` juga diperlakukan sebagai "tidak disebut".
 */
export interface FieldUpdate {
  readonly path: RequirementFieldPath;
  readonly value: unknown;
  readonly source: FieldSource;
  readonly provenance?: TrackedValue<unknown>['provenance'];
  readonly reason?: string;
  readonly ruleId?: string;
}

export interface MergeResult {
  readonly state: RequirementState;
  /** Field yang benar-benar berubah — dipakai memutuskan apakah perlu snapshot baru. */
  readonly changed: readonly RequirementFieldPath[];
}

/**
 * Menggabungkan sekumpulan update. `now` disuntikkan (bukan `new Date()`) supaya
 * fungsi tetap murni dan dapat diuji deterministik — waktu adalah masukan, bukan
 * efek samping.
 */
export function mergeRequirement(
  state: RequirementState,
  updates: readonly FieldUpdate[],
  now: string,
): MergeResult {
  let next = state;
  const changed: RequirementFieldPath[] = [];

  for (const update of updates) {
    // "Tidak disebut di pesan ini" — abaikan, jangan hapus yang sudah ada.
    if (update.value === undefined || update.value === null) continue;

    const current = readField(next, update.path);
    const incomingRank = SOURCE_RANK[update.source];
    const currentRank = current.value === null ? -1 : SOURCE_RANK[current.source];

    // Default (dan apa pun yang lebih lemah) tidak pernah menimpa nilai yang lebih
    // kuat. Nilai yang sama kuat: yang terbaru menang (pengguna menyebut ulang).
    if (current.value !== null && incomingRank < currentRank) continue;

    const merged: TrackedValue<unknown> = {
      value: update.value,
      source: update.source,
      provenance: update.provenance ?? provenanceFor(update.source),
      updatedAt: now,
      ...(update.reason !== undefined ? { reason: update.reason } : {}),
      ...(update.ruleId !== undefined ? { ruleId: update.ruleId } : {}),
    };

    next = writeField(next, update.path, merged);
    changed.push(update.path);
  }

  return { state: next, changed };
}

/**
 * Provenance baku per sumber bila pemanggil tidak menyatakannya. Nilai dari
 * pengguna adalah `VERIFIED`; default adalah `ASSUMED` (dan WAJIB membawa `reason`,
 * invarian TV-1 — ditegakkan pemanggil default, bukan di sini).
 */
function provenanceFor(source: FieldSource): TrackedValue<unknown>['provenance'] {
  switch (source) {
    case 'user_stated':
    case 'user_edited':
      return 'VERIFIED';
    case 'default_applied':
      return 'ASSUMED';
    case 'inferred':
      return 'ASSUMED';
  }
}
