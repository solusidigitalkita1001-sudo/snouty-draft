/**
 * Pengukur tahap (P14-07): waktu antar `mark()` dalam milidetik, plus total.
 *
 * `llm_calls` sudah mencatat latensi per panggilan model; yang tidak terlihat di sana adalah
 * tahap di antaranya — memuat snapshot, routing, pipeline, persistensi — dan di CPU itulah
 * tempat detik-detik yang "hilang" bersembunyi. Jam disuntikkan supaya tesnya deterministik.
 */
export interface StageTimer {
  /** Menutup tahap bernama `stage`: durasinya = sejak mark sebelumnya (atau sejak mulai). */
  mark(stage: string): void;
  /** `{ <stage>: ms, …, total: ms }` — total diukur dari pembuatan timer. */
  report(): Readonly<Record<string, number>>;
}

export function stageTimer(now: () => number = Date.now): StageTimer {
  const startedAt = now();
  let last = startedAt;
  const stages: Record<string, number> = {};
  return {
    mark(stage) {
      const at = now();
      stages[stage] = at - last;
      last = at;
    },
    report() {
      return { ...stages, total: now() - startedAt };
    },
  };
}
