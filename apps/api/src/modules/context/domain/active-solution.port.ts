/**
 * Solusi aktif sebuah percakapan untuk jawaban chat (P22-04): pertanyaan "toren harus setinggi
 * apa", "pipanya berapa inci", "fitting-nya apa saja" dijawab dari rekomendasi yang SUDAH dihitung,
 * bukan dari model. Modul context tidak boleh bergantung ke recommendation (ARCHITECTURE §7), jadi
 * pembacanya diikat dari luar: modul recommendation mendaftarkan dirinya saat init.
 */
import type { Recommendation } from '@snouty/shared-types';

export interface ActiveSolutionReader {
  latestFor(conversationId: string): Promise<Recommendation | null>;
}

/** Rekomendasi terakhir percakapan; `stale` bila kebutuhan sudah berubah sejak dihitung. */
export interface ActiveSolution {
  readonly recommendation: Recommendation;
  readonly stale: boolean;
}

export class ActiveSolutionRegistry implements ActiveSolutionReader {
  private reader: ActiveSolutionReader | null = null;

  bind(reader: ActiveSolutionReader): void {
    this.reader = reader;
  }

  async latestFor(conversationId: string): Promise<Recommendation | null> {
    return this.reader ? this.reader.latestFor(conversationId) : null;
  }
}
