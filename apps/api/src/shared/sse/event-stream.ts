/**
 * Event SSE yang mengalir saat terjadi (Fase 14 §7 — latensi).
 *
 * Sebelumnya pipeline mengumpulkan seluruh event lalu controller menulisnya sekaligus di akhir:
 * di CPU, "UNDERSTANDING aktif" baru terlihat setelah 20–60 detik bersama jawabannya. Dengan
 * sink ini setiap `events.push(...)` juga langsung dikirim ke controller, sementara pipeline
 * tetap mengembalikan array lengkap untuk persistensi dan tes — dua pembaca, satu urutan.
 *
 * `streamedEvents` mengembalikan array biasa yang `push`-nya juga memanggil sink. Memilih ini
 * daripada mengubah setiap pipeline menjadi generator: 80-an situs `events.push` tetap seperti
 * adanya, dan tes yang membaca array hasil tidak berubah.
 */
import type { AssistantStreamEvent } from '@snouty/shared-types';

export type EventSink = (event: AssistantStreamEvent) => void;

export function streamedEvents(
  emit: EventSink | undefined,
  initial: readonly AssistantStreamEvent[] = [],
): AssistantStreamEvent[] {
  const events: AssistantStreamEvent[] = [];
  if (emit !== undefined) {
    const push = events.push.bind(events);
    // Non-enumerable: `push` pengganti tidak boleh muncul sebagai properti saat array
    // dibandingkan (`toEqual`) atau diserialisasi.
    Object.defineProperty(events, 'push', {
      enumerable: false,
      value: (...items: AssistantStreamEvent[]): number => {
        for (const item of items) emit(item);
        return push(...items);
      },
    });
  }
  events.push(...initial);
  return events;
}

/**
 * Penulis SSE untuk controller: header baru dikirim pada event PERTAMA. Galat sebelum itu
 * tetap menjadi respons JSON berstatus benar (filter galat masih bisa menulisnya); galat
 * sesudahnya dilaporkan sebagai event `error` — bukan koneksi yang putus tanpa isi.
 */
export interface SseWriter {
  readonly emit: EventSink;
  /** Berapa event yang sudah ditulis — pemanggil menulis sisa array dari indeks ini. */
  readonly written: () => number;
  readonly started: () => boolean;
}

export function sseWriter(res: {
  setHeader(name: string, value: string): unknown;
  flushHeaders?: () => void;
  write(chunk: string): unknown;
}): SseWriter {
  let started = false;
  let written = 0;
  return {
    emit: (event) => {
      if (!started) {
        started = true;
        res.setHeader('content-type', 'text/event-stream');
        res.setHeader('cache-control', 'no-cache, no-transform');
        res.setHeader('connection', 'keep-alive');
        res.flushHeaders?.();
      }
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      written += 1;
    },
    written: () => written,
    started: () => started,
  };
}
