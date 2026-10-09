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

/** Event tahap seperti yang dialirkan ke web (`stage`, `status`). */
interface StageEvent {
  readonly type: string;
  readonly stage?: string;
  readonly status?: string;
}

/**
 * Durasi per tahap dari event tahap yang sudah dialirkan (`active` → `done`/`failed`): jalur
 * analisis mengukur engine, katalog, dan penyusunan tanpa jam tambahan di setiap runner.
 */
export function streamStageClock(now: () => number = Date.now): {
  observe(event: StageEvent): void;
  report(): Readonly<Record<string, number>>;
} {
  const startedAt = now();
  const open = new Map<string, number>();
  const stages: Record<string, number> = {};
  return {
    observe(event) {
      if (event.type !== 'stage' || event.stage === undefined) return;
      if (event.status === 'active') open.set(event.stage, now());
      else if (open.has(event.stage)) {
        stages[event.stage] = now() - open.get(event.stage)!;
        open.delete(event.stage);
      }
    },
    report() {
      return { ...stages, total: now() - startedAt };
    },
  };
}
